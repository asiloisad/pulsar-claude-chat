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

  // P2 - Editor Enhancement
  {
    name: "SetSelections",
    description:
      "Set one or more selections in the active editor. Supports multi-cursor by providing multiple ranges.",
    inputSchema: {
      type: "object",
      properties: {
        ranges: {
          type: "array",
          description: "Array of selection ranges to set",
          items: {
            type: "object",
            properties: {
              startRow: { type: "number", description: "Start line (0-indexed)" },
              startColumn: { type: "number", description: "Start column (0-indexed)" },
              endRow: { type: "number", description: "End line (0-indexed)" },
              endColumn: { type: "number", description: "End column (0-indexed)" },
            },
            required: ["startRow", "startColumn", "endRow", "endColumn"],
          },
        },
      },
      required: ["ranges"],
    },
  },
  {
    name: "GetAllSelections",
    description:
      "Get all current selections in the active editor. Returns an array of selections with their text and ranges. Useful for multi-cursor editing.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "RevealInTreeView",
    description:
      "Reveal and select a file or folder in the tree view panel. Opens the tree view if it's not visible.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file or folder path to reveal in the tree view",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "CloseFile",
    description:
      "Close an open editor tab. If no path is provided, closes the active editor.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Optional file path to close. If not provided, closes the active editor.",
        },
        save: {
          type: "boolean",
          description: "Whether to save the file before closing if it has unsaved changes. Default: false (will prompt or discard).",
        },
      },
      required: [],
    },
  },
  {
    name: "SplitPane",
    description:
      "Split the current pane in a specified direction and optionally open a file in the new pane.",
    inputSchema: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: ["left", "right", "up", "down"],
          description: "Direction to split the pane",
        },
        path: {
          type: "string",
          description: "Optional file path to open in the new pane",
        },
      },
      required: ["direction"],
    },
  },
  {
    name: "ClosePane",
    description:
      "Close the active pane. If it's the last pane, this will close the window.",
    inputSchema: {
      type: "object",
      properties: {
        saveAll: {
          type: "boolean",
          description: "Whether to save all modified files in the pane before closing. Default: false.",
        },
      },
      required: [],
    },
  },
  {
    name: "GetPanelState",
    description:
      "Get the visibility state of all docks (panels) in the workspace: left, right, and bottom.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // P3 - Text Operations
  {
    name: "Undo",
    description: "Undo the last change in the active editor.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "Redo",
    description: "Redo the last undone change in the active editor.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "FindText",
    description:
      "Find all occurrences of a substring or regex pattern in the active editor. Returns positions and matched text.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The text or regex pattern to search for",
        },
        isRegex: {
          type: "boolean",
          description: "Whether to treat the pattern as a regular expression. Default: false",
        },
        caseSensitive: {
          type: "boolean",
          description: "Whether the search is case sensitive. Default: true",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "GetContextAround",
    description:
      "Get lines of context around the N-th match of a pattern. Useful for understanding code context.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The text or regex pattern to search for",
        },
        matchIndex: {
          type: "number",
          description: "Which match to get context around (0-indexed). Default: 0 (first match)",
        },
        linesBefore: {
          type: "number",
          description: "Number of lines to include before the match. Default: 3",
        },
        linesAfter: {
          type: "number",
          description: "Number of lines to include after the match. Default: 3",
        },
        isRegex: {
          type: "boolean",
          description: "Whether to treat the pattern as a regular expression. Default: false",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "DeleteLine",
    description: "Delete a single line at the specified line number in the active editor.",
    inputSchema: {
      type: "object",
      properties: {
        line: {
          type: "number",
          description: "The line number to delete (1-indexed)",
        },
      },
      required: ["line"],
    },
  },
  {
    name: "DeleteLineRange",
    description: "Delete a range of lines in the active editor.",
    inputSchema: {
      type: "object",
      properties: {
        startLine: {
          type: "number",
          description: "The first line to delete (1-indexed, inclusive)",
        },
        endLine: {
          type: "number",
          description: "The last line to delete (1-indexed, inclusive)",
        },
      },
      required: ["startLine", "endLine"],
    },
  },
  {
    name: "GetLineCount",
    description: "Get the total number of lines in the active editor.",
    inputSchema: {
      type: "object",
      properties: {},
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
