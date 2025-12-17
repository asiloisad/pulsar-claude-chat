/** @babel */
/** @jsx etch.dom */

import etch from "etch";
import {
  createToolRenderer,
  createSimpleToolRenderer,
  renderPreContent,
} from "./tool-base";
import { parseJsonResult, truncateWithCount } from "../utils/result-parsers";

/**
 * MCP Tool renderers for Pulsar integration
 * Handles tools prefixed with mcp__pulsar__
 */

// Alias for cleaner usage
const parseMcpResult = parseJsonResult;

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
        <pre className="tool-content">{truncateWithCount(data.content, 2000)}</pre>
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
      <div className="search-results">
        {data.map((editor, i) => (
          <div className={`search-entry ${editor.active ? "mcp-active" : ""}`} key={i}>
            <a
              className="search-path"
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
      <div className="search-results">
        {data.map((path, i) => (
          <div className="search-entry" key={i}>
            <span className="search-path">{path}</span>
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

export const renderMcpSetSelections = createToolRenderer({
  name: "SetSelections",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    const count = input?.ranges?.length || 0;
    return {
      count,
      countLabel: count === 1 ? "selection" : "selections",
      resultInfo: data?.selectionsSet ? null : "failed",
    };
  },
  hasExpandable: (input) => input?.ranges?.length > 0,
  renderContent: (msg) => {
    const ranges = msg.input?.ranges || [];
    return (
      <div className="tool-mcp-list">
        {ranges.map((r, i) => (
          <div className="mcp-list-item" key={i}>
            <span className="mcp-value">
              [{r.startRow + 1}:{r.startColumn + 1}] → [{r.endRow + 1}:{r.endColumn + 1}]
            </span>
          </div>
        ))}
      </div>
    );
  },
});

export const renderMcpGetAllSelections = createToolRenderer({
  name: "GetAllSelections",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    const count = Array.isArray(data) ? data.length : 0;
    return { count, countLabel: count === 1 ? "selection" : "selections" };
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
        {data.map((sel, i) => (
          <div className={`mcp-list-item ${sel.isEmpty ? "mcp-empty" : ""}`} key={i}>
            <span className="mcp-value">
              [{sel.range?.start?.row + 1}:{sel.range?.start?.column + 1}] → [{sel.range?.end?.row + 1}:{sel.range?.end?.column + 1}]
            </span>
            {sel.isEmpty ? (
              <span className="mcp-badge">cursor</span>
            ) : (
              <span className="mcp-selection-text">{sel.text?.slice(0, 30)}{sel.text?.length > 30 ? "..." : ""}</span>
            )}
          </div>
        ))}
      </div>
    );
  },
});

export const renderMcpRevealInTreeView = createToolRenderer({
  name: "RevealInTreeView",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    return {
      path: input?.path,
      resultInfo: data?.revealed ? null : "failed",
    };
  },
  hasExpandable: () => false,
});

export const renderMcpCloseFile = createToolRenderer({
  name: "CloseFile",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    return {
      path: input?.path,
      resultInfo: data?.closed ? "closed" : "failed",
    };
  },
  hasExpandable: () => false,
});

export const renderMcpSplitPane = createSimpleToolRenderer("SplitPane", (input) => ({
  text: input?.direction ? `split ${input.direction}` : null,
  code: input?.path,
}));

export const renderMcpClosePane = createSimpleToolRenderer("ClosePane", (input) => ({
  badge: input?.saveAll ? "save all" : null,
}));

export const renderMcpGetPanelState = createToolRenderer({
  name: "GetPanelState",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    return {
      resultInfo: data?.panes ? `${data.panes.count} panes` : null,
    };
  },
  hasExpandable: (input, result) => {
    const data = parseMcpResult(result);
    return data !== null;
  },
  renderContent: (msg) => {
    const data = parseMcpResult(msg.result);
    if (!data) return null;
    return (
      <div className="tool-mcp-content mcp-panel-state">
        <div className="mcp-info-row">
          <span className="mcp-label">Left dock:</span>
          <span className={`mcp-badge ${data.left?.visible ? "mcp-visible" : "mcp-hidden"}`}>
            {data.left?.visible ? "visible" : "hidden"}
          </span>
          <span className="mcp-value">{data.left?.items || 0} items</span>
        </div>
        <div className="mcp-info-row">
          <span className="mcp-label">Right dock:</span>
          <span className={`mcp-badge ${data.right?.visible ? "mcp-visible" : "mcp-hidden"}`}>
            {data.right?.visible ? "visible" : "hidden"}
          </span>
          <span className="mcp-value">{data.right?.items || 0} items</span>
        </div>
        <div className="mcp-info-row">
          <span className="mcp-label">Bottom dock:</span>
          <span className={`mcp-badge ${data.bottom?.visible ? "mcp-visible" : "mcp-hidden"}`}>
            {data.bottom?.visible ? "visible" : "hidden"}
          </span>
          <span className="mcp-value">{data.bottom?.items || 0} items</span>
        </div>
        <div className="mcp-info-row">
          <span className="mcp-label">Panes:</span>
          <span className="mcp-value">{data.panes?.count || 0} total, active: #{(data.panes?.activeIndex || 0) + 1}</span>
        </div>
      </div>
    );
  },
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
  "mcp__pulsar__SetSelections": renderMcpSetSelections,
  "mcp__pulsar__GetAllSelections": renderMcpGetAllSelections,
  "mcp__pulsar__RevealInTreeView": renderMcpRevealInTreeView,
  "mcp__pulsar__CloseFile": renderMcpCloseFile,
  "mcp__pulsar__SplitPane": renderMcpSplitPane,
  "mcp__pulsar__ClosePane": renderMcpClosePane,
  "mcp__pulsar__GetPanelState": renderMcpGetPanelState,
};
