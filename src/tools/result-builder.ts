/**
 * result-builder.ts
 *
 * Single choke-point for building dual-payload CallToolResults.
 * Migrated handlers call buildResult() to return BOTH:
 *  - structuredContent: typed JSON for agent consumption
 *  - content[0].text: human-readable text (preserved for backward compat)
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Build a dual-payload CallToolResult.
 *
 * @param data         The structured data to expose as `structuredContent`.
 *                     Must be JSON-serializable (Record<string, unknown>).
 * @param textRenderer Pure function that converts data to human-readable text.
 *                     Errors thrown here propagate — callers assume valid data.
 */
export function buildResult<T extends Record<string, unknown>>(
  data: T,
  textRenderer: (d: T) => string,
): CallToolResult {
  return {
    structuredContent: data,
    content: [{ type: 'text', text: textRenderer(data) }],
  };
}
