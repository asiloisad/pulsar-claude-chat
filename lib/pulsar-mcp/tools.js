/**
 * Tool definitions for Pulsar MCP server
 * Tool names use PascalCase (displayed as mcp__pulsar__ToolName)
 */

const tools = [
  // P0 - Must Have
  {
    name: "GetActiveEditor",
    description:
      "Get the active editor state. Returns {path: string|null, content: string, cursorPosition: {row, column} (0-indexed), grammar: string, modified: boolean}, or null if no editor is open.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "InsertText",
    description:
      "Insert text at cursor or replace selection. If text is selected, replaces it; otherwise inserts at cursor. Works with multi-cursor. Returns true on success, false if no editor.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to insert (replaces selection if any)",
        },
      },
      required: ["text"],
    },
  },

  // P1 - Important
  {
    name: "OpenFile",
    description:
      "Open a file in editor. All positions are 0-indexed. Returns true on success. Creates new file if path doesn't exist. Use GoToPosition to navigate in already-open file.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path (absolute or relative to project root)",
        },
        row: {
          type: "number",
          description: "Row to navigate to (0-indexed, optional)",
        },
        column: {
          type: "number",
          description: "Column to navigate to (0-indexed, optional)",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "GoToPosition",
    description:
      "Navigate to row/column in active editor. All positions are 0-indexed. Returns true on success, false if no editor. View centers on cursor. Use OpenFile to open+navigate in one step.",
    inputSchema: {
      type: "object",
      properties: {
        row: {
          type: "number",
          description: "Row number (0-indexed)",
        },
        column: {
          type: "number",
          description: "Column number (0-indexed, default: 0)",
        },
      },
      required: ["row"],
    },
  },
  {
    name: "GetOpenEditors",
    description:
      "List all open editor tabs. Returns array of {path: string|null, modified: boolean, active: boolean}. Untitled files have null path.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "GetProjectPaths",
    description: "Get project root folders. Returns string[] of absolute paths. Empty array if no project open.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "SaveFile",
    description:
      "Save a file. Returns true on success, false if file not found or no editor. If path omitted, saves active editor.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path to save (optional, defaults to active editor)",
        },
      },
      required: [],
    },
  },

  // P2 - Editor Enhancement
  {
    name: "SetSelections",
    description:
      "Set multi-cursor selections. All positions are 0-indexed. Example: [{startRow:0, startColumn:0, endRow:0, endColumn:5}] selects first 5 chars of line 1. Returns false if no editor.",
    inputSchema: {
      type: "object",
      properties: {
        ranges: {
          type: "array",
          description: "Array of selection ranges",
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
    name: "GetSelections",
    description:
      "Get all selections/cursors. Returns array of {text: string, isEmpty: boolean, range: {start: {row, column}, end: {row, column}}} (0-indexed). First element is primary selection. Returns null if no editor.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "CloseFile",
    description:
      "Close an editor tab. Returns true on success, false if file not found. If path omitted, closes active editor. Unsaved changes are discarded unless save=true.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path to close (optional, defaults to active editor)",
        },
        save: {
          type: "boolean",
          description: "Save before closing if modified (default: false)",
        },
      },
      required: [],
    },
  },

  // P3 - Text Operations
  {
    name: "Undo",
    description: "Undo last change. Returns true on success, false if no editor or nothing to undo.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "Redo",
    description: "Redo last undone change. Returns true on success, false if no editor or nothing to redo.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "FindText",
    description:
      "Find all matches in active editor. Returns {matches: [{text, range: {start: {row, column}, end: {row, column}}}], count}. All positions 0-indexed. Uses JavaScript regex. Returns null if no editor.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Search text or JavaScript regex pattern",
        },
        isRegex: {
          type: "boolean",
          description: "Treat pattern as regex (default: false)",
        },
        caseSensitive: {
          type: "boolean",
          description: "Case sensitive search (default: true)",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "GetContextAround",
    description:
      "Get lines around N-th match. Returns {matchText, matchRow (0-indexed), context: [{row, text, isMatch}], totalMatches}. All positions 0-indexed. Uses JavaScript regex. Error if matchIndex >= totalMatches.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Search text or JavaScript regex pattern",
        },
        matchIndex: {
          type: "number",
          description: "Which match (0-indexed, default: 0)",
        },
        linesBefore: {
          type: "number",
          description: "Context lines before match (default: 3)",
        },
        linesAfter: {
          type: "number",
          description: "Context lines after match (default: 3)",
        },
        isRegex: {
          type: "boolean",
          description: "Treat pattern as regex (default: false)",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "DeleteLines",
    description: "CAUTION: Delete rows permanently. All positions are 0-indexed, inclusive. For single row: use same start/end. Returns true on success, false if no editor or range invalid.",
    inputSchema: {
      type: "object",
      properties: {
        startRow: {
          type: "number",
          description: "First row to delete (0-indexed)",
        },
        endRow: {
          type: "number",
          description: "Last row to delete (0-indexed, inclusive). Same as startRow for single row.",
        },
      },
      required: ["startRow", "endRow"],
    },
  },
  {
    name: "GetLineCount",
    description: "Get total lines in active editor. Returns number, or null if no editor.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // P4 - Project Management
  {
    name: "SetProjectPaths",
    description: "CAUTION: Replace ALL project root paths. Existing paths are removed. Returns true on success. Use AddProjectPath to add without replacing.",
    inputSchema: {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Array of absolute folder paths",
        },
      },
      required: ["paths"],
    },
  },
  {
    name: "AddProjectPath",
    description: "Add a folder to project roots without removing existing paths. Returns true on success, false if path invalid.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute folder path to add",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "RemoveProjectPath",
    description: "Remove a folder from project roots. Returns true on success, false if path not in project.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute folder path to remove",
        },
      },
      required: ["path"],
    },
  },

  // P5 - Buffer Range Operations
  {
    name: "GetTextInBufferRange",
    description: "Get text from range in active editor. All positions are 0-indexed. Returns string, or null if no editor.",
    inputSchema: {
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
  {
    name: "SetTextInBufferRange",
    description: "Replace text in range. All positions are 0-indexed. Returns true on success, false if no editor. Use for precise edits.",
    inputSchema: {
      type: "object",
      properties: {
        startRow: { type: "number", description: "Start line (0-indexed)" },
        startColumn: { type: "number", description: "Start column (0-indexed)" },
        endRow: { type: "number", description: "End line (0-indexed)" },
        endColumn: { type: "number", description: "End column (0-indexed)" },
        text: { type: "string", description: "Replacement text" },
      },
      required: ["startRow", "startColumn", "endRow", "endColumn", "text"],
    },
  },
  {
    name: "ScanInBufferRange",
    description: "Find matches within range. All positions are 0-indexed. Returns {matches: [{text, range (0-indexed)}], count}. Uses JavaScript regex. Use FindText to search entire file.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Search text or JavaScript regex" },
        startRow: { type: "number", description: "Start line (0-indexed)" },
        startColumn: { type: "number", description: "Start column (0-indexed)" },
        endRow: { type: "number", description: "End line (0-indexed)" },
        endColumn: { type: "number", description: "End column (0-indexed)" },
        isRegex: { type: "boolean", description: "Treat pattern as regex (default: false)" },
      },
      required: ["pattern", "startRow", "startColumn", "endRow", "endColumn"],
    },
  },

  // P6 - Workspace-wide Operations
  {
    name: "ScanWorkspace",
    description: "Search all project files. Returns {results: [{filePath, matches: [{lineText, row, matchText, range}]}], totalMatches}. All positions 0-indexed. Uses JavaScript regex. Limit scope with glob paths.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "JavaScript regex pattern" },
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Glob patterns to filter files, e.g. ['**/*.js', '!node_modules/**']",
        },
        maxResults: { type: "number", description: "Max results (default: 100)" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "ReplaceInWorkspace",
    description: "CAUTION: Find/replace across ALL project files. Use dryRun=true first to preview. Returns {results: [{filePath, matchCount}], totalReplacements, replaced}. Supports $1, $2 for capture groups.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "JavaScript regex pattern" },
        replacement: { type: "string", description: "Replacement text (use $1, $2 for capture groups)" },
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Glob patterns to filter files, e.g. ['src/**/*.js']",
        },
        dryRun: { type: "boolean", description: "Preview only, no changes (default: false, RECOMMENDED: true first)" },
      },
      required: ["pattern", "replacement"],
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
