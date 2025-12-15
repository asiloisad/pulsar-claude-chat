/** @babel */
/** @jsx etch.dom */

import etch from "etch";
import { CompositeDisposable, Emitter, Disposable } from "atom";
import ClaudeConnection from "./claude-connection";
import {
  renderMessages,
  renderStreamingMessage,
  renderPermissionRequest,
  renderWelcomePage,
} from "./message-renderer";
import { saveSession } from "./session-store";

const URI_PREFIX = "atom://claude-chat";

export default class ChatPanel {
  static URI_PREFIX = URI_PREFIX;

  static deserialize(state) {
    return new ChatPanel(state);
  }

  constructor(props = {}) {
    this.props = props;
    this.messages = props.messages || [];
    this.sessionId = props.sessionId || null;

    // Ensure all tool messages have an id (for sessions saved before id was added)
    let idCounter = 0;
    for (const msg of this.messages) {
      if (msg.role === "tool" && !msg.id) {
        msg.id = `legacy-${idCounter++}`;
      }
    }
    this.isLoading = false;
    this.pendingPermission = null;

    // Permission mode for this chat
    this.permissionMode =
      props.permissionMode ||
      atom.config.get("claude-chat.permissionMode") ||
      "default";

    // Session metadata
    this.projectPaths = props.projectPaths || atom.project.getPaths();
    this.createdAt = props.createdAt || new Date().toISOString();
    this.tokenUsage = props.tokenUsage || { input: 0, output: 0 };

    // Streaming state
    this.currentText = "";
    this.pendingDelta = "";
    this.updateScheduled = false;
    this.highlightTimer = null;

    // Thinking state
    this.thinkingMode =
      props.thinkingMode ??
      atom.config.get("claude-chat.thinkingMode") ??
      false;
    this.currentThinking = "";
    this.pendingThinkingDelta = "";

    // Attach context (selection, file, or paths from tree-view)
    this.attachContext = null;

    // Create connection
    this.connection = new ClaudeConnection({
      sessionId: this.sessionId,
      permissionMode: this.permissionMode,
      thinkingMode: this.thinkingMode,
    });

    this.emitter = new Emitter();
    this.disposables = new CompositeDisposable();

    // Tool handlers for renderers
    this.toolHandlers = {
      toggle: (id) => this.toggleToolCollapse(id),
      openFile: (filePath, line) => this.handleOpenFile(filePath, line),
    };

    this.tooltipDisposables = new CompositeDisposable();

    etch.initialize(this);
    this.setupConnection();
    this.setupEditor();
    this.setupCommands();

    // Initialize tooltips
    this.updateTooltips();

    // Scroll to bottom and apply syntax highlighting after render (for restored sessions)
    requestAnimationFrame(() => {
      this.scrollToBottom();
      this.applySyntaxHighlighting();
    });
  }

  updateTooltips() {
    this.tooltipDisposables.dispose();
    this.tooltipDisposables = new CompositeDisposable();

    // Permission buttons with keyboard shortcuts
    const permissionModes = [
      { value: "default", label: "Default: Ask for permissions", key: "1" },
      { value: "plan", label: "Plan: Read-only", key: "2" },
      { value: "acceptEdits", label: "Accept Edits: Auto-apply changes", key: "3" },
      { value: "bypassPermissions", label: "Bypass: Auto-approve all", key: "4" },
    ];

    permissionModes.forEach((mode) => {
      const el = this.refs[`permission-${mode.value}`];
      if (el) {
        this.tooltipDisposables.add(
          atom.tooltips.add(el, {
            title: `${mode.label} <span class="keystroke">Ctrl+${mode.key}</span>`,
            html: true,
          })
        );
      }
    });

    // Send/Stop button
    if (this.refs.sendBtn) {
      this.tooltipDisposables.add(
        atom.tooltips.add(this.refs.sendBtn, {
          title: 'Send message <span class="keystroke">Enter</span>',
          html: true,
        })
      );
    }
    if (this.refs.stopBtn) {
      this.tooltipDisposables.add(
        atom.tooltips.add(this.refs.stopBtn, { title: "Stop generation" })
      );
    }

    // Thinking toggle button
    if (this.refs.thinkingBtn) {
      this.tooltipDisposables.add(
        atom.tooltips.add(this.refs.thinkingBtn, {
          title: 'Extended thinking <span class="keystroke">Ctrl+0</span>',
          html: true,
        })
      );
    }

    // Attach indicator - show context details in tooltip
    if (this.refs.attachIndicator && this.attachContext) {
      const ctx = this.attachContext;
      let tooltipText = "";

      if (ctx.type === "selection") {
        tooltipText = `Selection from ${ctx.paths[0]}:${ctx.line}\n${ctx.selection.length} characters`;
      } else if (ctx.type === "position") {
        tooltipText = `Position: ${ctx.paths[0]}:${ctx.line}:${ctx.column}`;
      } else if (ctx.type === "paths") {
        tooltipText =
          ctx.paths.length === 1
            ? `Path: ${ctx.paths[0]}`
            : `Paths:\n${ctx.paths.join("\n")}`;
      }

      this.tooltipDisposables.add(
        atom.tooltips.add(this.refs.attachIndicator, { title: tooltipText })
      );
    }

    // Add tooltips for elements with data-tooltip attribute
    const tooltipElements = this.element.querySelectorAll("[data-tooltip]");
    tooltipElements.forEach((el) => {
      const title = el.getAttribute("data-tooltip");
      if (title) {
        this.tooltipDisposables.add(atom.tooltips.add(el, { title }));
      }
    });
  }

  /**
   * Schedule syntax highlighting with debounce (for streaming performance)
   */
  scheduleSyntaxHighlighting() {
    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
    }
    this.highlightTimer = setTimeout(() => {
      this.highlightTimer = null;
      this.applySyntaxHighlighting();
    }, 300);
  }

  /**
   * Apply Pulsar syntax highlighting to code blocks in markdown content only
   */
  applySyntaxHighlighting() {
    if (!this.refs.messagesContainer) return;

    // Mark tool pre elements as "skip" so Pulsar ignores them
    const toolPreElements = this.refs.messagesContainer.querySelectorAll(
      ".tool-result:not([data-highlighted]), .tool-content:not([data-highlighted])"
    );
    for (const pre of toolPreElements) {
      pre.setAttribute("data-highlighted", "skip");
    }

    // Find unprocessed code blocks in markdown content
    const preElements = this.refs.messagesContainer.querySelectorAll(
      ".message-markdown pre:not([data-highlighted])"
    );
    if (preElements.length === 0) return;

    // Note: Don't mark elements before calling applySyntaxHighlighting
    // as Pulsar checks data-highlighted to skip elements

    // Apply highlighting
    atom.ui.markdown
      .applySyntaxHighlighting(this.refs.messagesContainer, {
        renderMode: "full",
        syntaxScopeNameFunc: (lang) => {
          // Map common language names to grammar scopes
          const langMap = {
            js: "source.js",
            javascript: "source.js",
            ts: "source.ts",
            typescript: "source.ts",
            jsx: "source.js.jsx",
            tsx: "source.tsx",
            json: "source.json",
            html: "text.html.basic",
            css: "source.css",
            less: "source.css.less",
            scss: "source.css.scss",
            python: "source.python",
            py: "source.python",
            ruby: "source.ruby",
            rb: "source.ruby",
            java: "source.java",
            c: "source.c",
            cpp: "source.cpp",
            "c++": "source.cpp",
            csharp: "source.cs",
            cs: "source.cs",
            go: "source.go",
            rust: "source.rust",
            rs: "source.rust",
            php: "source.php",
            shell: "source.shell",
            bash: "source.shell",
            sh: "source.shell",
            sql: "source.sql",
            yaml: "source.yaml",
            yml: "source.yaml",
            xml: "text.xml",
            markdown: "source.gfm",
            md: "source.gfm",
            coffee: "source.coffee",
            coffeescript: "source.coffee",
            sofistik: "source.sofistik",
          };
          if (!lang) return "text.plain";
          return langMap[lang.toLowerCase()] || `source.${lang}`;
        },
      })
      .then(() => {
        // Mark as complete
        for (const pre of preElements) {
          pre.setAttribute("data-highlighted", "true");
        }
      })
      .catch((err) => {
        console.warn("Syntax highlighting failed:", err);
      });
  }

  setupConnection() {
    // Session ID
    this.disposables.add(
      this.connection.on("session", (id) => {
        this.sessionId = id;
      })
    );

    // Streaming text - throttled via requestAnimationFrame
    this.disposables.add(
      this.connection.on("delta", (text) => {
        this.pendingDelta += text;
        this.scheduleUpdate();
      })
    );

    // Thinking content - streamed
    this.disposables.add(
      this.connection.on("thinking", (text) => {
        this.pendingThinkingDelta += text;
        this.scheduleUpdate();
      })
    );

    // Thinking block started
    this.disposables.add(
      this.connection.on("thinking-start", () => {
        // Reset thinking content for new thinking block
        this.currentThinking = "";
        this.pendingThinkingDelta = "";
      })
    );

    // Full text from assistant event (when streaming not available)
    this.disposables.add(
      this.connection.on("assistant-text", (text) => {
        const wasNearBottom = this.isNearBottom();
        // Text will be finalized before the next tool-use event
        this.currentText = text;
        etch.update(this).then(() => {
          if (wasNearBottom) this.scrollToBottom();
        });
      })
    );

    // Tool use
    this.disposables.add(
      this.connection.on("tool-use", ({ id, name, input }) => {
        const wasNearBottom = this.isNearBottom();
        // Finalize any pending text before adding tool
        if (this.currentText) {
          this.messages.push({
            role: "assistant",
            content: this.currentText,
          });
          this.currentText = "";
        }
        // TodoWrite starts expanded, others collapsed
        const collapsed = name !== "TodoWrite";
        this.messages.push({
          role: "tool",
          id,
          name,
          input,
          result: null,
          collapsed,
        });
        etch.update(this).then(() => {
          if (wasNearBottom) this.scrollToBottom();
        });
      })
    );

    // Tool result
    this.disposables.add(
      this.connection.on("tool-result", ({ toolUseId, content, isError }) => {
        const wasNearBottom = this.isNearBottom();
        // Find matching tool message by id
        const toolMsg = this.messages.find(
          (m) => m.role === "tool" && m.id === toolUseId
        );
        if (toolMsg) {
          toolMsg.result = content;
          toolMsg.isError = isError;
          etch.update(this).then(() => {
            if (wasNearBottom) this.scrollToBottom();
          });
        }
      })
    );

    // Permission request
    this.disposables.add(
      this.connection.on("permission", (tool) => {
        const wasNearBottom = this.isNearBottom();
        this.pendingPermission = tool;
        etch.update(this).then(() => {
          if (wasNearBottom) this.scrollToBottom();
        });
      })
    );

    // Result (response complete)
    this.disposables.add(
      this.connection.on("result", (resultText) => {
        const wasNearBottom = this.isNearBottom();
        const finalText = this.currentText || resultText;
        if (finalText) {
          const message = {
            role: "assistant",
            content: finalText,
          };
          // Include thinking content if present
          if (this.currentThinking) {
            message.thinking = this.currentThinking;
          }
          this.messages.push(message);
          this.currentText = "";
          this.currentThinking = "";
        }
        this.isLoading = false;
        etch.update(this).then(() => {
          if (wasNearBottom) this.scrollToBottom();
        });
      })
    );

    // Usage
    this.disposables.add(
      this.connection.on("usage", (usage) => {
        this.tokenUsage.input += usage.input;
        this.tokenUsage.output += usage.output;
        etch.update(this);
      })
    );

    // Error
    this.disposables.add(
      this.connection.on("error", (error) => {
        const wasNearBottom = this.isNearBottom();
        this.messages.push({
          role: "error",
          content: error.message,
        });
        this.isLoading = false;
        this.currentText = "";
        this.currentThinking = "";
        etch.update(this).then(() => {
          if (wasNearBottom) this.scrollToBottom();
        });
      })
    );

    // Exit
    this.disposables.add(
      this.connection.on("exit", (code) => {
        if (code !== 0 && this.isLoading) {
          this.isLoading = false;
          this.currentText = "";
          this.currentThinking = "";
          etch.update(this);
        }
      })
    );
  }

  setupEditor() {
    this.promptEditor = atom.workspace.buildTextEditor({
      mini: false,
      softWrapped: true,
      lineNumberGutterVisible: false,
      placeholderText: "Ask Claude something...",
    });

    this.promptEditor.gutterWithName("line-number")?.hide();

    requestAnimationFrame(() => {
      if (this.refs.editorContainer) {
        this.refs.editorContainer.appendChild(this.promptEditor.element);
      }
    });
  }

  setupCommands() {
    // Commands for the prompt editor
    this.disposables.add(
      atom.commands.add(this.promptEditor.element, {
        "claude-chat:send": () => this.handleSend(),
        "claude-chat:stop": () => this.handleStop(),
        "claude-chat:clear-prompt": () => this.handleClear(),
        "claude-chat:toggle-thinking": () => this.handleThinkingToggle(),
        "claude-chat:show-usage": () => this.showTokenUsage(),
        "claude-chat:mode-default": () => this.handlePermissionModeChange("default"),
        "claude-chat:mode-plan": () => this.handlePermissionModeChange("plan"),
        "claude-chat:mode-accept-edits": () => this.handlePermissionModeChange("acceptEdits"),
        "claude-chat:mode-bypass": () => this.handlePermissionModeChange("bypassPermissions"),
      })
    );

    // Commands for the panel container
    this.disposables.add(
      atom.commands.add(this.element, {
        "claude-chat:copy": () => this.handleCopy(),
        "claude-chat:copy-message": (e) => this.handleCopyMessage(e),
        "claude-chat:expand-all": () => this.expandAllTools(),
        "claude-chat:collapse-all": () => this.collapseAllTools(),
        "claude-chat:clear-messages": () => this.clearMessages(),
        "core:copy": () => this.handleCopy(),
        "core:close": () => this.handleClose(),
      })
    );
  }

  handleCopy() {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      atom.clipboard.write(selection.toString());
    }
  }

  handleCopyMessage(event) {
    const target = event.target;
    const messageEl = target.closest(".message-content, .tool-content, .tool-result");
    if (messageEl) {
      atom.clipboard.write(messageEl.textContent);
      atom.notifications.addSuccess("Copied to clipboard", { dismissable: true });
    }
  }

  handleClose() {
    const pane = atom.workspace.paneForItem(this);
    if (pane) {
      pane.destroyItem(this);
    }
  }

  showTokenUsage() {
    const total = this.tokenUsage.input + this.tokenUsage.output;
    atom.notifications.addInfo("Token Usage", {
      detail: `Input: ${this.tokenUsage.input.toLocaleString()}\nOutput: ${this.tokenUsage.output.toLocaleString()}\nTotal: ${total.toLocaleString()}`,
      dismissable: true,
    });
  }

  scheduleUpdate() {
    if (this.updateScheduled) return;
    this.updateScheduled = true;

    const wasNearBottom = this.isNearBottom();
    requestAnimationFrame(() => {
      this.currentText += this.pendingDelta;
      this.pendingDelta = "";
      this.currentThinking += this.pendingThinkingDelta;
      this.pendingThinkingDelta = "";
      this.updateScheduled = false;
      etch.update(this).then(() => {
        if (wasNearBottom) this.scrollToBottom();
      });
    });
  }

  isNearBottom() {
    const container = this.refs.messagesContainer;
    if (!container) return true;
    const threshold = 100; // pixels from bottom
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold
    );
  }

  scrollToBottom() {
    if (this.refs.messagesContainer) {
      this.refs.messagesContainer.scrollTop = this.refs.messagesContainer.scrollHeight;
    }
  }

  scrollToBottomIfNeeded() {
    if (this.isNearBottom()) {
      this.scrollToBottom();
    }
  }

  // Tool interaction handlers
  toggleToolCollapse(id) {
    const msg = this.messages.find((m) => m.role === "tool" && m.id === id);
    if (msg) {
      msg.collapsed = !msg.collapsed;
      etch.update(this);
    }
  }

  expandAllTools() {
    for (const msg of this.messages) {
      if (msg.role === "tool") {
        msg.collapsed = false;
      }
    }
    etch.update(this);
  }

  collapseAllTools() {
    for (const msg of this.messages) {
      if (msg.role === "tool") {
        msg.collapsed = true;
      }
    }
    etch.update(this);
  }

  handleOpenFile(filePath, line) {
    if (!filePath) return;
    const options = {};
    if (line) options.initialLine = parseInt(line, 10) - 1;
    atom.workspace.open(filePath, options).catch(() => {
      atom.notifications.addWarning(`Could not open: ${filePath}`);
    });
  }

  // Attach context methods
  setAttachContext(context) {
    this.attachContext = context;
    this.update();
  }

  clearAttachContext() {
    this.attachContext = null;
    this.update();
  }

  // Format attach context for sending to Claude
  formatAttachContext() {
    if (!this.attachContext) return "";

    const { type, paths, line, column, selection } = this.attachContext;

    if (type === "selection" && selection) {
      return `<attach type="selection" file="${paths[0]}" line="${line}">\n${selection}\n</attach>\n\n`;
    } else if (type === "position") {
      return `<attach type="position" file="${paths[0]}" line="${line}" column="${column}" />\n\n`;
    } else if (type === "image") {
      const file = paths[0];
      if (selection && typeof selection === "object") {
        const { x1, y1, x2, y2 } = selection;
        return `<image file="${file}">\nSelected region: (${x1}, ${y1}) to (${x2}, ${y2}) pixels\n</image>\n\n`;
      }
      return `<image file="${file}" />\n\n`;
    } else if (type === "paths") {
      const pathList = paths.join("\n");
      return `<attach type="paths">\n${pathList}\n</attach>\n\n`;
    }
    return "";
  }

  // Action handlers
  handleSend() {
    const text = this.promptEditor.getText().trim();
    if (!text || this.isLoading) return;

    // Prepend attach context if present
    const attachPrefix = this.formatAttachContext();
    const fullMessage = attachPrefix + text;

    // Store message with attach context for display
    const message = { role: "user", content: text };
    if (this.attachContext) {
      message.attach = { ...this.attachContext };
    }
    this.messages.push(message);

    this.promptEditor.setText("");
    this.isLoading = true;
    this.currentText = "";
    this.attachContext = null; // Clear attach after send

    etch.update(this).then(() => this.scrollToBottom());
    this.connection.send(fullMessage); // Send with attach context
    this.focus(); // Keep focus on prompt editor
  }

  handlePermission(response) {
    this.connection.sendPermission(response);
    this.pendingPermission = null;
    etch.update(this);
  }

  handleStop() {
    this.connection.kill();
    this.isLoading = false;
    this.currentText = "";
    this.currentThinking = "";
    etch.update(this);
  }

  handleClear() {
    this.promptEditor?.setText("");
    this.clearAttachContext();
  }

  clearMessages() {
    this.messages = [];
    etch.update(this);
  }

  handleThinkingToggle() {
    this.thinkingMode = !this.thinkingMode;

    // Restart connection with new thinking mode if it's running
    if (this.connection.isRunning()) {
      this.connection.kill();
    }

    // Create new connection with updated thinking mode
    this.connection.destroy();
    this.connection = new ClaudeConnection({
      sessionId: this.sessionId,
      permissionMode: this.permissionMode,
      thinkingMode: this.thinkingMode,
    });
    this.setupConnection();

    etch.update(this);
  }

  handlePermissionModeChange(mode) {
    if (this.permissionMode === mode) return;

    this.permissionMode = mode;

    // Restart connection with new permission mode if it's running
    if (this.connection.isRunning()) {
      this.connection.kill();
    }

    // Create new connection with updated permission mode
    this.connection.destroy();
    this.connection = new ClaudeConnection({
      sessionId: this.sessionId,
      permissionMode: this.permissionMode,
      thinkingMode: this.thinkingMode,
    });
    this.setupConnection();

    etch.update(this);
  }

  // Render
  render() {
    const isStreaming = this.isLoading || this.currentText;
    const isEmpty = this.messages.length === 0 && !isStreaming;

    const permissionModes = [
      { value: "default", label: "Default: Ask for permissions" },
      { value: "plan", label: "Plan: Read-only" },
      { value: "acceptEdits", label: "Accept Edits: Auto-apply changes" },
      { value: "bypassPermissions", label: "Bypass: Auto-approve all" },
    ];

    return (
      <div className="claude-chat" tabIndex="-1">
        <div className="claude-chat-messages" ref="messagesContainer">
          {isEmpty ? renderWelcomePage() : null}
          {!isEmpty ? renderMessages(this.messages, this.toolHandlers, isStreaming) : null}
          {renderStreamingMessage(
            this.currentText,
            this.isLoading,
            this.currentThinking
          )}
          {renderPermissionRequest(this.pendingPermission, (r) =>
            this.handlePermission(r)
          )}
        </div>
        <div className="claude-chat-input">
          <div className="editor-container" ref="editorContainer" />
          <div className="claude-chat-toolbar">
            {this.attachContext ? (
              <span
                ref="attachIndicator"
                className="attach-indicator"
                on={{ click: () => this.clearAttachContext() }}
              >
                <span
                  className={`icon-${this.attachContext.icon || "mention"}`}
                ></span>
                <span className="attach-label">{this.attachContext.label}</span>
              </span>
            ) : null}
            <div className="toolbar-actions">
              <div className="btn-group permission-mode">
                {permissionModes.map((mode) => {
                  let icon = "shield";
                  if (mode.value === "plan") icon = "list-unordered";
                  if (mode.value === "acceptEdits") icon = "pencil";
                  if (mode.value === "bypassPermissions") icon = "key";

                  return (
                    <button
                      ref={`permission-${mode.value}`}
                      className={`btn icon icon-${icon} ${
                        mode.value === this.permissionMode ? "selected" : ""
                      }`}
                      on={{
                        click: () =>
                          this.handlePermissionModeChange(mode.value),
                      }}
                    />
                  );
                })}
              </div>
              <div className="btn-group send-group">
                <button
                  ref="thinkingBtn"
                  className={`btn icon icon-light-bulb ${
                    this.thinkingMode ? "selected" : ""
                  }`}
                  on={{ click: () => this.handleThinkingToggle() }}
                />
                {this.isLoading ? (
                  <button
                    ref="stopBtn"
                    className="btn btn-error icon icon-primitive-square"
                    on={{ click: () => this.handleStop() }}
                  />
                ) : (
                  <button
                    ref="sendBtn"
                    className="btn btn-primary icon icon-triangle-right"
                    on={{ click: () => this.handleSend() }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Workspace item methods
  getTitle() {
    return "Claude Chat";
  }

  getIconName() {
    return "comment-discussion";
  }

  getURI() {
    // Include sessionId in URI so each session is uniquely identifiable
    if (this.sessionId) {
      return `${URI_PREFIX}/session/${this.sessionId}`;
    }
    return `${URI_PREFIX}/panel`;
  }

  getDefaultLocation() {
    return atom.config.get("claude-chat.panelPosition");
  }

  getAllowedLocations() {
    return ["left", "right", "bottom", "center"];
  }

  getElement() {
    return this.element;
  }

  onDidChangeTitle(callback) {
    if (this.emitter.disposed) {
      return new Disposable();
    }
    return this.emitter.on("did-change-title", callback);
  }

  serialize() {
    return {
      deserializer: "claude-chat/ChatPanel",
      messages: this.messages,
      sessionId: this.sessionId,
      projectPaths: this.projectPaths,
      createdAt: this.createdAt,
      tokenUsage: this.tokenUsage,
      permissionMode: this.permissionMode,
      thinkingMode: this.thinkingMode,
    };
  }

  update(props) {
    if (props) {
      Object.assign(this.props, props);
    }
    return etch.update(this).then(() => {
      this.updateTooltips();
      // Use debounced highlighting during streaming for better performance
      if (this.isLoading) {
        this.scheduleSyntaxHighlighting();
      } else {
        this.applySyntaxHighlighting();
      }
    });
  }

  focus() {
    this.promptEditor?.element?.focus();
  }

  async destroy() {
    // Save session before destroying
    await this.saveCurrentSession();

    // Clear pending timers
    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
      this.highlightTimer = null;
    }

    this.connection?.destroy();
    this.disposables?.dispose();
    this.tooltipDisposables?.dispose();
    this.emitter?.dispose();
    this.promptEditor?.destroy();
    await etch.destroy(this);
  }

  /**
   * Save current session to disk
   */
  async saveCurrentSession() {
    // Only save if we have a session ID and messages
    if (!this.sessionId || this.messages.length === 0) return;

    // Get first user message for preview
    const firstUserMsg = this.messages.find((m) => m.role === "user");
    const firstMessage = firstUserMsg?.content || "";

    try {
      await saveSession({
        sessionId: this.sessionId,
        projectPaths: this.projectPaths,
        createdAt: this.createdAt,
        firstMessage,
        messages: this.messages,
        tokenUsage: this.tokenUsage,
        permissionMode: this.permissionMode,
      });
    } catch (err) {
      console.error("Failed to save session:", err);
    }
  }
}
