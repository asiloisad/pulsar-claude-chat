/**
 * Tool definitions for Pulsar MCP server
 * Tool names use PascalCase (displayed as mcp__pulsar__ToolName)
 */

const tools = [
  // P0 - Must Have
  {
    name: "GetActiveEditor",
    description:
      "Get the content, file path, cursor position, and grammar of the active editor in Pulsar. Returns null if no editor is open.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "GetSelection",
    description:
      "Get the currently selected text and its range in the active editor. Returns null if no selection or no editor is open.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "InsertText",
    description:
      "Insert text at the current cursor position in the active editor. The cursor will be positioned after the inserted text.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to insert at the cursor position",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "ReplaceSelection",
    description:
      "Replace the currently selected text with new text. If no text is selected, the new text will be inserted at the cursor position.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to replace the selection with",
        },
      },
      required: ["text"],
    },
  },

  // P1 - Important
  {
    name: "OpenFile",
    description:
      "Open a file in Pulsar editor. Optionally navigate to a specific line and column.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file path to open (absolute or relative to project)",
        },
        line: {
          type: "number",
          description: "Line number to navigate to (1-indexed)",
        },
        column: {
          type: "number",
          description: "Column number to navigate to (1-indexed)",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "GoToPosition",
    description:
      "Navigate to a specific line and column in the active editor.",
    inputSchema: {
      type: "object",
      properties: {
        line: {
          type: "number",
          description: "Line number to navigate to (1-indexed)",
        },
        column: {
          type: "number",
          description: "Column number to navigate to (1-indexed, default: 1)",
        },
      },
      required: ["line"],
    },
  },
  {
    name: "GetOpenEditors",
    description:
      "Get a list of all open editor tabs with their file paths and modification status.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "GetProjectPaths",
    description: "Get the list of project root folder paths currently open in Pulsar.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "SaveFile",
    description:
      "Save the current file or a specific file by path. If no path is provided, saves the active editor.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Optional file path to save. If not provided, saves the active editor.",
        },
      },
      required: [],
    },
  },
];

/**
 * Get tool definition by name
 */
function getToolByName(name) {
  return tools.find((t) => t.name === name);
}

module.exports = { tools, getToolByName };
