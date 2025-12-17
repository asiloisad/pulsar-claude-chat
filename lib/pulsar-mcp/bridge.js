/**
 * HTTP Bridge server for Pulsar MCP
 * Runs inside Pulsar and provides direct access to atom APIs
 */

const crypto = require("crypto");
const http = require("http");
const { URL } = require("url");
const { tools } = require("./tools");
const { validators, defineTool, executeFromRegistry } = require("./tool-registry");
const { createLogger } = require("../utils/log");

const log = createLogger("MCP");

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "127.0.0.1";
const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "pulsar-mcp";
const SERVER_VERSION = "1.0.0";

// Session storage for MCP connections
const sessions = new Map();

// ============================================================================
// Tool Implementations
// ============================================================================

const toolImpls = {
  getActiveEditor() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return null;

    const cursor = editor.getCursorBufferPosition();
    return {
      path: editor.getPath() || null,
      content: editor.getText(),
      cursorPosition: { row: cursor.row, column: cursor.column },
      grammar: editor.getGrammar()?.name || "Plain Text",
      modified: editor.isModified(),
    };
  },

  getSelection() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return null;

    const selection = editor.getLastSelection();
    if (!selection || selection.isEmpty()) return null;

    const range = selection.getBufferRange();
    return {
      text: selection.getText(),
      range: {
        start: { row: range.start.row, column: range.start.column },
        end: { row: range.end.row, column: range.end.column },
      },
    };
  },

  insertText({ text }) {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return false;
    editor.insertText(text);
    return true;
  },

  replaceSelection({ text }) {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return false;

    const selection = editor.getLastSelection();
    if (!selection) return false;

    selection.insertText(text);
    return true;
  },

  async openFile({ path, line, column }) {
    const options = {};
    if (line !== undefined) {
      options.initialLine = line - 1;
      if (column !== undefined) {
        options.initialColumn = column - 1;
      }
    }
    await atom.workspace.open(path, options);
    return true;
  },

  goToPosition({ line, column = 1 }) {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return false;

    editor.setCursorBufferPosition([line - 1, column - 1]);
    editor.scrollToCursorPosition({ center: true });
    return true;
  },

  getOpenEditors() {
    const editors = atom.workspace.getTextEditors();
    const activeEditor = atom.workspace.getActiveTextEditor();

    return editors.map((editor) => ({
      path: editor.getPath() || null,
      modified: editor.isModified(),
      active: editor === activeEditor,
    }));
  },

  getProjectPaths() {
    return atom.project.getPaths();
  },

  async saveFile({ path }) {
    if (path) {
      const editor = atom.workspace.getTextEditors().find((e) => e.getPath() === path);
      if (!editor) return false;
      await editor.save();
      return true;
    }

    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return false;

    await editor.save();
    return true;
  },

  setSelections({ ranges }) {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return false;

    const bufferRanges = ranges.map((r) => [
      [r.startRow, r.startColumn],
      [r.endRow, r.endColumn],
    ]);
    editor.setSelectedBufferRanges(bufferRanges);
    return true;
  },

  getAllSelections() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return null;

    return editor.getSelections().map((selection) => {
      const range = selection.getBufferRange();
      return {
        text: selection.getText(),
        isEmpty: selection.isEmpty(),
        range: {
          start: { row: range.start.row, column: range.start.column },
          end: { row: range.end.row, column: range.end.column },
        },
      };
    });
  },

  async revealInTreeView({ path }) {
    const target = atom.views.getView(atom.workspace);
    await atom.commands.dispatch(target, "tree-view:reveal-active-file");

    if (path) {
      await atom.workspace.open(path, { activatePane: true });
      await atom.commands.dispatch(target, "tree-view:reveal-active-file");
    }
    return true;
  },

  async closeFile({ path, save = false }) {
    let editor, pane;

    if (path) {
      editor = atom.workspace.getTextEditors().find((e) => e.getPath() === path);
      if (!editor) return false;
      pane = atom.workspace.paneForItem(editor);
    } else {
      editor = atom.workspace.getActiveTextEditor();
      if (!editor) return false;
      pane = atom.workspace.getActivePane();
    }

    if (save && editor.isModified()) {
      await editor.save();
    }

    pane.destroyItem(editor, true);
    return true;
  },

  async splitPane({ direction, path }) {
    const pane = atom.workspace.getActivePane();
    const splitMethods = {
      left: "splitLeft",
      right: "splitRight",
      up: "splitUp",
      down: "splitDown",
    };

    const method = splitMethods[direction];
    if (!method) return false;

    const newPane = pane[method]();

    if (path) {
      await atom.workspace.open(path, { pane: newPane });
    }
    return true;
  },

  async closePane({ saveAll = false }) {
    const pane = atom.workspace.getActivePane();
    if (!pane) return false;

    if (saveAll) {
      for (const item of pane.getItems()) {
        if (item.isModified?.() && item.save) {
          await item.save();
        }
      }
    }

    pane.destroy();
    return true;
  },

  getPanelState() {
    const getDockInfo = (dock) => ({
      visible: dock.isVisible(),
      items: dock.getPaneItems().length,
    });

    return {
      left: getDockInfo(atom.workspace.getLeftDock()),
      right: getDockInfo(atom.workspace.getRightDock()),
      bottom: getDockInfo(atom.workspace.getBottomDock()),
      panes: {
        count: atom.workspace.getPanes().length,
        activeIndex: atom.workspace.getPanes().indexOf(atom.workspace.getActivePane()),
      },
    };
  },

  undo() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return false;
    editor.undo();
    return true;
  },

  redo() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return false;
    editor.redo();
    return true;
  },

  findText({ pattern, isRegex = false, caseSensitive = true }) {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return null;

    const matches = [];
    const flags = caseSensitive ? "g" : "gi";
    const regex = isRegex ? new RegExp(pattern, flags) : new RegExp(escapeRegExp(pattern), flags);

    editor.getBuffer().scan(regex, ({ match, range }) => {
      matches.push({
        text: match[0],
        range: {
          start: { row: range.start.row, column: range.start.column },
          end: { row: range.end.row, column: range.end.column },
        },
        line: range.start.row + 1,
        column: range.start.column + 1,
      });
    });

    return { matches, count: matches.length };
  },

  getContextAround({ pattern, matchIndex = 0, linesBefore = 3, linesAfter = 3, isRegex = false }) {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return null;

    const regex = isRegex ? new RegExp(pattern) : new RegExp(escapeRegExp(pattern));
    const matches = [];

    editor.getBuffer().scan(regex, ({ match, range }) => {
      matches.push({ text: match[0], range });
    });

    if (matchIndex >= matches.length) {
      return { error: `Match index ${matchIndex} out of range (found ${matches.length} matches)` };
    }

    const targetMatch = matches[matchIndex];
    const matchRow = targetMatch.range.start.row;
    const buffer = editor.getBuffer();
    const totalLines = buffer.getLineCount();

    const startRow = Math.max(0, matchRow - linesBefore);
    const endRow = Math.min(totalLines - 1, matchRow + linesAfter);

    const lines = [];
    for (let row = startRow; row <= endRow; row++) {
      lines.push({
        lineNumber: row + 1,
        text: buffer.lineForRow(row),
        isMatch: row === matchRow,
      });
    }

    return {
      matchText: targetMatch.text,
      matchLine: matchRow + 1,
      context: lines,
      totalMatches: matches.length,
    };
  },

  deleteLine({ line }) {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return false;

    const buffer = editor.getBuffer();
    const row = line - 1;

    if (row < 0 || row >= buffer.getLineCount()) {
      return false;
    }

    const range = buffer.rangeForRow(row, true);
    buffer.delete(range);
    return true;
  },

  deleteLineRange({ startLine, endLine }) {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return false;

    const buffer = editor.getBuffer();
    const startRow = startLine - 1;
    const endRow = endLine - 1;

    if (startRow < 0 || endRow >= buffer.getLineCount() || startRow > endRow) {
      return false;
    }

    const range = [
      [startRow, 0],
      [endRow, buffer.lineLengthForRow(endRow)],
    ];

    // Include the newline of the last line if it exists
    if (endRow < buffer.getLineCount() - 1) {
      range[1] = [endRow + 1, 0];
    }

    buffer.delete(range);
    return true;
  },

  getLineCount() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return null;
    return editor.getBuffer().getLineCount();
  },
};

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================================================
// Tool Registry
// ============================================================================

const toolRegistry = {
  GetActiveEditor: defineTool({
    impl: toolImpls.getActiveEditor,
    format: (data) => data,
  }),

  GetSelection: defineTool({
    impl: toolImpls.getSelection,
    format: (data) => data,
  }),

  InsertText: defineTool({
    impl: toolImpls.insertText,
    validate: { text: validators.string },
    format: (result) => ({ inserted: result }),
  }),

  ReplaceSelection: defineTool({
    impl: toolImpls.replaceSelection,
    validate: { text: validators.string },
    format: (result) => ({ replaced: result }),
  }),

  OpenFile: defineTool({
    impl: toolImpls.openFile,
    validate: { path: validators.string },
    format: (result) => ({ opened: result }),
  }),

  GoToPosition: defineTool({
    impl: toolImpls.goToPosition,
    validate: { line: validators.number },
    format: (result) => ({ navigated: result }),
  }),

  GetOpenEditors: defineTool({
    impl: toolImpls.getOpenEditors,
    format: (data) => data,
  }),

  GetProjectPaths: defineTool({
    impl: toolImpls.getProjectPaths,
    format: (data) => data,
  }),

  SaveFile: defineTool({
    impl: toolImpls.saveFile,
    format: (result) => ({ saved: result }),
  }),

  SetSelections: defineTool({
    impl: toolImpls.setSelections,
    validate: { ranges: validators.array },
    format: (result, args) => ({ selectionsSet: result, count: args.ranges.length }),
  }),

  GetAllSelections: defineTool({
    impl: toolImpls.getAllSelections,
    format: (data) => data,
  }),

  RevealInTreeView: defineTool({
    impl: toolImpls.revealInTreeView,
    validate: { path: validators.string },
    format: (result) => ({ revealed: result }),
  }),

  CloseFile: defineTool({
    impl: toolImpls.closeFile,
    format: (result) => ({ closed: result }),
  }),

  SplitPane: defineTool({
    impl: toolImpls.splitPane,
    validate: {
      direction: (v, n) => validators.enum(v, n, ["left", "right", "up", "down"]),
    },
    format: (result, args) => ({ split: result, direction: args.direction }),
  }),

  ClosePane: defineTool({
    impl: toolImpls.closePane,
    format: (result) => ({ closed: result }),
  }),

  GetPanelState: defineTool({
    impl: toolImpls.getPanelState,
    format: (data) => data,
  }),

  Undo: defineTool({
    impl: toolImpls.undo,
    format: (result) => ({ undone: result }),
  }),

  Redo: defineTool({
    impl: toolImpls.redo,
    format: (result) => ({ redone: result }),
  }),

  FindText: defineTool({
    impl: toolImpls.findText,
    validate: { pattern: validators.string },
    format: (data) => data,
  }),

  GetContextAround: defineTool({
    impl: toolImpls.getContextAround,
    validate: { pattern: validators.string },
    format: (data) => data,
  }),

  DeleteLine: defineTool({
    impl: toolImpls.deleteLine,
    validate: { line: validators.number },
    format: (result) => ({ deleted: result }),
  }),

  DeleteLineRange: defineTool({
    impl: toolImpls.deleteLineRange,
    validate: {
      startLine: validators.number,
      endLine: validators.number,
    },
    format: (result, args) => ({
      deleted: result,
      linesRemoved: args.endLine - args.startLine + 1,
    }),
  }),

  GetLineCount: defineTool({
    impl: toolImpls.getLineCount,
    format: (count) => ({ lineCount: count }),
  }),
};

/**
 * Execute a tool call using the registry
 */
async function executeTool(toolName, args) {
  log.debug(`Executing tool: ${toolName}`, { args });
  const start = performance.now();

  const result = await executeFromRegistry(toolRegistry, toolName, args);

  const duration = (performance.now() - start).toFixed(2);
  if (result.success) {
    log.debug(`Tool ${toolName} completed in ${duration}ms`, { data: result.data });
  } else {
    log.debug(`Tool ${toolName} failed in ${duration}ms`, { error: result.error });
  }

  return result;
}

// ============================================================================
// HTTP Server
// ============================================================================

/**
 * Parse JSON body from request
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res, data, statusCode = 200, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

// ============================================================================
// MCP Protocol Handlers
// ============================================================================

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return crypto.randomUUID();
}

/**
 * Create JSON-RPC response
 */
function jsonRpcResponse(id, result) {
  return { jsonrpc: "2.0", id, result };
}

/**
 * Create JSON-RPC error response
 */
function jsonRpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id, error };
}

/**
 * Handle MCP initialize request
 */
function handleInitialize(id, params) {
  const sessionId = generateSessionId();
  sessions.set(sessionId, {
    initialized: true,
    protocolVersion: params.protocolVersion || PROTOCOL_VERSION,
    clientInfo: params.clientInfo,
    createdAt: Date.now(),
  });

  log.debug(`MCP session initialized: ${sessionId}`);

  return {
    response: jsonRpcResponse(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {
        tools: { listChanged: false },
      },
      serverInfo: {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
    }),
    sessionId,
  };
}

/**
 * Handle MCP tools/list request
 */
function handleToolsList(id) {
  const mcpTools = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));

  return jsonRpcResponse(id, { tools: mcpTools });
}

/**
 * Handle MCP tools/call request
 */
async function handleToolsCall(id, params) {
  const { name, arguments: args = {} } = params;

  if (!name) {
    return jsonRpcError(id, -32602, "Invalid params: missing tool name");
  }

  const result = await executeTool(name, args);

  if (result.success) {
    return jsonRpcResponse(id, {
      content: [
        {
          type: "text",
          text: JSON.stringify(result.data, null, 2),
        },
      ],
      isError: false,
    });
  } else {
    return jsonRpcResponse(id, {
      content: [
        {
          type: "text",
          text: result.error || "Tool execution failed",
        },
      ],
      isError: true,
    });
  }
}

/**
 * Handle MCP JSON-RPC request
 */
async function handleMcpRequest(body, sessionId) {
  const { jsonrpc, id, method, params = {} } = body;

  if (jsonrpc !== "2.0") {
    return { response: jsonRpcError(id, -32600, "Invalid Request: must be JSON-RPC 2.0") };
  }

  log.debug(`MCP request: ${method}`, { id, params });

  switch (method) {
    case "initialize":
      return handleInitialize(id, params);

    case "notifications/initialized":
      // Client notification that initialization is complete
      return { response: null, statusCode: 202 };

    case "tools/list":
      return { response: handleToolsList(id) };

    case "tools/call":
      return { response: await handleToolsCall(id, params) };

    case "ping":
      return { response: jsonRpcResponse(id, {}) };

    default:
      return { response: jsonRpcError(id, -32601, `Method not found: ${method}`) };
  }
}

/**
 * Handle POST /mcp endpoint
 */
async function handleMcpEndpoint(req, res) {
  const sessionId = req.headers["mcp-session-id"];

  // Parse request body
  let body;
  try {
    body = await parseBody(req);
  } catch {
    sendJson(res, jsonRpcError(null, -32700, "Parse error: invalid JSON"), 400);
    return;
  }

  // Handle the request
  const result = await handleMcpRequest(body, sessionId);

  // If no response needed (notification), return 202
  if (result.response === null) {
    res.writeHead(202, { "Access-Control-Allow-Origin": "*" });
    res.end();
    return;
  }

  // Build response headers
  const headers = {};
  if (result.sessionId) {
    headers["Mcp-Session-Id"] = result.sessionId;
  }

  sendJson(res, result.response, 200, headers);
}

/**
 * Start the HTTP bridge server
 */
function startBridge(config = {}) {
  const port = config.port ?? DEFAULT_PORT;
  const host = config.host ?? DEFAULT_HOST;

  const server = http.createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, Accept",
        "Access-Control-Expose-Headers": "Mcp-Session-Id",
      });
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://${host}:${port}`);
    const pathname = url.pathname;

    try {
      // POST /mcp - MCP Protocol endpoint
      if (req.method === "POST" && pathname === "/mcp") {
        await handleMcpEndpoint(req, res);
        return;
      }

      // DELETE /mcp - Session termination
      if (req.method === "DELETE" && pathname === "/mcp") {
        const sessionId = req.headers["mcp-session-id"];
        if (sessionId && sessions.has(sessionId)) {
          sessions.delete(sessionId);
          log.debug(`MCP session terminated: ${sessionId}`);
        }
        res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
        res.end();
        return;
      }

      // GET /health - Health check
      if (req.method === "GET" && pathname === "/health") {
        sendJson(res, { status: "ok", timestamp: Date.now() });
        return;
      }

      // GET /tools - List available tools (REST API)
      if (req.method === "GET" && pathname === "/tools") {
        sendJson(res, { tools });
        return;
      }

      // POST /tools/:toolName - Execute a tool (REST API)
      const toolMatch = pathname.match(/^\/tools\/([A-Z][a-zA-Z]*)$/);
      if (req.method === "POST" && toolMatch) {
        const toolName = toolMatch[1];
        const args = await parseBody(req);
        log.debug(`HTTP POST /tools/${toolName}`, { args });

        const result = await executeTool(toolName, args);

        if (result.success) {
          sendJson(res, result);
        } else {
          log.debug(`Tool request failed: ${toolName}`, { error: result.error });
          sendJson(res, result, 400);
        }
        return;
      }

      // 404 Not Found
      log.debug(`404 Not Found: ${req.method} ${pathname}`);
      sendJson(res, { error: "Not found" }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`HTTP error: ${message}`);
      sendJson(res, { error: message }, 500);
    }
  });

  server.listen(port, host);

  log.debug(`Bridge listening on http://${host}:${port}`);
  log.debug(`Available tools: ${Object.keys(toolRegistry).join(", ")}`);

  return {
    port,
    host,
    stop: () =>
      new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
  };
}

/**
 * Stop the bridge server
 */
async function stopBridge(bridge) {
  await bridge.stop();
  log.debug("Bridge stopped");
}

module.exports = { startBridge, stopBridge };
