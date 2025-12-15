/** @babel */

import { CompositeDisposable } from "atom";
import ChatPanel from "./chat-panel";
import HistoryList from "./history-list";
import SlashList from "./slash-list";
import { listSessions, loadSession, clearAllSessions } from "./session-store";

export default {
  subscriptions: null,
  panel: null,
  historyList: null,
  slashList: null,

  activate() {
    this.subscriptions = new CompositeDisposable();

    // Register opener
    this.subscriptions.add(
      atom.workspace.addOpener((uri) => {
        if (uri.startsWith(ChatPanel.URI_PREFIX)) {
          return this.getOrCreatePanel();
        }
      })
    );

    // Create history list (registers its own commands)
    this.historyList = new HistoryList(this);

    // Create slash command list (registers its own commands)
    this.slashList = new SlashList(this);

    // Clear panel reference when destroyed (e.g., user closes tab)
    this.subscriptions.add(
      atom.workspace.onDidDestroyPaneItem(({ item }) => {
        if (item === this.panel) {
          this.panel = null;
        }
      })
    );

    // Register commands
    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "claude-chat:toggle": () => this.toggle(),
        "claude-chat:new-chat": () => this.newChat(),
        "claude-chat:clear-history": () => this.clearHistory(),
        "claude-chat:settings": () => this.openSettings(),
      }),
      atom.commands.add("atom-text-editor:not([mini])", {
        "claude-chat:attach-selection": (e) => this.attachSelection(e),
        "claude-chat:attach-path": (e) => this.attachFile(e),
        "claude-chat:attach-position": (e) => this.attachPosition(e),
      }),
      atom.commands.add(".tree-view", {
        "claude-chat:attach-paths": () => this.attachPaths(),
      }),
    );
  },

  deactivate() {
    this.subscriptions?.dispose();
    this.historyList?.destroy();
    this.slashList?.destroy();
    this.panel?.destroy();
    this.panel = null;
  },

  serialize() {
    return {};
  },

  deserializeChatPanel(state) {
    this.panel = new ChatPanel(state);
    return this.panel;
  },

  getOrCreatePanel() {
    if (!this.panel) {
      this.panel = new ChatPanel();
    }
    return this.panel;
  },

  async toggle() {
    const uri = `${ChatPanel.URI_PREFIX}/panel`;

    // Check if panel exists in any dock
    const existing = atom.workspace.paneForURI(uri);
    if (existing) {
      const item = existing.itemForURI(uri);
      if (existing.getActiveItem() === item) {
        existing.destroyItem(item);
        this.panel = null;
        return;
      }
      existing.activateItem(item);
      requestAnimationFrame(() => item.focus?.());
      return;
    }

    // Open new panel
    const location = atom.config.get("claude-chat.panelPosition") || "right";
    await atom.workspace.open(uri, { location });
    requestAnimationFrame(() => this.panel?.focus());
  },

  newChat() {
    if (this.panel) {
      this.panel.destroy();
      this.panel = null;
    }
    this.toggle();
  },

  async clearHistory() {
    const projectPaths = atom.project.getPaths();
    const sessions = await listSessions(projectPaths);

    if (sessions.length === 0) {
      atom.notifications.addInfo("No chat history to clear.");
      return;
    }

    const confirmed = atom.confirm({
      message: "Clear Chat History",
      detailedMessage: `Delete ${sessions.length} chat session(s) for this project?`,
      buttons: ["Delete", "Cancel"],
    });

    if (confirmed === 0) {
      const deleted = await clearAllSessions(projectPaths);
      atom.notifications.addSuccess(`Deleted ${deleted} chat session(s).`);
    }
  },

  openSettings() {
    atom.workspace.open("atom://config/packages/claude-chat");
  },

  getActiveChat() {
    return this.panel;
  },

  focusActiveChat() {
    this.panel?.focus();
  },

  async openSession(sessionId) {
    // Check if session is already open
    const sessionURI = `${ChatPanel.URI_PREFIX}/session/${sessionId}`;
    const existingPane = atom.workspace.paneForURI(sessionURI);
    if (existingPane) {
      const item = existingPane.itemForURI(sessionURI);
      if (item) {
        existingPane.activateItem(item);
        item.focus?.();
        return;
      }
    }

    // Load session data
    const sessionData = await loadSession(sessionId);
    if (!sessionData) {
      atom.notifications.addError("Failed to load session.");
      return;
    }

    // Create new panel with session data
    const location = atom.config.get("claude-chat.panelPosition") || "right";
    this.panel = new ChatPanel(sessionData);

    await atom.workspace.open(this.panel, { location });
    requestAnimationFrame(() => this.panel?.focus());
  },

  // Helper to get relative path
  getRelativePath(filePath) {
    const projectPaths = atom.project.getPaths();
    for (const projectPath of projectPaths) {
      if (filePath.startsWith(projectPath)) {
        return filePath.slice(projectPath.length + 1).replace(/\\/g, "/");
      }
    }
    return filePath;
  },

  attachSelection(event) {
    const editor = event.currentTarget.getModel();
    if (!editor) return;

    const filePath = editor.getPath();
    if (!filePath) return;

    const selection = editor.getSelectedText();
    if (!selection) {
      atom.notifications.addWarning("No selection to attach");
      return;
    }

    const cursor = editor.getCursorBufferPosition();
    const relativePath = this.getRelativePath(filePath);

    const context = {
      type: "selection",
      paths: [relativePath],
      line: cursor.row + 1,
      selection,
      label: `${relativePath}:${cursor.row + 1}`,
      icon: "code",
    };

    this.panel?.setAttachContext(context);
    this.panel?.focus();
  },

  attachFile(event) {
    const editor = event.currentTarget.getModel();
    if (!editor) return;

    const filePath = editor.getPath();
    if (!filePath) return;

    const relativePath = this.getRelativePath(filePath);

    const context = {
      type: "paths",
      paths: [relativePath],
      label: relativePath,
      icon: "file",
    };

    this.panel?.setAttachContext(context);
    this.panel?.focus();
  },

  attachPosition(event) {
    const editor = event.currentTarget.getModel();
    if (!editor) return;

    const filePath = editor.getPath();
    if (!filePath) return;

    const cursor = editor.getCursorBufferPosition();
    const relativePath = this.getRelativePath(filePath);

    const context = {
      type: "position",
      paths: [relativePath],
      line: cursor.row + 1,
      column: cursor.column + 1,
      label: `${relativePath}:${cursor.row + 1}`,
      icon: "location",
    };

    this.panel?.setAttachContext(context);
    this.panel?.focus();
  },

  attachPaths() {
    const treeView = atom.packages
      .getActivePackage("tree-view")
      ?.mainModule?.getTreeViewInstance?.();
    if (!treeView) return;

    const selectedPaths = treeView.selectedPaths();
    if (!selectedPaths || selectedPaths.length === 0) return;

    const relativePaths = selectedPaths.map((p) => this.getRelativePath(p));
    const isMultiple = relativePaths.length > 1;

    const context = {
      type: "paths",
      paths: relativePaths,
      label: isMultiple ? `${relativePaths.length} paths` : relativePaths[0],
      icon: isMultiple ? "list-unordered" : "file-directory",
    };

    this.panel?.setAttachContext(context);
    this.panel?.focus();
  },

  // Service API for other packages to set attach context
  provideService() {
    return {
      setAttachContext: (context) => {
        if (this.panel) {
          this.panel.setAttachContext(context);
          this.panel.focus();
          return true;
        }
        return false;
      },
      clearAttachContext: () => {
        this.panel?.clearAttachContext();
      },
      hasPanel: () => !!this.panel,
    };
  },
};
