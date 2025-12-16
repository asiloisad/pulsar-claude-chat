/** @babel */
/** @jsx etch.dom */

import etch from "etch";
import {
  createToolRenderer,
  createSimpleToolRenderer,
  renderPreContent,
} from "./tool-base";

/**
 * MCP Tool renderers for Pulsar integration
 * Handles tools prefixed with mcp__pulsar__
 */

// ============================================================================
// Helpers
// ============================================================================

function parseMcpResult(result) {
  if (!result) return null;
  try {
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    return parsed?.data ?? parsed;
  } catch {
    return result;
  }
}

// ============================================================================
// Tool Renderers
// ============================================================================

export const renderMcpGetActiveEditor = createToolRenderer({
  name: "GetActiveEditor",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    return {
      path: data?.path,
      resultInfo: data?.grammar,
    };
  },
  hasExpandable: (input, result) => {
    const data = parseMcpResult(result);
    return data?.content?.length > 0;
  },
  renderContent: (msg) => {
    const data = parseMcpResult(msg.result);
    if (!data?.content) return null;
    return (
      <div className="tool-mcp-content">
        <div className="mcp-info-row">
          <span className="mcp-label">Cursor:</span>
          <span className="mcp-value">
            Line {(data.cursorPosition?.row || 0) + 1}, Col {(data.cursorPosition?.column || 0) + 1}
          </span>
          {data.modified ? <span className="mcp-badge mcp-modified">modified</span> : null}
        </div>
        <pre className="tool-content">
          {data.content.slice(0, 2000)}
          {data.content.length > 2000 ? `\n... (${data.content.length - 2000} more chars)` : ""}
        </pre>
      </div>
    );
  },
});

export const renderMcpGetSelection = createToolRenderer({
  name: "GetSelection",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    if (!data?.text) return { resultInfo: "no selection" };
    const lines = data.text.split("\n").length;
    return { resultInfo: `${lines} ${lines === 1 ? "line" : "lines"}` };
  },
  hasExpandable: (input, result) => {
    const data = parseMcpResult(result);
    return data?.text?.length > 0;
  },
  renderContent: (msg) => {
    const data = parseMcpResult(msg.result);
    if (!data?.text) return null;
    const range = data.range;
    return (
      <div className="tool-mcp-content">
        {range ? (
          <div className="mcp-info-row">
            <span className="mcp-label">Range:</span>
            <span className="mcp-value">
              [{range.start?.row + 1}:{range.start?.column + 1}] - [{range.end?.row + 1}:{range.end?.column + 1}]
            </span>
          </div>
        ) : null}
        <pre className="tool-content">{data.text}</pre>
      </div>
    );
  },
});

export const renderMcpInsertText = createSimpleToolRenderer("InsertText", (input) => ({
  code: input?.text?.slice(0, 40) + (input?.text?.length > 40 ? "..." : ""),
}));

export const renderMcpReplaceSelection = createToolRenderer({
  name: "ReplaceSelection",
  className: "mcp-pulsar",
  getInfo: (input) => ({
    resultInfo: input?.text ? `${input.text.length} chars` : null,
  }),
  hasExpandable: (input) => input?.text?.length > 40,
  renderContent: (msg) => renderPreContent(msg.input?.text, 500),
});

export const renderMcpOpenFile = createToolRenderer({
  name: "OpenFile",
  className: "mcp-pulsar",
  getInfo: (input) => ({
    path: input?.path,
    pathInfo: input?.line ? `line ${input.line}${input.column ? `:${input.column}` : ""}` : null,
  }),
  hasExpandable: () => false,
});

export const renderMcpGoToPosition = createSimpleToolRenderer("GoToPosition", (input) => ({
  text: input?.line ? `line ${input.line}${input.column ? `, col ${input.column}` : ""}` : null,
}));

export const renderMcpGetOpenEditors = createToolRenderer({
  name: "GetOpenEditors",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    const count = Array.isArray(data) ? data.length : 0;
    return { count, countLabel: "editors" };
  },
  hasExpandable: (input, result) => {
    const data = parseMcpResult(result);
    return Array.isArray(data) && data.length > 0;
  },
  renderContent: (msg, handlers) => {
    const data = parseMcpResult(msg.result);
    if (!Array.isArray(data)) return null;
    return (
      <div className="tool-mcp-list">
        {data.map((editor, i) => (
          <div className={`mcp-list-item ${editor.active ? "mcp-active" : ""}`} key={i}>
            <a
              className="mcp-path"
              href="#"
              on={{
                click: (e) => {
                  e.preventDefault();
                  handlers.openFile(editor.path);
                },
              }}
            >
              {editor.path || "(untitled)"}
            </a>
            {editor.modified ? <span className="mcp-badge mcp-modified">modified</span> : null}
            {editor.active ? <span className="mcp-badge mcp-active-badge">active</span> : null}
          </div>
        ))}
      </div>
    );
  },
});

export const renderMcpGetProjectPaths = createToolRenderer({
  name: "GetProjectPaths",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    const count = Array.isArray(data) ? data.length : 0;
    return { count, countLabel: "projects" };
  },
  hasExpandable: (input, result) => {
    const data = parseMcpResult(result);
    return Array.isArray(data) && data.length > 0;
  },
  renderContent: (msg) => {
    const data = parseMcpResult(msg.result);
    if (!Array.isArray(data)) return null;
    return (
      <div className="tool-mcp-list">
        {data.map((path, i) => (
          <div className="mcp-list-item" key={i}>
            <span className="mcp-path">{path}</span>
          </div>
        ))}
      </div>
    );
  },
});

export const renderMcpSaveFile = createToolRenderer({
  name: "SaveFile",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    return {
      path: input?.path,
      resultInfo: data?.saved ? "saved" : "failed",
    };
  },
  hasExpandable: () => false,
});

// ============================================================================
// Registry
// ============================================================================

export const MCP_TOOL_RENDERERS = {
  "mcp__pulsar__GetActiveEditor": renderMcpGetActiveEditor,
  "mcp__pulsar__GetSelection": renderMcpGetSelection,
  "mcp__pulsar__InsertText": renderMcpInsertText,
  "mcp__pulsar__ReplaceSelection": renderMcpReplaceSelection,
  "mcp__pulsar__OpenFile": renderMcpOpenFile,
  "mcp__pulsar__GoToPosition": renderMcpGoToPosition,
  "mcp__pulsar__GetOpenEditors": renderMcpGetOpenEditors,
  "mcp__pulsar__GetProjectPaths": renderMcpGetProjectPaths,
  "mcp__pulsar__SaveFile": renderMcpSaveFile,
};
