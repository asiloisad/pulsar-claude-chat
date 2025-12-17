/** @babel */

/**
 * Shared result parsing utilities for tool renderers
 */

// ============================================================================
// Text Parsing
// ============================================================================

/**
 * Count non-empty lines in a string
 */
export function countNonEmptyLines(text) {
  if (!text || typeof text !== "string") return 0;
  return text.trim().split("\n").filter((l) => l.trim()).length;
}

/**
 * Format line count as human-readable string
 */
export function formatLineCount(text) {
  if (!text || typeof text !== "string") return null;
  const count = text.split("\n").length;
  return `${count} ${count === 1 ? "line" : "lines"}`;
}

/**
 * Truncate string with suffix
 */
export function truncate(text, maxLength = 500, suffix = "...") {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + suffix;
}

/**
 * Truncate with character count suffix
 */
export function truncateWithCount(text, maxLength = 500) {
  if (!text || text.length <= maxLength) return text;
  const remaining = text.length - maxLength;
  return `${text.slice(0, maxLength)}\n... (${remaining} more chars)`;
}

// ============================================================================
// JSON Parsing
// ============================================================================

/**
 * Safely parse JSON result (for MCP tools)
 * Handles both direct JSON strings and MCP content arrays [{type: "text", text: "..."}]
 */
export function parseJsonResult(result) {
  if (!result) return null;
  try {
    // Handle MCP content array format: [{type: "text", text: "..."}]
    if (Array.isArray(result)) {
      const textBlock = result.find((b) => b.type === "text" && b.text);
      if (textBlock) {
        return JSON.parse(textBlock.text);
      }
      return result;
    }
    // Handle direct JSON string
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    return parsed?.data ?? parsed;
  } catch {
    return result;
  }
}

/**
 * Parse result with error handling
 */
export function safeParseJson(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// ============================================================================
// Search Results
// ============================================================================

/**
 * Parse search result lines into structured entries
 */
export function parseSearchResults(result, maxEntries = 50) {
  if (!result || typeof result !== "string") return [];

  return result
    .trim()
    .split("\n")
    .filter((l) => l)
    .slice(0, maxEntries)
    .map((line) => {
      // Match pattern: file:line:content
      const match = line.match(/^(.+?):(\d+):(.*)$/);
      if (match) {
        return {
          path: match[1],
          line: parseInt(match[2], 10),
          content: match[3],
        };
      }
      return { path: line };
    });
}

// ============================================================================
// Image/Preview Parsing
// ============================================================================

/**
 * Extract image preview from result array
 */
export function extractImagePreview(result) {
  if (typeof result === "string") return null;
  if (!Array.isArray(result)) return null;

  for (const block of result) {
    if (block.type === "image") {
      const source = block.source || block;
      const data = source.data || block.data;
      const mediaType = source.media_type || block.media_type || "image/jpeg";
      if (data) {
        return { type: "image", mediaType, data };
      }
    }
  }
  return null;
}

// ============================================================================
// Line Range Formatting
// ============================================================================

/**
 * Format line range from offset/limit parameters
 */
export function formatLineRange(input) {
  const { offset, limit } = input || {};
  if (offset && limit) return `lines ${offset}-${offset + limit - 1}`;
  if (offset) return `from line ${offset}`;
  if (limit) return `lines 1-${limit}`;
  return null;
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  countNonEmptyLines,
  formatLineCount,
  truncate,
  truncateWithCount,
  parseJsonResult,
  safeParseJson,
  parseSearchResults,
  extractImagePreview,
  formatLineRange,
};
