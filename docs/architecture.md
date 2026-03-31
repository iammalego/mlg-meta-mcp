# Architecture

This document explains how `mlg-meta-mcp` handles MCP requests today and where public tool behavior lives.

## Runtime flow

1. `src/index.ts` loads environment variables and validates config through `src/config/index.ts`.
2. The MCP SDK server starts over stdio and registers handlers for `ListTools` and `CallTool`.
3. `ListTools` returns the tool catalog from `getAllTools()` in `src/tools/index.ts`.
4. `CallTool` forwards the tool name and arguments to `handleToolCall()` in `src/tools/handlers.ts`.
5. `parseToolArgs()` validates inputs against the Zod schema defined in the tool registry.
6. The selected handler calls a service layer method.
7. Services use one or more API clients to talk to the Meta Marketing API.
8. The handler formats the final MCP text response for the client.

## Zod-first tool registry

The tool registry lives in `src/tools/index.ts` and is the public contract source of truth.

- Each tool is declared once with a description and a Zod schema.
- Runtime validation uses the same schema via `parseToolArgs()`.
- MCP JSON Schema is derived from the same definitions via `zodToJsonSchema()`.

That means documentation, validation, and MCP discovery should all stay aligned with the registry instead of drifting across separate files.

## Layer responsibilities

### MCP runtime

- `src/index.ts`
  - boots the server
  - initializes service singletons
  - registers MCP request handlers
  - exposes the tool list over stdio

### Tool registry and handlers

- `src/tools/index.ts`
  - defines all 20 public tools
  - exports MCP-friendly schemas
  - enforces argument validation
- `src/tools/handlers.ts`
  - routes tool calls by name
  - keeps MCP-facing formatting in one place
  - translates service results into concise text responses

### Service layer

- `src/services/account-service.ts`
  - discovers accessible ad accounts
  - caches account discovery results with a TTL
  - resolves account names to IDs
- `src/services/campaign-service.ts`
  - campaign CRUD-style operations and campaign cloning
- `src/services/adset-service.ts`
  - ad set reads, writes, status changes, and cloning
- `src/services/ad-service.ts`
  - ad reads and creation
- `src/services/insights-service.ts`
  - metrics aggregation
  - period-over-period comparison logic
  - campaign fallback selection for `compareTwoPeriods`

### API client layer

- `src/api/base-client.ts`
  - shared HTTP transport
  - access token injection
  - retry and exponential backoff
  - Meta error classification
- `src/api/business-client.ts`
  - account discovery through Business endpoints
- `src/api/graph-client.ts`
  - campaigns, ad sets, and ads CRUD/status operations
- `src/api/insights-client.ts`
  - insights reads for account, campaign, ad set, and ad levels

## `compareTwoPeriods` placement

`compareTwoPeriods` is intentionally implemented in `src/services/insights-service.ts`, not in handlers or raw API clients.

Why it lives there:

- the handler should only validate input and format output
- the API clients should only fetch raw Meta data
- the fallback chain requires business rules across multiple sources

For campaign comparisons, the service combines:

- current campaign metadata from `GraphClient`
- current and previous period insights from `InsightsClient`
- sibling campaign and ad set metadata from the same account

## Campaign fallback behavior

For `level=campaign`, the comparison uses this order:

1. the same campaign in the previous period
2. the most similar campaign in the same account
3. the account's campaign average for the previous period
4. a zero baseline when no historical reference exists

The similar-campaign fallback is constrained by:

- same `objective`
- same dominant ad set `optimizationGoal`

Valid candidates are then ranked by:

- budget similarity
- bid strategy match
- billing event match
- name similarity as a tie-breaker

## Contributor guidance

When changing public behavior:

1. update the Zod schema in `src/tools/index.ts`
2. update handler formatting if the response shape changed
3. update service logic if the business rule changed
4. update `README.md` and `docs/api.md` so public docs stay accurate

If a change crosses layers, keep responsibilities clean instead of pushing more logic into handlers.
