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
8. The handler returns the final MCP response envelope for the client, including readable text and structured content when useful.

## Core contract principle

Core MCP tool contracts must stay neutral and preserve maximal useful signal.

- Consumers (LLMs, apps, UI layers, prompts) own filtering and interpretation.
- Handlers may add ergonomic summaries and readable formatting.
- Handlers must not destructively remove useful signal just to optimize for one author's workflow.
- Project-specific business rules belong in higher-level workflows or service logic, not in the base contract shape.

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
  - defines all 30 public tools
  - exports MCP-friendly schemas
  - enforces argument validation
- `src/tools/handlers.ts`
  - routes tool calls by name
  - keeps MCP-facing response shaping in one place
  - can return concise text summaries and structured content together
  - should preserve service signal instead of filtering it down to one preferred workflow

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
  - campaigns, ad sets, ads CRUD/status operations
  - detail getters (getAccountInfo, getCampaignDetails, getAdSetDetails, getAdDetails)
  - ad creation and update
  - budget schedule creation
- `src/api/insights-client.ts`
  - insights reads for account, campaign, ad set, and ad levels
- `src/api/targeting-client.ts`
  - targeting search tools via Meta's `/search` endpoint
  - interests, behaviors, demographics, geo locations
- `src/api/creative-client.ts`
  - ad creative reads and writes
  - image uploads via multipart/form-data

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

It also resolves one explicit result definition for the comparison (`primary_from_insights`, `specific_action`, or `all_actions`) so both periods use the same result meaning, while letting the handler filter the rendered metric set to the requested/default metrics.

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

1. update the Zod schema and tool description in `src/tools/index.ts`
2. update handler response shaping if the response envelope changed
3. update service logic if the business rule changed
4. update `README.md` and `docs/api.md` so public docs stay accurate

If a change crosses layers, keep responsibilities clean instead of pushing more logic into handlers.
