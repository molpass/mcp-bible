// Shared return type for all deterministic MCP tools.
export type ToolResult = {
  content: { type: "text"; text: string }[];
};
