/** @babel */
/** @jsx etch.dom */

import etch from "etch";
import { renderTool } from "./tool-renderers";

/**
 * Generate tooltip text for attach context
 */
function getAttachTooltip(attach) {
  if (!attach) return "";

  const { type, paths, line, column, selection } = attach;

  if (type === "selection" && selection) {
    return `Selection from ${paths[0]}:${line}\n${selection.length} characters`;
  } else if (type === "position") {
    return `Position: ${paths[0]}:${line}:${column}`;
  } else if (type === "paths") {
    if (paths.length === 1) {
      return `Path: ${paths[0]}`;
    }
    return `Paths:\n${paths.join("\n")}`;
  }
  return attach.label || "";
}

/**
 * Render attach context badge
 */
function renderAttachBadge(attach) {
  if (!attach) return null;

  let label = attach.label;
  let icon = attach.icon || "mention";
  let tooltip = getAttachTooltip(attach);

  return (
    <span className="attach-badge" title={tooltip}>
      <span className={`icon-${icon}`}></span>
      <span className="attach-badge-label">{label}</span>
    </span>
  );
}

/**
 * Render a user message - preserve newlines as user typed them
 */
export function renderUserMessage(msg, index) {
  // Convert newlines to <br> before markdown processing to preserve user's formatting
  const withBreaks = msg.content.replace(/\n/g, "  \n");
  const html = atom.ui.markdown.render(withBreaks);
  return (
    <div className="message message-user" key={index}>
      <div className="message-role">
        You
        {renderAttachBadge(msg.attach)}
      </div>
      <div className="message-content message-markdown" innerHTML={html} />
    </div>
  );
}

/**
 * Render thinking content in a collapsible block
 */
function renderThinkingBlock(thinking, collapsed = true) {
  if (!thinking) return null;

  // Truncate preview to first line or 100 chars
  const lines = thinking.split("\n");
  let preview = lines[0];
  if (preview.length > 100) {
    preview = preview.slice(0, 100) + "...";
  } else if (lines.length > 1) {
    preview += "...";
  }

  return (
    <details className="thinking-block" open={!collapsed}>
      <summary className="thinking-header">
        <span className="icon-light-bulb"></span>
        <span className="thinking-label">Thinking</span>
        <span className="thinking-preview">{preview}</span>
      </summary>
      <div className="thinking-content">
        <pre>{thinking}</pre>
      </div>
    </details>
  );
}

/**
 * Render an assistant message with markdown
 */
export function renderAssistantMessage(msg, index) {
  const html = atom.ui.markdown.render(msg.content);
  return (
    <div className="message message-assistant" key={index}>
      {renderThinkingBlock(msg.thinking)}
      <div className="message-content message-markdown" innerHTML={html} />
    </div>
  );
}

/**
 * Render an error message
 */
export function renderErrorMessage(msg, index) {
  const html = atom.ui.markdown.render(msg.content);
  return (
    <div className="message message-error" key={index}>
      <span className="error-icon">!</span>
      <span className="error-text message-markdown" innerHTML={html} />
    </div>
  );
}

/**
 * Render streaming thinking content (live, not collapsible)
 */
function renderStreamingThinking(thinking) {
  if (!thinking) return null;

  return (
    <div className="thinking-block thinking-streaming">
      <div className="thinking-header">
        <span className="icon-light-bulb"></span>
        <span className="thinking-label">Thinking</span>
        <span className="streaming-indicator"></span>
      </div>
      <div className="thinking-content">
        <pre>{thinking}</pre>
      </div>
    </div>
  );
}

/**
 * Render the current streaming response wrapped in timeline
 */
export function renderStreamingMessage(
  currentText,
  isLoading,
  currentThinking = ""
) {
  if (!currentText && !isLoading && !currentThinking) return null;

  const html = currentText ? atom.ui.markdown.render(currentText) : "";

  const showCursor = isLoading && currentText;
  const isOnlyThinking = isLoading && !currentText && currentThinking;

  return (
    <div className="response-sequence streaming-sequence">
      <div className="timeline-item timeline-last">
        <div className="timeline-dot dot-assistant"></div>
        <div className="timeline-content">
          <div
            className={`message message-assistant${
              showCursor ? " streaming" : ""
            }`}
          >
            {renderStreamingThinking(currentThinking)}
            <div
              className="message-content message-markdown"
              innerHTML={html}
            />
            {isLoading && !currentText && !currentThinking ? (
              <div className="loading-indicator">
                <span>Thinking</span>
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Render permission request UI
 */
export function renderPermissionRequest(pendingPermission, onPermission) {
  if (!pendingPermission) return null;

  return (
    <div className="permission-request">
      <span className="permission-text">Allow {pendingPermission}?</span>
      <button
        className="btn btn-success btn-sm"
        on={{ click: () => onPermission("allow") }}
      >
        Allow
      </button>
      <button
        className="btn btn-error btn-sm"
        on={{ click: () => onPermission("deny") }}
      >
        Deny
      </button>
    </div>
  );
}

/**
 * Group messages by user messages (user messages split the timeline)
 */
function groupMessagesByUser(messages) {
  const groups = [];
  let currentItems = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      if (currentItems.length > 0) {
        groups.push({ type: "response", items: currentItems });
        currentItems = [];
      }
      groups.push({ type: "user", message: msg });
    } else {
      currentItems.push(msg);
    }
  }

  if (currentItems.length > 0) {
    groups.push({ type: "response", items: currentItems });
  }

  return groups;
}

/**
 * Get the dot CSS class for a message type
 */
function getDotClass(msg) {
  if (msg.role === "assistant") return "dot-assistant";
  if (msg.role === "tool") return `dot-tool dot-${msg.name.toLowerCase()}`;
  if (msg.role === "error") return "dot-error";
  return "dot-default";
}

/**
 * Render a single timeline item
 */
function renderTimelineItem(msg, index, toolHandlers) {
  switch (msg.role) {
    case "assistant":
      return renderAssistantMessage(msg, index);
    case "tool":
      return renderTool(msg, index, toolHandlers);
    case "error":
      return renderErrorMessage(msg, index);
    default:
      return null;
  }
}

/**
 * Render a user message block (standalone, outside timeline)
 */
function renderUserMessageBlock(msg, index) {
  return (
    <div className="user-message-block" key={`user-${index}`}>
      {renderUserMessage(msg, index)}
    </div>
  );
}

/**
 * Render a response sequence with timeline
 * @param {boolean} hasMoreContent - true if streaming/more content follows this sequence
 */
function renderResponseSequence(
  items,
  groupIndex,
  toolHandlers,
  hasMoreContent = false
) {
  return (
    <div className="response-sequence" key={`response-${groupIndex}`}>
      {items.map((item, i) => {
        const isLastItem = i === items.length - 1;
        // Only mark as timeline-last if it's the last item AND no more content follows
        const isTimelineLast = isLastItem && !hasMoreContent;
        const dotClass = getDotClass(item);

        return (
          <div
            className={`timeline-item ${isTimelineLast ? "timeline-last" : ""}`}
            key={i}
          >
            <div className={`timeline-dot ${dotClass}`}></div>
            {!isTimelineLast ? <div className="timeline-line"></div> : null}
            <div className="timeline-content">
              {renderTimelineItem(item, i, toolHandlers)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Render all messages in the conversation with timeline grouping
 * @param {boolean} isStreaming - true if streaming response is active
 */
export function renderMessages(messages, toolHandlers, isStreaming = false) {
  const groups = groupMessagesByUser(messages);

  return groups.map((group, groupIndex) => {
    const isLastGroup = groupIndex === groups.length - 1;

    if (group.type === "user") {
      return renderUserMessageBlock(group.message, groupIndex);
    } else {
      // If this is the last response group and streaming is active, show connecting line
      const hasMoreContent = isLastGroup && isStreaming;
      return renderResponseSequence(
        group.items,
        groupIndex,
        toolHandlers,
        hasMoreContent
      );
    }
  });
}

/**
 * Render welcome page when no messages
 */
export function renderWelcomePage() {
  return (
    <div className="welcome-page">
      <div className="welcome-content">
        <h2 className="welcome-title">Claude Chat</h2>
        <p className="welcome-subtitle">AI assistant for Pulsar</p>

        <div className="welcome-tips">
          <div className="tip-section">
            <h3>Getting Started</h3>
            <ul>
              <li>Type a message below and press <kbd>Enter</kbd> to send</li>
              <li>Use <kbd>Shift+Enter</kbd> for new lines</li>
              <li>Press <kbd>Escape</kbd> to clear the input</li>
            </ul>
          </div>

          <div className="tip-section">
            <h3>Attach Context</h3>
            <ul>
              <li>Select code and use context menu to attach selection</li>
              <li>Right-click files in tree view to attach paths</li>
              <li>Attach current file position for precise references</li>
            </ul>
          </div>

          <div className="tip-section">
            <h3>Permission Modes</h3>
            <ul>
              <li><kbd>Ctrl+1</kbd> Default — Ask before actions</li>
              <li><kbd>Ctrl+2</kbd> Plan — Read-only mode</li>
              <li><kbd>Ctrl+3</kbd> Accept Edits — Auto-apply changes</li>
              <li><kbd>Ctrl+4</kbd> Bypass — Auto-approve all</li>
            </ul>
          </div>

          <div className="tip-section">
            <h3>Extended Thinking</h3>
            <ul>
              <li>Press <kbd>Ctrl+0</kbd> to toggle extended thinking</li>
              <li>Helps with complex reasoning tasks</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
