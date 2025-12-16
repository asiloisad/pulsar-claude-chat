/** @babel */

import { CompositeDisposable } from "atom";
import ChatPanel from "./chat-panel";
import HistoryList from "./history-list";
import SlashList from "./slash-list";
import Config from "./utils/config";
import { getRelativePath } from "./utils/paths";
import { listSessions, loadSession, clearAllSessions } from "./session-store";
import { startBridge, stopBridge } from "./pulsar-mcp/bridge";

const MCP_PORTS_KEY = "claude-chat-mcp-ports";

/**
 * Get list of ports currently in use by other windows
 */
function getUsedPorts() {
  try {
    const data = window.localStorage.getItem(MCP_PORTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Register a port as in use
 */
function registerPort(port) {
  const ports = getUsedPorts();
  if (!ports.includes(port)) {
    ports.push(port);
    window.localStorage.setItem(MCP_PORTS_KEY, JSON.stringify(ports));
  }
}

/**
 * Unregister a port when window closes
 */
function unregisterPort(port) {
  const ports = getUsedPorts().filter((p) => p !== port);
  window.localStorage.setItem(MCP_PORTS_KEY, JSON.stringify(ports));
}

/**
 * Find next available port starting from base
 */
function findAvailablePort(basePort) {
  const usedPorts = getUsedPorts();
  let port = basePort;
  while (usedPorts.includes(port)) {
    port++;
  }
  return port;
}

export default {
  subscriptions: null,
  panel: null,
  historyList: null,
  slashList: null,
  mcpBridge: null,
  mcpBridgePort: null,

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
      })
    );

    // Start MCP bridge
    this.startMcpBridge();
  },

  deactivate() {
    this.subscriptions?.dispose();
    this.historyList?.destroy();
    this.slashList?.destroy();
    this.panel?.destroy();
    this.panel = null;

    // Stop MCP bridge
    this.stopMcpBridge();
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
    const location = Config.panelPosition();
    const uri = this.panel?.getURI() || `${ChatPanel.URI_PREFIX}/panel`;
    const item = await atom.workspace.toggle(uri, { location });
    if (item) {
      requestAnimationFrame(() => this.panel?.focus());
    }
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

    const sessionData = await loadSession(sessionId);
    if (!sessionData) {
      atom.notifications.addError("Failed to load session.");
      return;
    }

    const location = Config.panelPosition();
    this.panel = new ChatPanel(sessionData);

    await atom.workspace.open(this.panel, { location });
    requestAnimationFrame(() => this.panel?.focus());
  },

  async openAndAttach(context) {
    const location = Config.panelPosition();
    const uri = this.panel?.getURI() || `${ChatPanel.URI_PREFIX}/panel`;
    await atom.workspace.open(uri, { location });
    this.panel?.setAttachContext(context);
    this.panel?.focus();
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
    const relativePath = getRelativePath(filePath);

    this.openAndAttach({
      type: "selection",
      paths: [relativePath],
      line: cursor.row + 1,
      selection,
      label: `${relativePath}:${cursor.row + 1}`,
      icon: "code",
    });
  },

  attachFile(event) {
    const editor = event.currentTarget.getModel();
    if (!editor) return;

    const filePath = editor.getPath();
    if (!filePath) return;

    const relativePath = getRelativePath(filePath);

    this.openAndAttach({
      type: "paths",
      paths: [relativePath],
      label: relativePath,
      icon: "file",
    });
  },

  attachPosition(event) {
    const editor = event.currentTarget.getModel();
    if (!editor) return;

    const filePath = editor.getPath();
    if (!filePath) return;

    const cursor = editor.getCursorBufferPosition();
    const relativePath = getRelativePath(filePath);

    this.openAndAttach({
      type: "position",
      paths: [relativePath],
      line: cursor.row + 1,
      column: cursor.column + 1,
      label: `${relativePath}:${cursor.row + 1}`,
      icon: "location",
    });
  },

  attachPaths() {
    const treeView = atom.packages
      .getActivePackage("tree-view")
      ?.mainModule?.getTreeViewInstance?.();
    if (!treeView) return;

    const selectedPaths = treeView.selectedPaths();
    if (!selectedPaths || selectedPaths.length === 0) return;

    const relativePaths = selectedPaths.map((p) => getRelativePath(p));
    const isMultiple = relativePaths.length > 1;

    this.openAndAttach({
      type: "paths",
      paths: relativePaths,
      label: isMultiple ? `${relativePaths.length} paths` : relativePaths[0],
      icon: isMultiple ? "list-unordered" : "file-directory",
    });
  },

  // MCP Bridge management
  startMcpBridge() {
    try {
      const basePort = atom.config.get("claude-chat.mcpBridgePort") || 3000;
      const port = findAvailablePort(basePort);

      this.mcpBridge = startBridge({ port });
      this.mcpBridgePort = port;
      registerPort(port);

      console.log(`[claude-chat] MCP bridge started on port ${port}`);
    } catch (error) {
      console.error("[claude-chat] Failed to start MCP bridge:", error);
      atom.notifications.addError("Failed to start MCP bridge", {
        detail: error.message,
        dismissable: true,
      });
    }
  },

  stopMcpBridge() {
    if (this.mcpBridge) {
      stopBridge(this.mcpBridge)
        .then(() => console.log("[claude-chat] MCP bridge stopped"))
        .catch((err) => console.error("[claude-chat] Error stopping bridge:", err));
      this.mcpBridge = null;
    }

    if (this.mcpBridgePort) {
      unregisterPort(this.mcpBridgePort);
      this.mcpBridgePort = null;
    }
  },

  /**
   * Get the current MCP bridge port (for ClaudeConnection)
   */
  getMcpBridgePort() {
    return this.mcpBridgePort;
  },

  // Service API for other packages
  provideService() {
    return {
      setAttachContext: async (context) => {
        await this.openAndAttach(context);
        return !!this.panel;
      },
      clearAttachContext: () => {
        this.panel?.clearAttachContext();
      },
      hasPanel: () => !!this.panel,
      sendPrompt: async (text, options = {}) => {
        if (!text) return false;

        if (!this.panel) {
          await this.toggle();
        }

        const sent = this.panel.sendPrompt(text, options.attachContext);

        if (sent && options.focus !== false) {
          this.panel.focus();
        }

        return sent;
      },
      onDidReceiveMessage: (callback) => {
        return this.panel?.onDidReceiveMessage(callback);
      },
    };
  },
};
