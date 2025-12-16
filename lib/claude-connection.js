/** @babel */

import { Emitter } from "atom";
import { spawn } from "child_process";
import Config from "./utils/config";

/**
 * Connection states for explicit state machine
 */
const ConnectionState = {
  IDLE: "idle",
  STARTING: "starting",
  RUNNING: "running",
  STOPPING: "stopping",
  ERROR: "error",
};

/**
 * User-friendly error messages for common error codes
 */
const ERROR_MESSAGES = {
  ENOENT: {
    title: "Claude CLI not found",
    getDetail: (path) =>
      `Please check that Claude CLI is installed and the path is correct.\nCurrent path: ${path}`,
  },
  EACCES: {
    title: "Permission denied",
    detail: "Claude CLI exists but is not executable. Check file permissions.",
  },
  EPERM: {
    title: "Operation not permitted",
    detail: "Unable to execute Claude CLI. Check system permissions.",
  },
};

/**
 * ClaudeConnection manages interactive streaming communication with Claude CLI.
 *
 * Events emitted:
 * - 'session' (sessionId) - Session ID received
 * - 'delta' (text) - Text content delta (for streaming display)
 * - 'thinking' (text) - Thinking content delta
 * - 'thinking-start' () - New thinking block started
 * - 'tool-use' ({id, name, input}) - Tool use started
 * - 'tool-result' ({toolUseId, content, isError}) - Tool result received
 * - 'permission' (tool) - Permission request
 * - 'usage' (usage) - Token usage update
 * - 'result' (text) - Final result
 * - 'error' (error) - Error occurred
 * - 'exit' (code) - Process exited
 * - 'state-change' (state) - Connection state changed
 */
export default class ClaudeConnection {
  constructor(options = {}) {
    this.emitter = new Emitter();
    this.process = null;
    this.buffer = "";
    this.sessionId = options.sessionId || null;
    this.permissionMode = options.permissionMode || Config.permissionMode();
    this.thinkingMode = options.thinkingMode ?? Config.thinkingMode();
    this.state = ConnectionState.IDLE;
  }

  /**
   * Subscribe to connection events
   */
  on(event, callback) {
    return this.emitter.on(event, callback);
  }

  /**
   * Get current connection state
   */
  getState() {
    return this.state;
  }

  /**
   * Set connection state and emit event
   */
  setState(newState) {
    if (this.state !== newState) {
      this.state = newState;
      this.emitter.emit("state-change", newState);
    }
  }

  /**
   * Check if the connection is running
   */
  isRunning() {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Start the Claude CLI process
   */
  start(options = {}) {
    if (this.isRunning()) {
      return this.process;
    }

    this.setState(ConnectionState.STARTING);

    const projectPaths = options.projectPaths || atom.project.getPaths();
    const cwd = projectPaths[0] || process.cwd();

    const model = Config.model();
    const permissionMode = this.permissionMode || Config.permissionMode();

    const args = [
      "--output-format", "stream-json",
      "--input-format", "stream-json",
      "--verbose",
    ];

    if (model && model !== "default") {
      args.push("--model", model);
    }

    if (permissionMode && permissionMode !== "default") {
      args.push("--permission-mode", permissionMode);
    }

    if (this.thinkingMode) {
      args.push("--thinking");
    }

    for (const dir of projectPaths) {
      args.push("--add-dir", `"${dir}"`);
    }

    if (this.sessionId) {
      args.push("--resume", this.sessionId);
    }

    const claudePath = Config.claudePath();

    try {
      this.process = spawn(claudePath, args, {
        shell: true,
        cwd,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.setupHandlers();
      this.setState(ConnectionState.RUNNING);
      return this.process;
    } catch (err) {
      this.handleStartError(err, claudePath);
      return null;
    }
  }

  /**
   * Handle errors during process start
   */
  handleStartError(err, claudePath) {
    this.setState(ConnectionState.ERROR);
    this.process = null;

    const errorInfo = ERROR_MESSAGES[err.code] || {
      title: "Failed to start Claude CLI",
      detail: err.message,
    };

    const detail = errorInfo.getDetail
      ? errorInfo.getDetail(claudePath)
      : errorInfo.detail;

    // Emit error for chat panel to display
    this.emitter.emit("error", new Error(`${errorInfo.title}: ${detail}`));

    // Show notification with action button
    atom.notifications.addError(errorInfo.title, {
      detail,
      dismissable: true,
      buttons: [
        {
          text: "Open Settings",
          onDidClick: () => atom.workspace.open("atom://config/packages/claude-chat"),
        },
      ],
    });
  }

  /**
   * Setup event handlers for the process
   */
  setupHandlers() {
    this.buffer = "";

    // Handle stdout - process lines immediately for streaming
    this.process.stdout.on("data", (chunk) => {
      this.buffer += chunk.toString();

      let newlineIndex;
      while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
        const line = this.buffer.slice(0, newlineIndex);
        this.buffer = this.buffer.slice(newlineIndex + 1);

        if (line.trim()) {
          try {
            const event = JSON.parse(line);
            this.handleEvent(event);
          } catch (err) {
            console.log("Claude non-JSON:", line.slice(0, 100));
          }
        }
      }
    });

    // Handle stderr
    this.process.stderr.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg) {
        console.error("Claude CLI stderr:", msg);
        if (msg.includes("No conversation found with session ID")) {
          this.sessionId = null;
          this.kill();
          this.emitter.emit("session-expired");
        }
      }
    });

    // Handle close
    this.process.on("close", (code) => {
      this.process = null;
      this.setState(ConnectionState.IDLE);
      this.emitter.emit("exit", code);
    });

    // Handle error
    this.process.on("error", (err) => {
      this.handleStartError(err, Config.claudePath());
    });
  }

  /**
   * Handle a parsed JSON event from Claude CLI
   */
  handleEvent(event) {
    // Store session ID
    if (event.session_id && event.session_id !== this.sessionId) {
      this.sessionId = event.session_id;
      this.emitter.emit("session", event.session_id);
    }

    switch (event.type) {
      case "content_block_delta":
        if (event.delta?.text) {
          this.emitter.emit("delta", event.delta.text);
        }
        if (event.delta?.thinking) {
          this.emitter.emit("thinking", event.delta.thinking);
        }
        break;

      case "content_block_start":
        if (event.content_block?.type === "tool_use") {
          this.emitter.emit("tool-start", event.content_block.name);
        }
        if (event.content_block?.type === "thinking") {
          this.emitter.emit("thinking-start");
        }
        break;

      case "assistant":
        if (event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === "text" && block.text) {
              this.emitter.emit("assistant-text", block.text);
            }
            if (block.type === "tool_use") {
              this.emitter.emit("tool-use", {
                id: block.id,
                name: block.name,
                input: block.input || {},
              });
            }
          }
        }
        break;

      case "result":
        if (event.usage) {
          this.emitter.emit("usage", {
            input: event.usage.input_tokens || 0,
            output: event.usage.output_tokens || 0,
            cacheRead: event.usage.cache_read_input_tokens || 0,
            cacheCreation: event.usage.cache_creation_input_tokens || 0,
          });
        }
        this.emitter.emit("result", event.result || "");
        break;

      case "usage":
        if (event.usage) {
          this.emitter.emit("usage", {
            input: event.usage.input_tokens || 0,
            output: event.usage.output_tokens || 0,
            cacheRead: event.usage.cache_read_input_tokens || 0,
            cacheCreation: event.usage.cache_creation_input_tokens || 0,
          });
        }
        break;

      case "permission_request":
        this.emitter.emit("permission", event.tool || null);
        break;

      case "user":
        if (event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === "tool_result") {
              this.emitter.emit("tool-result", {
                toolUseId: block.tool_use_id,
                content: block.content,
                isError: block.is_error || false,
              });
            }
          }
        }
        break;

      case "system":
        // System init events - ignore
        break;
    }
  }

  /**
   * Send a prompt to Claude
   */
  send(prompt) {
    if (!this.isRunning()) {
      this.start();
    }

    const message = JSON.stringify({
      type: "user",
      message: { role: "user", content: prompt },
    });

    this.process.stdin.write(message + "\n");
  }

  /**
   * Send a permission response
   */
  sendPermission(response) {
    if (!this.isRunning()) return;

    const message = JSON.stringify({
      type: "control",
      permission_response: response,
    });

    this.process.stdin.write(message + "\n");
  }

  /**
   * Kill the process (graceful by default, force if needed)
   * @param {boolean} graceful - If true, try SIGTERM first, then SIGKILL
   * @param {number} timeout - Timeout in ms before force kill (default: 3000)
   */
  async kill(graceful = true, timeout = 3000) {
    if (!this.process) return;

    this.setState(ConnectionState.STOPPING);

    if (graceful) {
      try {
        // Try graceful termination first
        this.process.kill("SIGTERM");

        // Wait for process to exit gracefully
        await Promise.race([
          new Promise((resolve) => {
            this.process?.once("close", resolve);
          }),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Timeout")), timeout);
          }),
        ]);
      } catch (err) {
        // Force kill if graceful shutdown failed or timed out
        try {
          this.process?.kill("SIGKILL");
        } catch (e) {
          // Process may already be terminated
        }
      }
    } else {
      try {
        this.process.kill("SIGKILL");
      } catch (e) {
        // Process may already be terminated
      }
    }

    this.process = null;
    this.setState(ConnectionState.IDLE);
  }

  /**
   * Destroy the connection and cleanup
   */
  destroy() {
    this.kill(false); // Force kill on destroy
    this.emitter.dispose();
  }
}

export { ConnectionState };
