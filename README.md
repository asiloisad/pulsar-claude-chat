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

The package provides a `claude-chat` service that other packages can consume to set focus context programmatically:

```javascript
// In your package.json consumedServices:
"claude-chat": {
  "versions": {
    "^1.0.0": "consumeClaudeChat"
  }
}

// In your package:
consumeClaudeChat(service) {
  service.setFocusContext({
    type: 'paths',
    paths: ['relative/path/to/file.js'],
    label: 'file.js',
    icon: 'file'
  });
}
```

# Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub — any feedback’s welcome!
