# Contributing to mlg-meta-mcp

Thanks for contributing. This project is an open-source MCP server for Meta Ads, with a focus on practical operator workflows, clear tool contracts, and LLM-friendly outputs.

## Before you start

Please check existing issues before starting a larger change. For behavior changes, new tools, or workflow improvements, open or discuss an issue first so the API surface stays intentional.

### Issue templates

Use the GitHub templates in `.github/ISSUE_TEMPLATE/`:

- `bug_report.yml` for reproducible defects
- `feature_request.yml` for new capabilities or API improvements
- `workflow_request.yml` for higher-level agent/operator workflows

### Pull request template

All pull requests should follow `.github/pull_request_template.md`, including summary, motivation, validation steps, and related issues.

## Local setup

### Prerequisites

- Node.js 20+
- npm
- A Meta System User token only if you want to exercise the server against the real API

### Clone and install

```bash
git clone https://github.com/<your-user>/mlg-meta-mcp.git
cd mlg-meta-mcp
npm install
cp .env.example .env
```

Fill in `.env` if you need live Meta API access. Documentation, linting, type-checking, and most tests do not require a real token.

## Validation commands

These are the main local checks and the basis of CI validation:

```bash
npm run type-check
npm run lint
npm run format:check
npm test
```

Useful extras:

```bash
npm run test:coverage
npm run dev
```

### CI reference

GitHub Actions currently runs:

- `npm ci`
- `npm run type-check`
- `npm run lint`
- `npm run format:check`
- `npm test`

The quality job runs on Node 20, and tests run on Node 20 and 22.

## Architecture pointers

Start here before changing behavior:

- `README.md` for the public project overview and supported workflows
- `docs/architecture.md` for runtime flow and layer boundaries
- `docs/api.md` for the public tool surface and argument conventions

Key implementation areas:

- `src/index.ts` - MCP server bootstrap, stdio transport, request handlers
- `src/tools/index.ts` - Zod-first tool registry and JSON Schema export
- `src/tools/handlers.ts` - MCP-facing handlers and response formatting
- `src/services/` - business logic and workflow orchestration
- `src/api/` - Meta API clients and HTTP/retry behavior

If you touch `compareTwoPeriods`, review `src/services/insights-service.ts` and keep the fallback behavior aligned with the README and `docs/api.md`.

## Contribution guidelines

### Keep changes focused

- Prefer small, reviewable pull requests.
- Avoid mixing refactors with behavior changes unless they are tightly coupled.
- Update public docs when tool behavior, arguments, or outputs change.

### Tool contract changes

If you modify a tool schema or handler output:

1. Update `src/tools/index.ts`
2. Update or add tests
3. Update `README.md` and `docs/api.md` when public behavior changes
4. Note the user-facing impact in the PR description

For core MCP tools, preserve maximal useful signal in the base contract:

- consumers/LLMs/apps own filtering and interpretation
- ergonomic formatting is encouraged
- destructive filtering for one project-specific workflow is not
- if a business-specific opinion is needed, add it as higher-level workflow logic instead of shrinking the core contract

### Coding conventions

- TypeScript in strict mode
- Zod schemas are the source of truth for tool arguments
- Keep handlers thin and push business rules into services
- Keep Meta HTTP concerns inside the API client layer
- Use Conventional Commits for commit messages

Examples:

```bash
git commit -m "docs(api): document compareTwoPeriods fallbacks"
git commit -m "fix(insights): preserve similar campaign fallback order"
git commit -m "test(tools): cover invalid enum arguments"
```

## Submitting a pull request

1. Fork the repository and create a topic branch.
2. Make the smallest change that solves the problem.
3. Run the relevant validation commands locally.
4. Complete the PR template, including exact test commands.
5. Link the related issue with `Closes #<number>` when applicable.

## Good first contributions

Good first contributions include:

- documentation fixes
- missing validation or schema clarifications
- focused test coverage improvements
- README/API reference consistency updates
- small bug fixes in handlers or service logic

## Questions

If something is unclear, open an issue or a draft PR with the context and proposed direction. Clear problem statements are more useful than large surprise changes.
