/** @babel */

import { Emitter } from "atom";
import { spawn } from "child_process";

/**
 * ClaudeConnection manages interactive streaming communication with Claude CLI.
 *
 * Events emitted:
 * - 'session' (sessionId) - Session ID received
 * - 'delta' (text) - Text content delta (for streaming display)
 * - 'thinking' (text) - Thinking content delta
 * - 'tool-use' ({id, name, input}) - Tool use started
 * - 'tool-result' ({toolUseId, content, isError}) - Tool result received
 * - 'permission' (tool) - Permission request
 * - 'usage' (usage) - Token usage update
 * - 'result' (text) - Final result
 * - 'error' (error) - Error occurred
 * - 'exit' (code) - Process exited
 */
export default class ClaudeConnection {
  constructor(options = {}) {
    this.emitter = new Emitter();
    this.process = null;
    this.buffer = "";
    this.sessionId = options.sessionId || null;
    this.permissionMode = options.permissionMode || "default";
    this.thinkingMode =
      options.thinkingMode ??
      atom.config.get("claude-chat.thinkingMode") ??
      false;
  }

  on(event, callback) {
    return this.emitter.on(event, callback);
  }

  isRunning() {
    return this.process !== null && !this.process.killed;
  }

  start(options = {}) {
    if (this.isRunning()) {
      return this.process;
    }

    const projectPaths = options.projectPaths || atom.project.getPaths();
    const cwd = projectPaths[0] || process.cwd();

    const allowedTools =
      atom.config.get("claude-chat.allowedTools") ||
      "Read,Write,Edit,Glob,Grep,Bash";
    const model = atom.config.get("claude-chat.model");
    const permissionMode =
      this.permissionMode || atom.config.get("claude-chat.permissionMode");

    const args = [
      "--output-format",
      "stream-json",
      "--input-format",
      "stream-json",
      "--verbose",
    ];

    if (allowedTools) {
      args.push("--allowedTools", allowedTools);
    }

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

    const claudePath = atom.config.get("claude-chat.claudePath") || "claude";

    this.process = spawn(claudePath, args, {
      shell: true,
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.setupHandlers();
    return this.process;
  }

  setupHandlers() {
    this.buffer = "";

    // Handle stdout - process lines immediately for streaming
    this.process.stdout.on("data", (chunk) => {
      this.buffer += chunk.toString();

      // Process complete lines immediately
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
      this.emitter.emit("exit", code);
    });

    // Handle error
    this.process.on("error", (err) => {
      this.process = null;
      this.emitter.emit(
        "error",
        new Error(`Failed to run Claude CLI: ${err.message}`)
      );
    });
  }

  handleEvent(event) {
    // Store session ID
    if (event.session_id && event.session_id !== this.sessionId) {
      this.sessionId = event.session_id;
      this.emitter.emit("session", event.session_id);
    }

    switch (event.type) {
      case "content_block_delta":
        // Stream text deltas immediately
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
        // Full assistant message - extract text and tool use
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
        // Tool result or echoed user message
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
        // System init events
        break;
    }
  }

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

  sendPermission(response) {
    if (!this.isRunning()) return;

    const message = JSON.stringify({
      type: "control",
      permission_response: response, // 'allow' or 'deny'
    });

    this.process.stdin.write(message + "\n");
  }

  kill() {
    if (this.process) {
      try {
        this.process.kill("SIGKILL");
      } catch (e) {
        // Process may already be terminated
      }
      this.process = null;
    }
  }

  destroy() {
    this.kill();
    this.emitter.dispose();
  }
}
