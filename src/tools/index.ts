/**
 * Tool Definitions
 *
 * Zod is the source of truth for tool arguments.
 * We derive JSON Schema from the same definitions so MCP clients and runtime
 * validation stay aligned.
 */

import { z } from 'zod';
import type { ToolDefinition } from '../types/index.js';
import {
  compareTwoPeriodsSupportedMetrics,
  defaultCompareTwoPeriodsMetrics,
} from '../utils/compare-two-periods.js';
import { ErrorCategory, MetaMcpError } from '../utils/errors.js';

const campaignStatusSchema = z.enum(['ACTIVE', 'PAUSED']);
const campaignStatusFilterSchema = z.enum(['ACTIVE', 'PAUSED', 'ALL']);
const insightsLevelSchema = z.enum(['account', 'campaign', 'adset', 'ad']);
const datePresetSchema = z.enum([
  'today',
  'yesterday',
  'last_7d',
  'last_30d',
  'this_month',
  'last_month',
]);
const adSetBidStrategySchema = z.enum([
  'LOWEST_COST_WITHOUT_CAP',
  'COST_CAP',
  'LOWEST_COST_WITH_BID_CAP',
]);
const adSetBillingEventSchema = z.enum(['IMPRESSIONS', 'CLICKS', 'LINK_CLICKS', 'APP_INSTALLS']);

const timeRangeSchema = z.object({
  since: z.string().describe('Start date (YYYY-MM-DD)'),
  until: z.string().describe('End date (YYYY-MM-DD)'),
});

const flexiblePeriodSchema = z
  .object({
    datePreset: datePresetSchema
      .optional()
      .describe('Predefined date range. Use instead of timeRange.'),
    timeRange: timeRangeSchema.optional().describe('Custom date range (alternative to datePreset)'),
  })
  .superRefine((value, ctx) => {
    const hasDatePreset = Boolean(value.datePreset);
    const hasTimeRange = Boolean(value.timeRange);

    if (hasDatePreset === hasTimeRange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide exactly one of datePreset or timeRange.',
      });
    }
  });

const comparePeriodSchema = z.preprocess(
  (value) => (typeof value === 'string' ? { datePreset: value } : value),
  flexiblePeriodSchema
);

const compareTwoPeriodsResultModeSchema = z.enum([
  'primary_from_insights',
  'specific_action',
  'all_actions',
]);
const compareTwoPeriodsMetricSchema = z.enum(compareTwoPeriodsSupportedMetrics);
const compareTwoPeriodsMetricsSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string') {
      return [value];
    }

    return value;
  },
  z
    .array(compareTwoPeriodsMetricSchema)
    .nonempty('metrics must include at least one metric when provided.')
    .transform((metrics) => [...new Set(metrics)])
    .optional()
    .default([...defaultCompareTwoPeriodsMetrics])
    .describe(
      'Metrics to compare. Supports spend, results, cpr, impressions, clicks, ctr. Omit to use the backward-compatible default: spend, results, cpr. Single strings are accepted and normalized into an array.'
    )
);

const compareTwoPeriodsSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }

    const input = value as Record<string, unknown>;

    if (typeof input.resultActionType === 'string' && input.resultMode === undefined) {
      return {
        ...input,
        resultMode: 'specific_action',
      };
    }

    return value;
  },
  z
    .object({
      objectId: z
        .string()
        .describe(
          'ID of account (act_XXX), campaign, adset, or ad. Account name is also supported.'
        ),
      level: insightsLevelSchema.describe('Aggregation level for the comparison'),
      currentPeriod: comparePeriodSchema.describe(
        'Current period selector. Pass either { datePreset } or { timeRange: { since, until } }. Legacy preset strings are still accepted and normalized.'
      ),
      previousPeriod: comparePeriodSchema.describe(
        'Previous period selector. Pass either { datePreset } or { timeRange: { since, until } }. Legacy preset strings are still accepted and normalized.'
      ),
      resultMode: compareTwoPeriodsResultModeSchema
        .optional()
        .default('primary_from_insights')
        .describe('How to define results for the comparison. Default: primary_from_insights.'),
      resultActionType: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe(
          'Specific Meta action_type to compare (for example: lead or purchase). If provided without resultMode, specific_action is inferred.'
        ),
      metrics: compareTwoPeriodsMetricsSchema,
    })
    .superRefine((value, ctx) => {
      if (value.resultMode === 'specific_action' && !value.resultActionType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['resultActionType'],
          message: 'resultActionType is required when resultMode is specific_action.',
        });
      }

      if (value.resultMode !== 'specific_action' && value.resultActionType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['resultActionType'],
          message: 'resultActionType is only allowed when resultMode is specific_action.',
        });
      }
    })
);

const targetingSchema = z
  .record(z.unknown())
  .describe('Targeting configuration (geo_locations, age_min, age_max, etc)');

const toolRegistry = {
  // Account Discovery Tools
  discoverAdAccounts: {
    description:
      'Discover all ad accounts accessible via the System User Token. Returns account IDs, names, and business information. Results are cached for 5 minutes to improve performance.',
    schema: z.object({}),
  },
  // Campaign Tools
  getCampaigns: {
    description:
      'Get campaigns from an ad account. Supports filtering by status (ACTIVE, PAUSED, ALL). Account can be specified by ID (act_XXX) or by name.',
    schema: z.object({
      accountId: z.string().describe('Ad account ID (act_XXX) or account name (e.g., "Plannit")'),
      status: campaignStatusFilterSchema
        .optional()
        .default('ALL')
        .describe('Filter campaigns by status. Default: ALL'),
    }),
  },
  createCampaign: {
    description:
      'Create a new ad campaign in an account. Requires name, objective, and status. Optional: daily_budget or lifetime_budget (in cents).',
    schema: z.object({
      accountId: z.string().describe('Ad account ID (act_XXX) or account name'),
      name: z.string().describe('Campaign name'),
      objective: z
        .enum([
          'OUTCOME_SALES',
          'OUTCOME_LEADS',
          'OUTCOME_ENGAGEMENT',
          'OUTCOME_AWARENESS',
          'OUTCOME_TRAFFIC',
          'OUTCOME_APP_PROMOTION',
        ])
        .describe('Campaign objective'),
      status: campaignStatusSchema.optional().default('PAUSED').describe('Initial campaign status. Defaults to PAUSED.'),
      dailyBudget: z.number().optional().describe('Daily budget in cents (e.g., 5000 = $50.00)'),
      lifetimeBudget: z.number().optional().describe('Lifetime budget in cents'),
    }),
  },
  updateCampaign: {
    description: 'Update an existing campaign. Only provided fields will be updated.',
    schema: z.object({
      campaignId: z.string().describe('Campaign ID to update'),
      name: z.string().optional().describe('New campaign name'),
      dailyBudget: z.number().optional().describe('New daily budget in cents'),
      lifetimeBudget: z.number().optional().describe('New lifetime budget in cents'),
      status: campaignStatusSchema.optional().describe('New status'),
    }),
  },
  pauseCampaign: {
    description: 'Pause an active campaign',
    schema: z.object({
      campaignId: z.string().describe('Campaign ID to pause'),
    }),
  },
  activateCampaign: {
    description: 'Activate a paused campaign',
    schema: z.object({
      campaignId: z.string().describe('Campaign ID to activate'),
    }),
  },
  // AdSet Tools
  getAdSets: {
    description: 'Get ad sets from a campaign or account. Supports filtering by status.',
    schema: z
      .object({
        campaignId: z
          .string()
          .optional()
          .describe('Campaign ID to get ad sets from (optional if accountId provided)'),
        accountId: z
          .string()
          .optional()
          .describe('Ad account ID (optional if campaignId provided)'),
        status: campaignStatusFilterSchema
          .optional()
          .default('ALL')
          .describe('Filter by status. Default: ALL'),
      })
      .refine((data) => Boolean(data.campaignId || data.accountId), {
        message: 'Either campaignId or accountId is required.',
      }),
  },
  createAdSet: {
    description:
      'Create a new ad set within a campaign. Requires targeting, budget, and billing configuration.',
    schema: z.object({
      campaignId: z.string().describe('Parent campaign ID'),
      name: z.string().describe('Ad set name'),
      dailyBudget: z.number().optional().describe('Daily budget in cents'),
      lifetimeBudget: z.number().optional().describe('Lifetime budget in cents'),
      targeting: targetingSchema.optional(),
      bidStrategy: adSetBidStrategySchema.optional().describe('Bid strategy'),
      billingEvent: adSetBillingEventSchema.optional().describe('Billing event'),
      optimizationGoal: z
        .string()
        .optional()
        .describe('Optimization goal (e.g., REACH, LINK_CLICKS, CONVERSIONS)'),
      status: campaignStatusSchema.optional().default('PAUSED').describe('Initial status'),
    }),
  },
  updateAdSet: {
    description: 'Update an existing ad set. Only provided fields will be updated.',
    schema: z.object({
      adSetId: z.string().describe('Ad set ID to update'),
      name: z.string().optional().describe('New name'),
      dailyBudget: z.number().optional().describe('New daily budget in cents'),
      lifetimeBudget: z.number().optional().describe('New lifetime budget in cents'),
      status: campaignStatusSchema.optional().describe('New status'),
      targeting: z.record(z.unknown()).optional().describe('Updated targeting configuration'),
    }),
  },
  pauseAdSet: {
    description: 'Pause an active ad set',
    schema: z.object({
      adSetId: z.string().describe('Ad set ID to pause'),
    }),
  },
  activateAdSet: {
    description: 'Activate a paused ad set',
    schema: z.object({
      adSetId: z.string().describe('Ad set ID to activate'),
    }),
  },
  // Ad Tools
  getAds: {
    description: 'Get ads from an ad set or campaign. Supports filtering by status.',
    schema: z
      .object({
        adSetId: z
          .string()
          .optional()
          .describe('Ad set ID to get ads from (optional if campaignId provided)'),
        campaignId: z.string().optional().describe('Campaign ID (optional if adSetId provided)'),
        status: campaignStatusFilterSchema
          .optional()
          .default('ALL')
          .describe('Filter by status. Default: ALL'),
      })
      .refine((data) => Boolean(data.adSetId || data.campaignId), {
        message: 'Either adSetId or campaignId is required.',
      }),
  },
  // Insights Tools
  getInsights: {
    description:
      'Get performance metrics for accounts, campaigns, adsets, or ads. Supports date presets (yesterday, last_7d, etc) or custom date ranges. Account level returns an aggregated summary; campaign/adset/ad levels also return structured per-item metrics with normalized ids/names plus spend, results, and CPR so consumers can filter and interpret the full signal.',
    schema: z.object({
      objectId: z.string().describe('ID of account (act_XXX), campaign, adset, or ad'),
      level: insightsLevelSchema.describe('Aggregation level for metrics'),
      datePreset: datePresetSchema
        .optional()
        .describe('Predefined date range. Ignored if timeRange is specified.'),
      timeRange: timeRangeSchema
        .optional()
        .describe('Custom date range (alternative to datePreset)'),
    }),
  },
  compareTwoPeriods: {
    description:
      'Compare performance metrics between two explicit periods for an account, campaign, adset, or ad. Each side accepts either a preset or a custom timeRange. Result selection can follow the primary action inferred from insights, a specific Meta action_type, or all actions. Optional metrics let callers compare spend, results, cpr, impressions, clicks, and/or ctr; omitting metrics keeps the backward-compatible spend/results/cpr default. For campaigns, the response also explains whether the baseline came from the same campaign, a similar campaign, or the account campaign average.',
    schema: compareTwoPeriodsSchema,
  },
  // Productivity Tools (v0.3.0)
  cloneCampaign: {
    description:
      'Clone an existing campaign with a new name. Optionally clone all ad sets within the campaign. Useful for duplicating successful campaign structures.',
    schema: z.object({
      sourceCampaignId: z.string().describe('Campaign ID to clone'),
      newName: z.string().describe('Name for the new campaign'),
      copyAdSets: z
        .boolean()
        .optional()
        .default(true)
        .describe('Clone all ad sets from the source campaign. Default: true'),
      budgetAdjustment: z
        .number()
        .optional()
        .default(0)
        .describe(
          'Percentage to adjust budget (e.g., 10 = increase 10%, -10 = decrease 10%). Default: 0'
        ),
    }),
  },
  cloneAdSet: {
    description:
      'Clone an existing ad set to the same or different campaign. Copies targeting, budget, and all configuration.',
    schema: z.object({
      sourceAdSetId: z.string().describe('Ad set ID to clone'),
      targetCampaignId: z
        .string()
        .describe('Campaign ID to create the clone in (can be same as source)'),
      newName: z
        .string()
        .optional()
        .describe('Name for the new ad set. Default: "{original_name} (Copy)"'),
    }),
  },
  bulkPauseCampaigns: {
    description:
      'Pause multiple campaigns in a single operation. Supports dry-run mode to preview changes.',
    schema: z.object({
      campaignIds: z.array(z.string()).describe('Array of campaign IDs to pause'),
      dryRun: z
        .boolean()
        .optional()
        .default(false)
        .describe('Preview changes without executing. Default: false'),
    }),
  },
  bulkActivateCampaigns: {
    description:
      'Activate multiple campaigns in a single operation. Supports dry-run mode to preview changes.',
    schema: z.object({
      campaignIds: z.array(z.string()).describe('Array of campaign IDs to activate'),
      dryRun: z
        .boolean()
        .optional()
        .default(false)
        .describe('Preview changes without executing. Default: false'),
    }),
  },
  checkAlerts: {
    description:
      'Check campaigns for performance alerts based on configurable thresholds. Identifies high CPR, low CTR, and other performance issues.',
    schema: z.object({
      accountId: z.string().describe('Ad account ID or name to check'),
      cprThreshold: z
        .number()
        .optional()
        .default(5000)
        .describe(
          'Alert if CPR (cost per result) exceeds this value in cents. Default: 5000 ($50.00)'
        ),
      minCtr: z
        .number()
        .optional()
        .default(1.0)
        .describe('Alert if CTR is below this percentage. Default: 1.0'),
      minDailySpend: z
        .number()
        .optional()
        .default(1000)
        .describe('Alert if daily spend is below this value in cents. Default: 1000 ($10.00)'),
      datePreset: z
        .enum(['today', 'yesterday', 'last_7d'])
        .optional()
        .default('yesterday')
        .describe('Time period to analyze. Default: yesterday'),
    }),
  },
} satisfies Record<string, { description: string; schema: z.ZodTypeAny }>;

type ToolName = keyof typeof toolRegistry;

function unwrapSchema(schema: z.ZodTypeAny): {
  schema: z.ZodTypeAny;
  isOptional: boolean;
  defaultValue?: unknown;
  description?: string;
} {
  let current = schema;
  let isOptional = false;
  let defaultValue: unknown;
  const description = schema.description;

  while (true) {
    if (current instanceof z.ZodOptional) {
      isOptional = true;
      current = current.unwrap();
      continue;
    }

    if (current instanceof z.ZodDefault) {
      isOptional = true;
      defaultValue = current._def.defaultValue();
      current = current._def.innerType;
      continue;
    }

    if (current instanceof z.ZodEffects) {
      current = current.innerType();
      continue;
    }

    break;
  }

  return { schema: current, isOptional, defaultValue, description };
}

function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const { schema: unwrapped, defaultValue, description } = unwrapSchema(schema);
  let jsonSchema: Record<string, unknown>;

  if (unwrapped instanceof z.ZodObject) {
    const shape = unwrapped.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);

      if (!unwrapSchema(value).isOptional) {
        required.push(key);
      }
    }

    jsonSchema = {
      type: 'object',
      properties,
    };

    if (required.length > 0) {
      jsonSchema.required = required;
    }
  } else if (unwrapped instanceof z.ZodString) {
    jsonSchema = { type: 'string' };
  } else if (unwrapped instanceof z.ZodNumber) {
    jsonSchema = { type: 'number' };
  } else if (unwrapped instanceof z.ZodBoolean) {
    jsonSchema = { type: 'boolean' };
  } else if (unwrapped instanceof z.ZodArray) {
    jsonSchema = {
      type: 'array',
      items: zodToJsonSchema(unwrapped.element),
    };
  } else if (unwrapped instanceof z.ZodEnum) {
    jsonSchema = {
      type: 'string',
      enum: unwrapped.options,
    };
  } else if (unwrapped instanceof z.ZodRecord) {
    jsonSchema = {
      type: 'object',
      additionalProperties: true,
    };
  } else if (unwrapped instanceof z.ZodUnknown || unwrapped instanceof z.ZodAny) {
    jsonSchema = {};
  } else {
    jsonSchema = {};
  }

  if (description) {
    jsonSchema.description = description;
  }

  if (defaultValue !== undefined) {
    jsonSchema.default = defaultValue;
  }

  return jsonSchema;
}

function formatZodError(error: z.ZodError): string {
  return error.errors
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

export function getAllTools(): ToolDefinition[] {
  return Object.entries(toolRegistry).map(([name, definition]) => ({
    name,
    description: definition.description,
    inputSchema: zodToJsonSchema(definition.schema),
  }));
}

export function parseToolArgs(
  name: string,
  args: Record<string, unknown> | undefined
): Record<string, unknown> {
  const definition = toolRegistry[name as ToolName];

  if (!definition) {
    throw new MetaMcpError(ErrorCategory.VALIDATION, `Unknown tool: ${name}`);
  }

  const result = definition.schema.safeParse(args ?? {});

  if (!result.success) {
    throw new MetaMcpError(
      ErrorCategory.VALIDATION,
      `Invalid arguments for ${name}: ${formatZodError(result.error)}`
    );
  }

  return result.data as Record<string, unknown>;
}
