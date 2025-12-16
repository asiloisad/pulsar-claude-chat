#!/usr/bin/env node

/**
 * MCP Server for Pulsar editor
 * Spawned by Claude CLI, communicates via stdio
 *
 * This file is executed as a standalone process by Claude CLI.
 * It connects to the HTTP bridge running inside Pulsar to execute tools.
 *
 * Environment variables:
 *   PULSAR_BRIDGE_PORT - Port of the bridge server (default: 3000)
 *   PULSAR_BRIDGE_HOST - Host of the bridge server (default: 127.0.0.1)
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require("@modelcontextprotocol/sdk/types.js");
const { tools } = require("./tools");

const BRIDGE_PORT = parseInt(process.env.PULSAR_BRIDGE_PORT || "3000", 10);
const BRIDGE_HOST = process.env.PULSAR_BRIDGE_HOST || "127.0.0.1";

/**
 * Call the Pulsar bridge HTTP server to execute a tool
 */
async function callBridge(toolName, args) {
  const url = `http://${BRIDGE_HOST}:${BRIDGE_PORT}/tools/${toolName}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || `Tool call failed: ${toolName}`);
  }

  return result.data;
}

/**
 * Check if the bridge is available
 */
async function checkBridge() {
  try {
    const url = `http://${BRIDGE_HOST}:${BRIDGE_PORT}/health`;
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Create and start the MCP server
 */
async function startMcpServer() {
  const server = new Server(
    {
      name: "pulsar",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Check if bridge is available
    const bridgeAvailable = await checkBridge();
    if (!bridgeAvailable) {
      throw new McpError(
        ErrorCode.InternalError,
        `Pulsar bridge not available at http://${BRIDGE_HOST}:${BRIDGE_PORT}. ` +
          "Make sure Pulsar is running with the claude-chat package activated."
      );
    }

    // Validate tool exists
    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    try {
      const result = await callBridge(name, args ?? {});

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, message);
    }
  });

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[claude-chat] MCP server started");
}

// Start the server if run directly
startMcpServer().catch((error) => {
  console.error("[claude-chat] Failed to start MCP server:", error);
  process.exit(1);
});
