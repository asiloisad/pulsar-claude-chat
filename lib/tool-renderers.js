/** @babel */
/** @jsx etch.dom */

import etch from "etch";

/**
 * Tool renderer functions for ChatPanel.
 * Each renderer returns JSX for a specific tool type.
 */

/**
 * Helper: Parse Read result to extract line info
 */
function parseReadResult(result) {
  if (!result) return null;
  if (typeof result !== "string") return null;
  const lines = result.split("\n").length;
  return `${lines} lines`;
}

/**
 * Helper: Count lines in Glob/Grep result
 */
function countResultLines(result) {
  if (!result || typeof result !== "string") return null;
  return result
    .trim()
    .split("\n")
    .filter((l) => l).length;
}

/**
 * Helper: Get line range info from Read input
 */
function getReadLineRange(input) {
  const offset = input?.offset;
  const limit = input?.limit;

  if (offset && limit) {
    return `lines ${offset}-${offset + limit - 1}`;
  } else if (offset) {
    return `from line ${offset}`;
  } else if (limit) {
    return `lines 1-${limit}`;
  }
  return null;
}

/**
 * Helper: Extract preview data from Read result for images/PDFs
 */
function getReadPreview(result) {
  // String result = text file, no preview
  if (typeof result === "string") return null;

  // Array of content blocks = possible image/PDF
  if (Array.isArray(result)) {
    for (const block of result) {
      if (block.type === "image") {
        // Try different possible structures from Claude API
        const source = block.source || block;
        const data = source.data || block.data;
        const mediaType =
          source.media_type || block.media_type || "image/jpeg";

        if (data) {
          return { type: "image", mediaType, data };
        }
      }
    }
  }

  // Debug: log structure if result is object but not handled
  if (result && typeof result === "object") {
    console.log("Read result structure:", JSON.stringify(result).slice(0, 500));
  }

  return null;
}

export function renderToolRead(msg, index, handlers) {
  const { id, input, result, collapsed, isError } = msg;
  const filePath = input?.file_path || input?.path || "";
  const lineRange = getReadLineRange(input);
  const resultInfo = parseReadResult(result);
  const preview = getReadPreview(result);
  const hasPreview = !!preview;
  const hasTextContent = typeof result === "string" && result.length > 0;
  const hasExpandable = hasPreview || hasTextContent;

  return (
    <div
      className={`message message-tool tool-read ${collapsed ? "collapsed" : ""} ${isError ? "tool-error" : ""}`}
      key={index}
    >
      <div className="tool-header">
        <span
          className={`tool-name ${hasExpandable ? "tool-toggle" : ""}`}
          on={{ click: () => hasExpandable && handlers.toggle(id) }}
        >
          Read
        </span>
        {filePath ? (
          <a
            className="tool-path"
            href="#"
            on={{
              click: (e) => {
                e.preventDefault();
                handlers.openFile(filePath, input?.offset);
              },
            }}
          >
            {filePath}
          </a>
        ) : null}
        {lineRange ? <span className="tool-path-info">{lineRange}</span> : null}
        {resultInfo ? (
          <span className="tool-result-info">{resultInfo}</span>
        ) : null}
        {hasPreview ? (
          <span className="tool-result-info">{preview.type}</span>
        ) : null}
      </div>
      {hasPreview && !collapsed ? (
        <div className="tool-preview">
          {preview.type === "image" ? (
            <img
              src={`data:${preview.mediaType};base64,${preview.data}`}
              alt="Preview"
              draggable={false}
            />
          ) : null}
        </div>
      ) : null}
      {hasTextContent && !collapsed ? (
        <pre className="tool-content">
          {result.slice(0, 5000)}
          {result.length > 5000 ? `\n... (${result.length - 5000} more chars)` : ""}
        </pre>
      ) : null}
    </div>
  );
}

export function renderToolWrite(msg, index, handlers) {
  const { id, input, collapsed, isError } = msg;
  const filePath = input?.file_path || "";
  const content = input?.content || "";
  const hasContent = content.length > 0;

  return (
    <div
      className={`message message-tool tool-write ${collapsed ? "collapsed" : ""} ${isError ? "tool-error" : ""}`}
      key={index}
    >
      <div className="tool-header">
        <span
          className={`tool-name ${hasContent ? "tool-toggle" : ""}`}
          on={{ click: () => hasContent && handlers.toggle(id) }}
        >
          Write
        </span>
        {filePath ? (
          <a
            className="tool-path"
            href="#"
            on={{
              click: (e) => {
                e.preventDefault();
                handlers.openFile(filePath);
              },
            }}
          >
            {filePath}
          </a>
        ) : null}
      </div>
      {hasContent && !collapsed ? (
        <pre className="tool-content">
          {content.slice(0, 500)}
          {content.length > 500 ? "..." : ""}
        </pre>
      ) : null}
    </div>
  );
}

export function renderToolEdit(msg, index, handlers) {
  const { id, input, collapsed, isError } = msg;
  const filePath = input?.file_path || "";
  const oldStr = input?.old_string || "";
  const newStr = input?.new_string || "";
  const hasDiff = oldStr || newStr;

  return (
    <div
      className={`message message-tool tool-edit ${collapsed ? "collapsed" : ""} ${isError ? "tool-error" : ""}`}
      key={index}
    >
      <div className="tool-header">
        <span
          className={`tool-name ${hasDiff ? "tool-toggle" : ""}`}
          on={{ click: () => hasDiff && handlers.toggle(id) }}
        >
          Edit
        </span>
        {filePath ? (
          <a
            className="tool-path"
            href="#"
            on={{
              click: (e) => {
                e.preventDefault();
                handlers.openFile(filePath);
              },
            }}
          >
            {filePath}
          </a>
        ) : null}
      </div>
      {hasDiff && !collapsed ? (
        <div className="tool-diff">
          {oldStr ? (
            <div className="diff-section diff-remove">
              <span className="diff-marker">-</span>
              <pre className="diff-content">
                {oldStr.slice(0, 300)}
                {oldStr.length > 300 ? "..." : ""}
              </pre>
            </div>
          ) : null}
          {newStr ? (
            <div className="diff-section diff-add">
              <span className="diff-marker">+</span>
              <pre className="diff-content">
                {newStr.slice(0, 300)}
                {newStr.length > 300 ? "..." : ""}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function renderToolBash(msg, index, handlers) {
  const { id, input, result, collapsed, isError } = msg;
  const command = input?.command || "";
  const description = input?.description || "";
  const hasOutput = result && result.length > 0;
  const hasExpandable = command.length > 60 || hasOutput;
  const outputLines = hasOutput ? result.split("\n").length : 0;

  return (
    <div
      className={`message message-tool tool-bash ${isError ? "bash-error" : ""} ${
        collapsed ? "collapsed" : ""
      }`}
      key={index}
    >
      <div className="tool-header">
        <span
          className={`tool-name ${hasExpandable ? "tool-toggle" : ""}`}
          on={{ click: () => hasExpandable && handlers.toggle(id) }}
        >
          Bash
        </span>
        {description ? (
          <span className="tool-description">{description}</span>
        ) : (
          <code className="tool-command">
            {command.slice(0, 60)}
            {command.length > 60 ? "..." : ""}
          </code>
        )}
        {hasOutput && collapsed ? (
          <span className="tool-output-info">
            {outputLines} {outputLines === 1 ? "line" : "lines"}
          </span>
        ) : null}
      </div>
      {!collapsed ? (
        <div className="tool-bash-content">
          <div className="bash-command-section">
            <pre className="bash-command-text">{command}</pre>
          </div>
          {hasOutput ? (
            <div className={`bash-output-section ${isError ? "bash-output-error" : ""}`}>
              <pre className="bash-output-text">
                {result.slice(0, 2000)}
                {result.length > 2000 ? `\n... (${result.length - 2000} more chars)` : ""}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function renderToolTodo(msg, index, handlers) {
  const { id, input, collapsed, isError } = msg;
  const todos = input?.todos || [];
  const hasContent = todos.length > 0;

  const statusIcon = (status) => {
    switch (status) {
      case "completed":
        return "check";
      case "in_progress":
        return "playback-play";
      default:
        return "primitive-square";
    }
  };

  return (
    <div
      className={`message message-tool tool-todo ${collapsed ? "collapsed" : ""} ${isError ? "tool-error" : ""}`}
      key={index}
    >
      <div className="tool-header">
        <span
          className={`tool-name ${hasContent ? "tool-toggle" : ""}`}
          on={{ click: () => hasContent && handlers.toggle(id) }}
        >
          Todo
        </span>
        <span className="tool-count">{todos.length} items</span>
      </div>
      {!collapsed && hasContent ? (
        <div className="tool-todo-list">
          {todos.map((todo, i) => (
            <div
              className={`todo-item todo-${todo.status || "pending"}`}
              key={i}
            >
              <span
                className={`todo-icon icon icon-${statusIcon(todo.status)}`}
              />
              <span className="todo-content">{todo.content}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Parse search results into file entries
 */
function parseSearchResults(result, maxEntries = 50) {
  if (!result || typeof result !== "string") return [];
  const lines = result.trim().split("\n").filter(l => l);
  return lines.slice(0, maxEntries).map(line => {
    // Check if line has line number (grep output: path:line:content)
    const match = line.match(/^(.+?):(\d+):(.*)$/);
    if (match) {
      return { path: match[1], line: parseInt(match[2]), content: match[3] };
    }
    return { path: line };
  });
}

export function renderToolSearch(msg, index, handlers) {
  const { id, name, input, result, collapsed, isError } = msg;
  const pattern = input?.pattern || "";
  const globPattern = input?.glob || "";
  const path = input?.path || "";
  const count = countResultLines(result);
  const countLabel = name === "Glob" ? "files" : "matches";
  const hasResult = result && typeof result === "string" && result.trim().length > 0;

  // Parse results for better display
  const entries = hasResult ? parseSearchResults(result) : [];
  const totalLines = result ? result.trim().split("\n").filter(l => l).length : 0;
  const hasMore = totalLines > entries.length;

  return (
    <div
      className={`message message-tool tool-search tool-${name.toLowerCase()} ${collapsed ? "collapsed" : ""} ${isError ? "tool-error" : ""}`}
      key={index}
    >
      <div className="tool-header">
        <span
          className={`tool-name ${hasResult ? "tool-toggle" : ""}`}
          on={{ click: () => hasResult && handlers.toggle(id) }}
        >
          {name}
        </span>
        {pattern ? <code className="tool-pattern">{pattern}</code> : null}
        {globPattern && !pattern ? <code className="tool-pattern">{globPattern}</code> : null}
        {path ? <span className="tool-path-info">{path}</span> : null}
        {count !== null ? (
          <span className="tool-count">
            {count} {countLabel}
          </span>
        ) : null}
      </div>
      {hasResult && !collapsed ? (
        <div className="search-results">
          {entries.map((entry, i) => (
            <div className="search-entry" key={i}>
              <a
                className="search-path"
                href="#"
                on={{
                  click: (e) => {
                    e.preventDefault();
                    handlers.openFile(entry.path, entry.line);
                  },
                }}
              >
                {entry.path}
                {entry.line ? <span className="search-line">:{entry.line}</span> : null}
              </a>
              {entry.content ? (
                <span className="search-content">{entry.content}</span>
              ) : null}
            </div>
          ))}
          {hasMore ? (
            <div className="search-more">... {totalLines - entries.length} more</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function renderToolWebFetch(msg, index, handlers) {
  const { id, input, collapsed, isError } = msg;
  const url = input?.url || "";
  const prompt = input?.prompt || "";
  const hasContent = !!prompt;

  return (
    <div
      className={`message message-tool tool-webfetch ${collapsed ? "collapsed" : ""} ${isError ? "tool-error" : ""}`}
      key={index}
    >
      <div className="tool-header">
        <span
          className={`tool-name ${hasContent ? "tool-toggle" : ""}`}
          on={{ click: () => hasContent && handlers.toggle(id) }}
        >
          WebFetch
        </span>
        {url ? (
          <a className="tool-url" href={url} target="_blank">
            {url.slice(0, 60)}
            {url.length > 60 ? "..." : ""}
          </a>
        ) : null}
      </div>
      {hasContent && !collapsed ? (
        <pre className="tool-content">{prompt}</pre>
      ) : null}
    </div>
  );
}

export function renderToolWebSearch(msg, index) {
  const { input, isError } = msg;
  const query = input?.query || "";

  return (
    <div className={`message message-tool tool-websearch ${isError ? "tool-error" : ""}`} key={index}>
      <span className="tool-name">WebSearch</span>
      {query ? <code className="tool-pattern">{query}</code> : null}
    </div>
  );
}

export function renderToolTask(msg, index, handlers) {
  const { id, input, result, collapsed, isError } = msg;
  const description = input?.description || "";
  const prompt = input?.prompt || "";
  const subagentType = input?.subagent_type || "";
  const hasExpandable = prompt || result;

  return (
    <div
      className={`message message-tool tool-task ${collapsed ? "collapsed" : ""} ${isError ? "tool-error" : ""}`}
      key={index}
    >
      <div className="tool-header">
        <span
          className={`tool-name ${hasExpandable ? "tool-toggle" : ""}`}
          on={{ click: () => hasExpandable && handlers.toggle(id) }}
        >
          Task
        </span>
        {subagentType ? (
          <span className="tool-agent-type">{subagentType}</span>
        ) : null}
        {description ? (
          <span className="tool-description">{description}</span>
        ) : null}
      </div>
      {!collapsed && hasExpandable ? (
        <div className="tool-task-content">
          {prompt ? (
            <pre className="tool-content">
              {prompt.slice(0, 500)}
              {prompt.length > 500 ? "..." : ""}
            </pre>
          ) : null}
          {result ? (
            <pre className="tool-result">
              {result.slice(0, 1000)}
              {result.length > 1000 ? "..." : ""}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function renderToolNotebook(msg, index, handlers) {
  const { id, input, collapsed, isError } = msg;
  const notebookPath = input?.notebook_path || "";
  const cellId = input?.cell_id || "";
  const editMode = input?.edit_mode || "replace";
  const newSource = input?.new_source || "";
  const hasContent = !!newSource;

  return (
    <div
      className={`message message-tool tool-notebook ${collapsed ? "collapsed" : ""} ${isError ? "tool-error" : ""}`}
      key={index}
    >
      <div className="tool-header">
        <span
          className={`tool-name ${hasContent ? "tool-toggle" : ""}`}
          on={{ click: () => hasContent && handlers.toggle(id) }}
        >
          NotebookEdit
        </span>
        <span className="tool-edit-mode">{editMode}</span>
        {notebookPath ? (
          <a
            className="tool-path"
            href="#"
            on={{
              click: (e) => {
                e.preventDefault();
                handlers.openFile(notebookPath);
              },
            }}
          >
            {notebookPath}
          </a>
        ) : null}
      </div>
      {hasContent && !collapsed ? (
        <pre className="tool-content">
          {newSource.slice(0, 500)}
          {newSource.length > 500 ? "..." : ""}
        </pre>
      ) : null}
    </div>
  );
}

export function renderToolAskUser(msg, index) {
  const { input } = msg;
  const question = input?.question || "";

  return (
    <div className="message message-tool tool-askuser" key={index}>
      <span className="tool-name">Question</span>
      {question ? <span className="tool-question">{question}</span> : null}
    </div>
  );
}

export function renderToolAgentOutput(msg, index) {
  const { input } = msg;
  const agentId = input?.agentId || "";
  const block = input?.block ? "blocking" : "non-blocking";

  return (
    <div className="message message-tool tool-agentoutput" key={index}>
      <span className="tool-name">AgentOutput</span>
      {agentId ? <code className="tool-agent-id">{agentId}</code> : null}
      <span className="tool-block-mode">{block}</span>
    </div>
  );
}

export function renderToolBashOutput(msg, index) {
  const { input } = msg;
  const bashId = input?.bash_id || "";

  return (
    <div className="message message-tool tool-bashoutput" key={index}>
      <span className="tool-name">BashOutput</span>
      {bashId ? <code className="tool-bash-id">{bashId}</code> : null}
    </div>
  );
}

export function renderToolKillShell(msg, index) {
  const { input } = msg;
  const shellId = input?.shell_id || "";

  return (
    <div className="message message-tool tool-killshell" key={index}>
      <span className="tool-name">KillShell</span>
      {shellId ? <code className="tool-shell-id">{shellId}</code> : null}
    </div>
  );
}

export function renderToolPlanMode(msg, index) {
  const { name } = msg;
  const isExit = name === "ExitPlanMode";

  return (
    <div
      className={`message message-tool tool-planmode ${
        isExit ? "tool-exit" : "tool-enter"
      }`}
      key={index}
    >
      <span className="tool-name">
        {isExit ? "Exit Plan Mode" : "Enter Plan Mode"}
      </span>
    </div>
  );
}

export function renderToolDefault(msg, index) {
  const { name, input, isError } = msg;
  const info = getToolInfo(name, input);

  return (
    <div className={`message message-tool ${isError ? "tool-error" : ""}`} key={index}>
      <span className="tool-name">{name}</span>
      {info ? <span className="tool-info">{info}</span> : null}
    </div>
  );
}

/**
 * Get summary info for a tool based on its input
 */
export function getToolInfo(name, input) {
  if (!input) return "";
  if (input.file_path) return input.file_path;
  if (input.path) return input.path;
  if (input.command) return input.command.slice(0, 80);
  if (input.pattern) return input.pattern;
  if (input.query) return input.query.slice(0, 60);
  if (input.url) return input.url.slice(0, 60);
  if (input.notebook_path) return input.notebook_path;
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.length > 0) {
      return value.slice(0, 80);
    }
  }
  return "";
}

/**
 * Check if a tool has expandable details
 */
export function toolHasDetails(name, input, result) {
  if (name === "Edit") return input?.old_string || input?.new_string;
  if (name === "Write") return input?.content;
  if (name === "Bash") return input?.command?.length > 60 || result;
  if (name === "TodoWrite") return input?.todos?.length > 0;
  if (name === "WebFetch") return input?.prompt;
  if (name === "Task") return input?.prompt || result;
  if (name === "NotebookEdit") return input?.new_source;
  if (name === "Glob" || name === "Grep") return result && typeof result === "string" && result.trim().length > 0;
  return false;
}

/**
 * Main tool renderer dispatcher
 */
export function renderTool(msg, index, handlers) {
  const { name } = msg;

  switch (name) {
    case "Read":
      return renderToolRead(msg, index, handlers);
    case "Write":
      return renderToolWrite(msg, index, handlers);
    case "Edit":
      return renderToolEdit(msg, index, handlers);
    case "Bash":
      return renderToolBash(msg, index, handlers);
    case "TodoWrite":
      return renderToolTodo(msg, index, handlers);
    case "Glob":
    case "Grep":
      return renderToolSearch(msg, index, handlers);
    case "WebFetch":
      return renderToolWebFetch(msg, index, handlers);
    case "WebSearch":
      return renderToolWebSearch(msg, index);
    case "Task":
      return renderToolTask(msg, index, handlers);
    case "NotebookEdit":
      return renderToolNotebook(msg, index, handlers);
    case "AskUserQuestion":
      return renderToolAskUser(msg, index);
    case "AgentOutputTool":
      return renderToolAgentOutput(msg, index);
    case "BashOutput":
      return renderToolBashOutput(msg, index);
    case "KillShell":
      return renderToolKillShell(msg, index);
    case "EnterPlanMode":
    case "ExitPlanMode":
      return renderToolPlanMode(msg, index);
    default:
      return renderToolDefault(msg, index);
  }
}
