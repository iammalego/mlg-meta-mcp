# mlg-meta-mcp

[![CI](https://github.com/iammalego/mlg-meta-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/iammalego/mlg-meta-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-green.svg)](https://modelcontextprotocol.io/)

Open-source MCP server for Meta Ads with account discovery, campaign operations, insights, and LLM-friendly workflows.

`mlg-meta-mcp` is designed for developers and operators who want more than a thin proxy over the Meta Marketing API. It adds account discovery, business-oriented outputs, productivity tools, and comparison flows that are easier for LLMs and agents to use in real workflows.

## Why this project exists

Many Meta Ads MCP servers stop at exposing raw API calls. That is useful, but not always enough for real agent workflows.

This project aims to be more practical in day-to-day usage:

- **Automatic account discovery** instead of hard-wiring a single account
- **Business-oriented insights** instead of raw metric dumps
- **Safer productivity operations** like clone and bulk status changes
- **LLM-friendly responses** that summarize what happened and why it matters
- **Structured comparison logic** for period-over-period analysis

## Contract design principle

Core MCP tools should return maximal useful signal for the broadest set of consumers.

- consumers (LLMs, apps, prompts, UI layers) own filtering and interpretation
- formatting and ergonomic summaries are good
- destructive filtering of useful signal in the base tool contract is not
- project-specific business rules should live in higher-level workflows, not in neutral core tool outputs

## What it includes today

### Account discovery

- Discover all ad accounts accessible by the configured System User token
- Resolve accounts by ID or by account name

### Campaign operations

- Get campaigns
- Create campaigns
- Update campaigns
- Pause campaigns
- Activate campaigns

### Ad set operations

- Get ad sets from an account or campaign
- Create ad sets
- Update ad sets
- Pause ad sets
- Activate ad sets

### Ad operations

- Get ads

### Insights and analysis

- Get insights for account, campaign, ad set, or ad
- Compare two explicit periods with business-aware fallback logic

### Productivity tools

- Clone campaigns (with ad sets)
- Clone ad sets
- Bulk pause campaigns
- Bulk activate campaigns
- Check alerts with configurable thresholds

## Highlighted workflows

This MCP is especially useful for these workflows:

1. **Discover accessible ad accounts automatically**
2. **Inspect campaign, ad set, ad, or account performance**
3. **Compare campaign performance across two periods**
4. **Duplicate winning structures quickly**
5. **Pause or activate many campaigns in one action**
6. **Generate alert-oriented summaries from Meta Ads data**

## How `compareTwoPeriods` works

`compareTwoPeriods` compares performance between two explicit periods for one of four levels:

- `account`
- `campaign`
- `adset`
- `ad`

Each side now accepts either:

- `datePreset` (`today`, `yesterday`, `last_7d`, `last_30d`, `this_month`, `last_month`)
- `timeRange` with `{ since, until }` in `YYYY-MM-DD` format

The tool also supports explicit result selection:

- `primary_from_insights` (default) — resolve one action type from the insights and apply it to both periods
- `specific_action` — compare one explicit Meta `action_type` like `lead` or `purchase`
- `all_actions` — sum all action types

It also supports optional metric selection:

- `spend`
- `results`
- `cpr`
- `impressions`
- `clicks`
- `ctr`

If `metrics` is omitted, the tool keeps the backward-compatible default set: `spend`, `results`, and `cpr`.

The response now makes the resolved result definition explicit so consumers can see what `results` means.

### For `account`, `adset`, and `ad`

The comparison is direct:

- current period for the same object
- previous period for the same object

### For `campaign`

Campaign comparisons use a smarter fallback chain:

1. **Same campaign in the previous period**
2. **Most similar campaign in the same account**
3. **Account campaign average for the previous period**
4. **No reference available**

The tool response explicitly tells the user which reference was used.

### Similar campaign logic

The similar-campaign fallback is not based only on naming.

It requires:

- same campaign `objective`
- same dominant ad set `optimizationGoal`

Then it ranks valid candidates using:

- budget similarity
- bid strategy match
- billing event match
- name similarity as a tie-breaker

## Installation

```bash
git clone https://github.com/iammalego/mlg-meta-mcp.git
cd mlg-meta-mcp
npm install
cp .env.example .env
```

Then edit `.env` with your Meta credentials.

## Configuration

### Required environment variables

```env
META_SYSTEM_USER_TOKEN=your_system_user_token_here
META_API_VERSION=v22.0
LOG_LEVEL=info
```

### Required Meta permissions

Your token should have permissions appropriate for the operations you want to run. In most setups, that includes:

- `ads_management`
- `ads_read`
- `business_management`

## Local development

```bash
npm run dev
```

## Production build

```bash
npm run build
npm start
```

## MCP client setup

### Claude Desktop

Add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mlg-meta-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/mlg-meta-mcp/dist/index.js"],
      "env": {
        "META_SYSTEM_USER_TOKEN": "your_token_here",
        "META_API_VERSION": "v22.0",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Generic stdio usage

Any MCP client that supports stdio transport can run this server by starting the compiled `dist/index.js` entrypoint.

## Available tools

### Account Discovery Tools

- `discoverAdAccounts`

### Campaign Tools

- `getCampaigns`
- `createCampaign`
- `updateCampaign`
- `pauseCampaign`
- `activateCampaign`

### AdSet Tools

- `getAdSets`
- `createAdSet`
- `updateAdSet`
- `pauseAdSet`
- `activateAdSet`

### Ad Tools

- `getAds`

### Insights Tools

- `getInsights`
- `compareTwoPeriods`

### Productivity Tools

- `cloneCampaign`
- `cloneAdSet`
- `bulkPauseCampaigns`
- `bulkActivateCampaigns`
- `checkAlerts`

## Example prompts

These are the kinds of prompts this MCP is designed to support well:

- "List all ad accounts accessible with this token."
- "Show active campaigns for the account named Plannit."
- "Compare this campaign between last_7d and last_30d."
- "If the campaign did not exist in the previous period, explain which fallback reference was used."
- "Clone this campaign and reduce its budget by 20%."
- "Pause these campaigns as a dry run first."
- "Check alerts for yesterday using a CPR threshold of 5000."

## Architecture

The codebase is intentionally split into layers:

- `src/tools/index.ts` → MCP tool definitions and Zod-first schemas
- `src/tools/handlers.ts` → MCP-facing handlers and MCP response envelopes (text summaries plus structured content when useful)
- `src/services/*` → business logic
- `src/api/*` → Meta API clients
- `src/types/*` → shared types

This separation helps keep the MCP surface, business logic, and Meta API integration independent.

For example, `getInsights` keeps a readable text summary, but non-account levels also preserve itemized structured metrics so clients can do their own ranking, filtering, and interpretation.

`compareTwoPeriods` follows the same idea: text output only includes the requested (or defaulted) metrics, while `structuredContent.metrics` exposes both the requested metric list and the returned per-metric values/change objects.

## Quality and project status

Current technical foundations:

- TypeScript strict mode
- Zod-first tool schemas
- Structured logging with Pino
- Categorized error handling
- Vitest test setup
- MCP SDK integration over stdio

Project status:

- actively evolving
- suitable for local/self-hosted usage
- focused on practical Meta Ads workflows for MCP clients and agents

## Roadmap

Near-term priorities:

- stronger test coverage for critical workflows
- richer insights outputs and summaries
- continued polish for open-source release quality

Planned features:

- **Ad creation** — creating ads requires a valid Meta page ID and a page-linked creative payload. The current implementation does not yet support this reliably; it is tracked as a future feature.

Possible future directions:

- more advanced reporting and breakdowns
- remote MCP support
- broader automation and monitoring flows

## Testing

```bash
npm test
npm run test:coverage
npm run type-check
npm run lint
```

## Documentation

- [Architecture](./docs/architecture.md)
- [API Reference](./docs/api.md)
- [Contributing](./CONTRIBUTING.md)
- [Changelog](./CHANGELOG.md)

## Contributing

Contributions, issues, and feedback are welcome.

If you want to contribute, start with:

1. reading the architecture docs
2. checking existing issues
3. opening a focused PR or improvement proposal

## License

MIT © [iammalego](https://github.com/iammalego)

## Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Meta Marketing API](https://developers.facebook.com/docs/marketing-api/)
- The open-source MCP ecosystem
