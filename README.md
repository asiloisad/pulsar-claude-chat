# claude-chat

Interactive chat panel for [Claude Code](https://github.com/anthropics/claude-code).

- Streaming responses with real-time text display.
- Markdown rendering with syntax highlighting.
- Timeline-based message display showing conversation flow.
- Session persistence - conversations are saved and can be resumed.
- Chat history browser to revisit previous sessions.
- Context extender methods.
- Extended thinking toggle.
- Permission modes switch.

## Installation

To install `claude-chat` search for [claude-chat](https://web.pulsar-edit.dev/packages/claude-chat) in the Install pane of the Pulsar settings or run `ppm install claude-chat`. Alternatively, you can run `ppm install asiloisad/pulsar-claude-chat` to install a package directly from the GitHub repository.

## Service API

The package provides a `claude-chat` service that other packages can consume:

```javascript
// In your package.json:
"consumedServices": {
  "claude-chat": {
    "versions": { "^1.0.0": "consumeClaudeChat" }
  }
}

// In your package:
consumeClaudeChat(service) {
  this.claudeChat = service;
}
```

### Methods

#### `sendPrompt(text, options)`

Send a prompt to Claude programmatically.

```javascript
// Simple prompt
await service.sendPrompt("Explain this code");

// With attach context
await service.sendPrompt("Review this selection", {
  attachContext: {
    type: "selection",
    paths: ["src/app.js"],
    line: 42,
    selection: "const foo = bar()",
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

#### `setAttachContext(context)`

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
- `selection` - Code selection with `paths`, `line`, `selection`
- `position` - Cursor position with `paths`, `line`, `column`
- `image` - Image file with optional region selection

#### `clearAttachContext()`

Clear the current attach context.

#### `hasPanel()`

Check if the chat panel exists. Returns `boolean`.

#### `onDidReceiveMessage(callback)`

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

# Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub — any feedback’s welcome!
