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

export const renderMcpInsertText = createToolRenderer({
  name: "InsertText",
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
    pathInfo: input?.row != null ? `line ${input.row + 1}${input.column != null ? `:${input.column + 1}` : ""}` : null,
  }),
  hasExpandable: () => false,
});

export const renderMcpGoToPosition = createSimpleToolRenderer("GoToPosition", (input) => ({
  text: input?.row != null ? `line ${input.row + 1}${input.column != null ? `, col ${input.column + 1}` : ""}` : null,
}), "mcp-pulsar");

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
              title={editor.path}
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
  renderContent: (msg, handlers) => {
    const data = parseMcpResult(msg.result);
    if (!Array.isArray(data)) return null;
    return (
      <div className="search-results">
        {data.map((path, i) => (
          <div className="search-entry" key={i}>
            <a
              className="search-path"
              href="#"
              title={path}
              on={{
                click: (e) => {
                  e.preventDefault();
                  handlers.openFile(path);
                },
              }}
            >
              {path}
            </a>
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

export const renderMcpGetSelections = createToolRenderer({
  name: "GetSelections",
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

// ============================================================================
// Text Operations
// ============================================================================

export const renderMcpUndo = createSimpleToolRenderer("Undo", (input, result) => {
  const data = parseMcpResult(result);
  return { resultInfo: data ? "done" : "nothing to undo" };
}, "mcp-pulsar");

export const renderMcpRedo = createSimpleToolRenderer("Redo", (input, result) => {
  const data = parseMcpResult(result);
  return { resultInfo: data ? "done" : "nothing to redo" };
}, "mcp-pulsar");

export const renderMcpFindText = createToolRenderer({
  name: "FindText",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    return {
      count: data?.count || 0,
      countLabel: "matches",
      code: input?.pattern?.slice(0, 30),
    };
  },
  hasExpandable: (input, result) => {
    const data = parseMcpResult(result);
    return data?.matches?.length > 0;
  },
  renderContent: (msg, handlers) => {
    const data = parseMcpResult(msg.result);
    if (!data?.matches) return null;
    return (
      <div className="search-results">
        {data.matches.slice(0, 20).map((m, i) => (
          <div className="search-entry" key={i}>
            <a
              className="search-line-link"
              href="#"
              on={{
                click: (e) => {
                  e.preventDefault();
                  handlers.goToLine(m.range.start.row, m.range.start.column);
                },
              }}
            >
              {m.range.start.row + 1}:{m.range.start.column + 1}
            </a>
            <span className="search-content">{m.text}</span>
          </div>
        ))}
        {data.matches.length > 20 ? (
          <div className="search-more">... {data.matches.length - 20} more</div>
        ) : null}
      </div>
    );
  },
});

export const renderMcpGetContextAround = createToolRenderer({
  name: "GetContextAround",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    return {
      code: input?.pattern?.slice(0, 30),
      resultInfo: data?.matchRow != null ? `line ${data.matchRow + 1}` : null,
    };
  },
  hasExpandable: (input, result) => {
    const data = parseMcpResult(result);
    return data?.context?.length > 0;
  },
  renderContent: (msg) => {
    const data = parseMcpResult(msg.result);
    if (!data?.context) return null;
    return (
      <div className="tool-mcp-content">
        <pre className="tool-content">
          {data.context.map((line) =>
            `${line.isMatch ? ">" : " "} ${line.row + 1}: ${line.text}`
          ).join("\n")}
        </pre>
      </div>
    );
  },
});

export const renderMcpDeleteLines = createSimpleToolRenderer("DeleteLines", (input, result) => {
  const data = parseMcpResult(result);
  const range = input?.startRow === input?.endRow
    ? `line ${input.startRow + 1}`
    : `lines ${input.startRow + 1}-${input.endRow + 1}`;
  return {
    text: range,
    resultInfo: data ? "deleted" : "failed",
  };
}, "mcp-pulsar");

export const renderMcpGetLineCount = createSimpleToolRenderer("GetLineCount", (input, result) => {
  const data = parseMcpResult(result);
  return { resultInfo: data ? `${data} lines` : "no editor" };
}, "mcp-pulsar");

// ============================================================================
// Project Management Tools
// ============================================================================

export const renderMcpSetProjectPaths = createToolRenderer({
  name: "SetProjectPaths",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    const count = input?.paths?.length || 0;
    return {
      count,
      countLabel: "paths",
      resultInfo: data?.set ? null : "failed",
    };
  },
  hasExpandable: (input) => input?.paths?.length > 0,
  renderContent: (msg, handlers) => {
    const paths = msg.input?.paths || [];
    return (
      <div className="search-results">
        {paths.map((path, i) => (
          <div className="search-entry" key={i}>
            <a
              className="search-path"
              href="#"
              title={path}
              on={{
                click: (e) => {
                  e.preventDefault();
                  handlers.openFile(path);
                },
              }}
            >
              {path}
            </a>
          </div>
        ))}
      </div>
    );
  },
});

export const renderMcpAddProjectPath = createSimpleToolRenderer("AddProjectPath", (input) => ({
  path: input?.path,
}), "mcp-pulsar");

export const renderMcpRemoveProjectPath = createSimpleToolRenderer("RemoveProjectPath", (input) => ({
  path: input?.path,
}), "mcp-pulsar");

// ============================================================================
// Buffer Range Tools
// ============================================================================

export const renderMcpGetTextInBufferRange = createToolRenderer({
  name: "GetTextInBufferRange",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    const text = data?.text;
    if (!text) return { resultInfo: "empty" };
    const lines = text.split("\n").length;
    return { resultInfo: `${lines} ${lines === 1 ? "line" : "lines"}` };
  },
  hasExpandable: (input, result) => {
    const data = parseMcpResult(result);
    return data?.text?.length > 0;
  },
  renderContent: (msg) => {
    const data = parseMcpResult(msg.result);
    if (!data?.text) return null;
    return (
      <div className="tool-mcp-content">
        <pre className="tool-content">{truncateWithCount(data.text, 2000)}</pre>
      </div>
    );
  },
});

export const renderMcpSetTextInBufferRange = createToolRenderer({
  name: "SetTextInBufferRange",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const { startRow, startColumn, endRow, endColumn, text } = input || {};
    // Display as 1-indexed for user-friendly line numbers
    const range = startRow != null ? `${startRow + 1}:${startColumn}-${endRow + 1}:${endColumn}` : null;
    const chars = text ? `${text.length} chars` : null;
    return {
      resultInfo: [range, chars].filter(Boolean).join(" · "),
    };
  },
  hasExpandable: (input) => input?.text?.length > 40,
  renderContent: (msg) => renderPreContent(msg.input?.text, 500),
});

export const renderMcpScanInBufferRange = createToolRenderer({
  name: "ScanInBufferRange",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    return {
      count: data?.count || 0,
      countLabel: "matches",
    };
  },
  hasExpandable: (input, result) => {
    const data = parseMcpResult(result);
    return data?.matches?.length > 0;
  },
  renderContent: (msg) => {
    const data = parseMcpResult(msg.result);
    if (!data?.matches) return null;
    return (
      <div className="search-results">
        {data.matches.map((m, i) => (
          <div className="search-entry" key={i}>
            <span className="search-path">
              [{m.range?.start?.row + 1}:{m.range?.start?.column}]
            </span>
            <span className="search-content">{m.text}</span>
          </div>
        ))}
      </div>
    );
  },
});

// ============================================================================
// Workspace-wide Tools
// ============================================================================

export const renderMcpScanWorkspace = createToolRenderer({
  name: "ScanWorkspace",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    return {
      count: data?.totalMatches || 0,
      countLabel: "matches",
    };
  },
  hasExpandable: (input, result) => {
    const data = parseMcpResult(result);
    return data?.results?.length > 0;
  },
  renderContent: (msg, handlers) => {
    const data = parseMcpResult(msg.result);
    if (!data?.results) return null;
    return (
      <div className="search-results">
        {data.results.map((file, i) => (
          <div className="search-file-group" key={i}>
            <a
              className="search-path search-file-header"
              href="#"
              title={file.filePath}
              on={{
                click: (e) => {
                  e.preventDefault();
                  handlers.openFile(file.filePath);
                },
              }}
            >
              {file.filePath}
              <span className="search-match-count">{file.matches?.length || 0}</span>
            </a>
            {file.matches?.slice(0, 5).map((m, j) => (
              <div className="search-entry search-entry-nested" key={j}>
                <a
                  className="search-line-link"
                  href="#"
                  on={{
                    click: (e) => {
                      e.preventDefault();
                      handlers.openFile(file.filePath, m.row);
                    },
                  }}
                >
                  {m.row + 1}
                </a>
                <span className="search-content">{m.lineText?.trim()}</span>
              </div>
            ))}
            {file.matches?.length > 5 ? (
              <div className="search-more">... {file.matches.length - 5} more</div>
            ) : null}
          </div>
        ))}
      </div>
    );
  },
});

export const renderMcpReplaceInWorkspace = createToolRenderer({
  name: "ReplaceInWorkspace",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    const isDryRun = input?.dryRun;
    return {
      count: data?.totalReplacements || 0,
      countLabel: "replacements",
      resultInfo: isDryRun ? "dry run" : data?.replaced ? "replaced" : "failed",
    };
  },
  hasExpandable: (input, result) => {
    const data = parseMcpResult(result);
    return data?.results?.length > 0;
  },
  renderContent: (msg, handlers) => {
    const data = parseMcpResult(msg.result);
    if (!data?.results) return null;
    return (
      <div className="search-results">
        {data.results.map((file, i) => (
          <div className="search-entry" key={i}>
            <a
              className="search-path"
              href="#"
              title={file.filePath}
              on={{
                click: (e) => {
                  e.preventDefault();
                  handlers.openFile(file.filePath);
                },
              }}
            >
              {file.filePath}
            </a>
            <span className="search-match-count">{file.matchCount}</span>
          </div>
        ))}
      </div>
    );
  },
});

// ============================================================================
// Registry
// ============================================================================

export const MCP_TOOL_RENDERERS = {
  // P0 - Must Have
  "mcp__pulsar__GetActiveEditor": renderMcpGetActiveEditor,
  "mcp__pulsar__InsertText": renderMcpInsertText,
  // P1 - Important
  "mcp__pulsar__OpenFile": renderMcpOpenFile,
  "mcp__pulsar__GoToPosition": renderMcpGoToPosition,
  "mcp__pulsar__GetOpenEditors": renderMcpGetOpenEditors,
  "mcp__pulsar__GetProjectPaths": renderMcpGetProjectPaths,
  "mcp__pulsar__SaveFile": renderMcpSaveFile,
  // P2 - Editor Enhancement
  "mcp__pulsar__SetSelections": renderMcpSetSelections,
  "mcp__pulsar__GetSelections": renderMcpGetSelections,
  "mcp__pulsar__CloseFile": renderMcpCloseFile,
  // P3 - Text Operations
  "mcp__pulsar__Undo": renderMcpUndo,
  "mcp__pulsar__Redo": renderMcpRedo,
  "mcp__pulsar__FindText": renderMcpFindText,
  "mcp__pulsar__GetContextAround": renderMcpGetContextAround,
  "mcp__pulsar__DeleteLines": renderMcpDeleteLines,
  "mcp__pulsar__GetLineCount": renderMcpGetLineCount,
  // P4 - Project Management
  "mcp__pulsar__SetProjectPaths": renderMcpSetProjectPaths,
  "mcp__pulsar__AddProjectPath": renderMcpAddProjectPath,
  "mcp__pulsar__RemoveProjectPath": renderMcpRemoveProjectPath,
  // P5 - Buffer Range Operations
  "mcp__pulsar__GetTextInBufferRange": renderMcpGetTextInBufferRange,
  "mcp__pulsar__SetTextInBufferRange": renderMcpSetTextInBufferRange,
  "mcp__pulsar__ScanInBufferRange": renderMcpScanInBufferRange,
  // P6 - Workspace-wide Operations
  "mcp__pulsar__ScanWorkspace": renderMcpScanWorkspace,
  "mcp__pulsar__ReplaceInWorkspace": renderMcpReplaceInWorkspace,
};
