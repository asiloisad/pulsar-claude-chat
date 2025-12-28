# claude-chat

Interactive chat panel for [Claude Code](https://github.com/anthropics/claude-code). Provides a conversational interface with streaming responses, markdown rendering, and session management.

## Features

- **Streaming responses**: Real-time text display as Claude responds.
- **Markdown rendering**: Syntax highlighting for code blocks.
- **Session persistence**: Conversations are saved and can be resumed.
- **Chat history**: Browse and revisit previous sessions.
- **Context extender**: Attach selections, files, or images to prompts.
- **Permission modes**: Switch between permission levels.
- **MCP integration**: Auto-connects with [pulsar-mcp](https://github.com/asiloisad/pulsar-mcp).

## Installation

To install `claude-chat` search for [claude-chat](https://web.pulsar-edit.dev/packages/claude-chat) in the Install pane of the Pulsar settings or run `ppm install claude-chat`. Alternatively, you can run `ppm install asiloisad/pulsar-claude-chat` to install a package directly from the GitHub repository.

## Chat history

Chat sessions are stored in `~/.pulsar/claude-chat-sessions/` directory. Each session is saved as a JSON file containing messages, timestamps, project paths, and token usage.

## Service

The package provides a `claude-chat` service for other packages.

In your `package.json`:

```json
{
  "consumedServices": {
    "claude-chat": {
      "versions": { "^1.0.0": "consumeClaudeChat" }
    }
  }
}
```

In your main module:

```javascript
module.exports = {
  consumeClaudeChat(service) {
    this.claudeChat = service;
  }
}
```

### `sendPrompt(text, options)`

Send a prompt to Claude programmatically.

```javascript
// Simple prompt
await service.sendPrompt("Explain this code");

// With attach context (supports multi-cursor selections)
await service.sendPrompt("Review this selection", {
  attachContext: {
    type: "selections",
    path: "src/app.js",
    line: 42,
    selections: [
      { text: "const foo = bar()", range: { start: { row: 41, column: 0 }, end: { row: 41, column: 18 } } }
    ],
    label: "src/app.js:42",
    icon: "code"
  }
});

// Without focusing the panel
await service.sendPrompt("Run tests", { focus: false });
```

**Options:**
- `attachContext` - Context to attach (selection, paths, position, image)
- `focus` - Whether to focus the panel after sending (default: `true`)

**Returns:** `Promise<boolean>` - Whether the message was sent successfully.

### `setAttachContext(context)`

Set the attach context without sending a message.

```javascript
service.setAttachContext({
  type: "paths",
  paths: ["relative/path/to/file.js"],
  label: "file.js",
  icon: "file"
});
```

**Context types:**
- `paths` - File or directory paths
- `selections` - Selections/cursors with `path`, `line`, `selections` array (empty text = cursor position)
- `image` - Image file with optional region selection

### `clearAttachContext()`

Clear the current attach context.

### `hasPanel()`

Check if the chat panel exists. Returns `boolean`.

### `onDidReceiveMessage(callback)`

Subscribe to receive messages from Claude.

```javascript
const disposable = service.onDidReceiveMessage((message) => {
  console.log("Claude responded:", message.content);
  if (message.thinking) {
    console.log("Thinking:", message.thinking);
  }
});

// Later, to unsubscribe:
disposable.dispose();
```

**Message object:**
- `role` - Always `"assistant"`
- `content` - The response text
- `thinking` - Extended thinking content (if enabled)

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub — any feedback's welcome!
