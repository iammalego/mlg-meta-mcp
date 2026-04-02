/**
 * Tool Handlers
 *
 * Implements the logic for each MCP server tool.
 * Each handler receives arguments and returns a ToolCallResult.
 */

import { AccountService } from '../services/account-service.js';
import { CampaignService } from '../services/campaign-service.js';
import { AdSetService } from '../services/adset-service.js';
import { AdService } from '../services/ad-service.js';
import { InsightsService } from '../services/insights-service.js';
import { GraphClient } from '../api/graph-client.js';
import { TargetingClient, CreativeClient } from '../api/client.js';
import { getLogger } from '../utils/logger.js';
import { MetaMcpError, ErrorCategory } from '../utils/errors.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type {
  CompareTwoPeriodsOptions,
  FlexiblePeriodInput,
  ItemizedInsight,
  MetricChange,
  PeriodComparison,
} from '../services/insights-service.js';
import { COMPARE_TWO_PERIODS_SIGNIFICANT_CHANGE_THRESHOLD } from '../services/insights-service.js';
import {
  compareTwoPeriodsIncludesResultMetrics,
  compareTwoPeriodsMetricMetadata,
  type CompareTwoPeriodsMetric,
  type CompareTwoPeriodsMetricUnit,
} from '../utils/compare-two-periods.js';
import { parseToolArgs } from './index.js';

const logger = getLogger();

interface ItemizedInsightsStructuredContent extends Record<string, unknown> {
  objectId: string;
  level: 'campaign' | 'adset' | 'ad';
  requestedPeriod: string | null;
  requestedTimeRange: { since: string; until: string } | null;
  summary: {
    itemCount: number;
    dateRange: string;
    totals: {
      spend: number;
      results: number;
      cpr: number;
      impressions: number;
      clicks: number;
      ctr: number;
    };
  };
  items: ItemizedInsight[];
}

interface CompareTwoPeriodsStructuredContent extends Record<string, unknown> {
  objectId: string;
  level: 'account' | 'campaign' | 'adset' | 'ad';
  currentPeriod: {
    requested: FlexiblePeriodInput;
    dateRange: string | null;
  };
  previousPeriod: {
    requested: FlexiblePeriodInput;
    dateRange: string | null;
  };
  resultDefinition: PeriodComparison['resultDefinition'];
  comparisonContext: {
    resultResolutionFallback: boolean;
    resultResolutionSource: PeriodComparison['resultDefinition']['resolutionSource'] | null;
    significanceThresholdPercentage: number;
  };
  reference: PeriodComparison['reference'];
  metrics: {
    requested: PeriodComparison['requestedMetrics'];
    returned: Partial<
      Record<
        CompareTwoPeriodsMetric,
        {
          label: string;
          unit: CompareTwoPeriodsMetricUnit;
          current: number;
          previous: number;
          change: MetricChange;
        }
      >
    >;
  };
}

// Service singletons (initialized once)
let accountService: AccountService | null = null;
let campaignService: CampaignService | null = null;
let adSetService: AdSetService | null = null;
let adService: AdService | null = null;
let insightsService: InsightsService | null = null;
let graphClient: GraphClient | null = null;
let targetingClient: TargetingClient | null = null;
let creativeClient: CreativeClient | null = null;

export function initializeHandlers(accessToken: string): void {
  accountService = new AccountService(accessToken);
  campaignService = new CampaignService(accessToken, accountService);
  adSetService = new AdSetService(accessToken, accountService);
  adService = new AdService(accessToken);
  insightsService = new InsightsService(accessToken, accountService);
  graphClient = new GraphClient(accessToken);
  targetingClient = new TargetingClient(accessToken);
  creativeClient = new CreativeClient(accessToken);
  logger.info('All services initialized');
}

/**
 * Main router for tool calls
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  logger.info({ tool: name }, 'Executing tool');

  try {
    if (
      !accountService ||
      !campaignService ||
      !adSetService ||
      !adService ||
      !insightsService ||
      !graphClient ||
      !targetingClient ||
      !creativeClient
    ) {
      throw new MetaMcpError(
        ErrorCategory.VALIDATION,
        'Handlers not initialized. Call initializeHandlers() with a valid token first.'
      );
    }

    const parsedArgs = parseToolArgs(name, args);

    switch (name) {
      // Discovery
      case 'discoverAdAccounts':
        return await handleDiscoverAdAccounts();

      // Campaigns
      case 'getCampaigns':
        return await handleGetCampaigns(parsedArgs);
      case 'updateCampaign':
        return await handleUpdateCampaign(parsedArgs);
      case 'pauseCampaign':
        return await handlePauseCampaign(parsedArgs);
      case 'activateCampaign':
        return await handleActivateCampaign(parsedArgs);

      // AdSets
      case 'getAdSets':
        return await handleGetAdSets(parsedArgs);
      case 'updateAdSet':
        return await handleUpdateAdSet(parsedArgs);
      case 'pauseAdSet':
        return await handlePauseAdSet(parsedArgs);
      case 'activateAdSet':
        return await handleActivateAdSet(parsedArgs);

      // Ads
      case 'getAds':
        return await handleGetAds(parsedArgs);

      // Productivity Tools (v0.3.0)
      case 'cloneCampaign':
        return await handleCloneCampaign(parsedArgs);
      case 'cloneAdSet':
        return await handleCloneAdSet(parsedArgs);
      case 'bulkPauseCampaigns':
        return await handleBulkPauseCampaigns(parsedArgs);
      case 'bulkActivateCampaigns':
        return await handleBulkActivateCampaigns(parsedArgs);
      case 'checkAlerts':
        return await handleCheckAlerts(parsedArgs);

      // Insights
      case 'getInsights':
        return await handleGetInsights(parsedArgs);
      case 'compareTwoPeriods':
        return await handleCompareTwoPeriods(parsedArgs);

      // Detail Getters
      case 'getAccountInfo':
        return await handleGetAccountInfo(parsedArgs);
      case 'getCampaignDetails':
        return await handleGetCampaignDetails(parsedArgs);
      case 'getAdSetDetails':
        return await handleGetAdSetDetails(parsedArgs);
      case 'getAdDetails':
        return await handleGetAdDetails(parsedArgs);
      case 'updateAd':
        return await handleUpdateAd(parsedArgs);

      // Budget
      case 'createBudgetSchedule':
        return await handleCreateBudgetSchedule(parsedArgs);

      // Targeting Research
      case 'searchInterests':
        return await handleSearchInterests(parsedArgs);
      case 'getInterestSuggestions':
        return await handleGetInterestSuggestions(parsedArgs);
      case 'validateInterests':
        return await handleValidateInterests(parsedArgs);
      case 'searchBehaviors':
        return await handleSearchBehaviors(parsedArgs);
      case 'searchDemographics':
        return await handleSearchDemographics(parsedArgs);
      case 'searchGeoLocations':
        return await handleSearchGeoLocations(parsedArgs);

      // Creatives
      case 'getAdCreatives':
        return await handleGetAdCreatives(parsedArgs);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    logger.error({ tool: name, error }, 'Tool execution failed');

    const errorMessage =
      error instanceof MetaMcpError ? error.message : `Error: ${(error as Error).message}`;

    return {
      content: [
        {
          type: 'text',
          text: errorMessage,
        },
      ],
      isError: true,
    };
  }
}

// ==================== DISCOVERY HANDLERS ====================

async function handleDiscoverAdAccounts(): Promise<CallToolResult> {
  const accounts = await accountService!.discoverAdAccounts();

  if (accounts.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: 'No accessible ad accounts found. Verify that the System User Token has permissions for the accounts.',
        },
      ],
    };
  }

  const lines = accounts.map(
    (acc, i) => `${i + 1}. ${acc.name}\n   ID: ${acc.id} | Business: ${acc.businessName}`
  );

  return {
    content: [
      {
        type: 'text',
        text: `Available Ad Accounts (${accounts.length}):\n\n${lines.join('\n\n')}`,
      },
    ],
  };
}

// ==================== CAMPAIGN HANDLERS ====================

async function handleGetCampaigns(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const accountIdOrName = args?.accountId as string;
  const status = (args?.status as 'ACTIVE' | 'PAUSED' | 'ALL') || 'ALL';

  if (!accountIdOrName) {
    throw new MetaMcpError(ErrorCategory.VALIDATION, 'Required parameter: accountId');
  }

  const campaigns = await campaignService!.getCampaigns(accountIdOrName, status);

  if (campaigns.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `No campaigns found ${status !== 'ALL' ? `with status "${status}" ` : ''}in the account.`,
        },
      ],
    };
  }

  const lines = campaigns.map((camp, i) => {
    const budget = camp.dailyBudget
      ? `$${(camp.dailyBudget / 100).toFixed(2)}/day`
      : camp.lifetimeBudget
        ? `$${(camp.lifetimeBudget / 100).toFixed(2)} total`
        : 'No budget';

    return `${i + 1}. ${camp.name}\n   ID: ${camp.id} | Status: ${camp.status} | Objective: ${camp.objective}\n   Budget: ${budget}`;
  });

  const statusFilter = status !== 'ALL' ? ` (${status})` : '';

  return {
    content: [
      {
        type: 'text',
        text: `Campaigns${statusFilter} found (${campaigns.length}):\n\n${lines.join('\n\n')}`,
      },
    ],
  };
}

async function handleUpdateCampaign(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const campaignId = args?.campaignId as string;

  if (!campaignId) {
    throw new MetaMcpError(ErrorCategory.VALIDATION, 'Required parameter: campaignId');
  }

  const updates: {
    name?: string;
    status?: 'ACTIVE' | 'PAUSED';
    dailyBudget?: number;
    lifetimeBudget?: number;
  } = {};

  if (args?.name) updates.name = args.name as string;
  if (args?.status) updates.status = args.status as 'ACTIVE' | 'PAUSED';
  if (args?.dailyBudget) updates.dailyBudget = args.dailyBudget as number;
  if (args?.lifetimeBudget) updates.lifetimeBudget = args.lifetimeBudget as number;

  if (Object.keys(updates).length === 0) {
    throw new MetaMcpError(
      ErrorCategory.VALIDATION,
      'At least one field to update must be provided (name, status, dailyBudget, lifetimeBudget)'
    );
  }

  const result = await campaignService!.updateCampaign(campaignId, updates);

  return {
    content: [
      {
        type: 'text',
        text: `Campaign updated:\n\nName: ${result.name}\nID: ${result.id}\nPrevious status: ${result.previousStatus}`,
      },
    ],
  };
}

async function handlePauseCampaign(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const campaignId = args?.campaignId as string;

  if (!campaignId) {
    throw new MetaMcpError(ErrorCategory.VALIDATION, 'Required parameter: campaignId');
  }

  const result = await campaignService!.pauseCampaign(campaignId);

  return {
    content: [
      {
        type: 'text',
        text: `Campaign paused:\n\nName: ${result.name}\nID: ${result.id}\nPrevious status: ${result.previousStatus}\nCurrent status: PAUSED`,
      },
    ],
  };
}

async function handleActivateCampaign(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const campaignId = args?.campaignId as string;

  if (!campaignId) {
    throw new MetaMcpError(ErrorCategory.VALIDATION, 'Required parameter: campaignId');
  }

  const result = await campaignService!.activateCampaign(campaignId);

  return {
    content: [
      {
        type: 'text',
        text: `Campaign activated:\n\nName: ${result.name}\nID: ${result.id}\nPrevious status: ${result.previousStatus}\nCurrent status: ACTIVE`,
      },
    ],
  };
}

// ==================== ADSET HANDLERS ====================

async function handleGetAdSets(args: Record<string, unknown> | undefined): Promise<CallToolResult> {
  const campaignId = args?.campaignId as string | undefined;
  const accountId = args?.accountId as string | undefined;
  const status = (args?.status as 'ACTIVE' | 'PAUSED' | 'ALL') || 'ALL';

  if (!campaignId && !accountId) {
    throw new MetaMcpError(ErrorCategory.VALIDATION, 'Required parameter: campaignId or accountId');
  }

  const parentId = campaignId || accountId!;
  const adsets = await adSetService!.getAdSets(parentId, status);

  if (adsets.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `No ad sets found ${status !== 'ALL' ? `with status "${status}" ` : ''}`,
        },
      ],
    };
  }

  const lines = adsets.map((adset, i) => {
    const budget = adset.dailyBudget
      ? `$${(adset.dailyBudget / 100).toFixed(2)}/day`
      : adset.lifetimeBudget
        ? `$${(adset.lifetimeBudget / 100).toFixed(2)} total`
        : 'No budget';

    return `${i + 1}. ${adset.name}\n   ID: ${adset.id} | Campaign: ${adset.campaignId}\n   Status: ${adset.status} | Budget: ${budget}`;
  });

  const statusFilter = status !== 'ALL' ? ` (${status})` : '';

  return {
    content: [
      {
        type: 'text',
        text: `Ad Sets${statusFilter} found (${adsets.length}):\n\n${lines.join('\n\n')}`,
      },
    ],
  };
}

async function handleUpdateAdSet(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const adSetId = args?.adSetId as string;

  if (!adSetId) {
    throw new MetaMcpError(ErrorCategory.VALIDATION, 'Required parameter: adSetId');
  }

  const updates: {
    name?: string;
    status?: 'ACTIVE' | 'PAUSED';
    dailyBudget?: number;
    lifetimeBudget?: number;
    targeting?: Record<string, unknown>;
  } = {};

  if (args?.name) updates.name = args.name as string;
  if (args?.status) updates.status = args.status as 'ACTIVE' | 'PAUSED';
  if (args?.dailyBudget) updates.dailyBudget = args.dailyBudget as number;
  if (args?.lifetimeBudget) updates.lifetimeBudget = args.lifetimeBudget as number;
  if (args?.targeting) updates.targeting = args.targeting as Record<string, unknown>;

  if (Object.keys(updates).length === 0) {
    throw new MetaMcpError(
      ErrorCategory.VALIDATION,
      'At least one field to update must be provided'
    );
  }

  const result = await adSetService!.updateAdSet(adSetId, updates);

  return {
    content: [
      {
        type: 'text',
        text: `Ad Set updated:\n\nName: ${result.name}\nID: ${result.id}\nPrevious status: ${result.previousStatus}`,
      },
    ],
  };
}

async function handlePauseAdSet(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const adSetId = args?.adSetId as string;

  if (!adSetId) {
    throw new MetaMcpError(ErrorCategory.VALIDATION, 'Required parameter: adSetId');
  }

  const result = await adSetService!.pauseAdSet(adSetId);

  return {
    content: [
      {
        type: 'text',
        text: `Ad Set paused:\n\nName: ${result.name}\nID: ${result.id}\nPrevious status: ${result.previousStatus}\nCurrent status: PAUSED`,
      },
    ],
  };
}

async function handleActivateAdSet(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const adSetId = args?.adSetId as string;

  if (!adSetId) {
    throw new MetaMcpError(ErrorCategory.VALIDATION, 'Required parameter: adSetId');
  }

  const result = await adSetService!.activateAdSet(adSetId);

  return {
    content: [
      {
        type: 'text',
        text: `Ad Set activated:\n\nName: ${result.name}\nID: ${result.id}\nPrevious status: ${result.previousStatus}\nCurrent status: ACTIVE`,
      },
    ],
  };
}

// ==================== AD HANDLERS ====================

async function handleGetAds(args: Record<string, unknown> | undefined): Promise<CallToolResult> {
  const adSetId = args?.adSetId as string | undefined;
  const campaignId = args?.campaignId as string | undefined;
  const status = (args?.status as 'ACTIVE' | 'PAUSED' | 'ALL') || 'ALL';

  if (!adSetId && !campaignId) {
    throw new MetaMcpError(ErrorCategory.VALIDATION, 'Required parameter: adSetId or campaignId');
  }

  const parentId = adSetId || campaignId!;
  const ads = await adService!.getAds(parentId, status);

  if (ads.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `No ads found ${status !== 'ALL' ? `with status "${status}" ` : ''}`,
        },
      ],
    };
  }

  const lines = ads.map((ad, i) => {
    const creative = ad.creative;
    return `${i + 1}. ${ad.name}\n   ID: ${ad.id} | AdSet: ${ad.adSetId}\n   Status: ${ad.status}${creative ? `\n   Title: ${creative.title || 'N/A'}` : ''}`;
  });

  const statusFilter = status !== 'ALL' ? ` (${status})` : '';

  return {
    content: [
      {
        type: 'text',
        text: `Ads${statusFilter} found (${ads.length}):\n\n${lines.join('\n\n')}`,
      },
    ],
  };
}

// ==================== INSIGHTS HANDLERS ====================

async function handleGetInsights(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const objectId = args?.objectId as string;
  const level = (args?.level as 'account' | 'campaign' | 'adset' | 'ad') || 'account';
  const datePreset = args?.datePreset as string | undefined;
  const timeRange = args?.timeRange as { since: string; until: string } | undefined;

  if (!objectId) {
    throw new MetaMcpError(ErrorCategory.VALIDATION, 'Required parameter: objectId');
  }

  // For non-account levels, return a per-item breakdown so each campaign, ad set, or ad
  // is individually visible. An aggregated single row loses per-object attribution.
  if (level !== 'account') {
    const items = await insightsService!.getItemizedInsights(
      objectId,
      level,
      datePreset,
      timeRange
    );

    if (items.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No ${level} insights found for ${objectId} in period ${datePreset || 'default'}.`,
          },
        ],
      };
    }

    const structuredContent = buildItemizedInsightsStructuredContent(
      objectId,
      level,
      datePreset,
      timeRange,
      items
    );

    const lines = items.map((item, i) => {
      const spend = formatCurrency(item.spend);
      const cpr = item.cpr > 0 ? formatCurrency(item.cpr) : 'N/A';
      const ctr = `${item.ctr.toFixed(2)}%`;
      const period = item.dateRange ? ` (${item.dateRange})` : '';

      return (
        `${i + 1}. ${item.name}${period}\n` +
        `   ID: ${item.id} | Spend: ${spend} | Results: ${formatMetricNumber(item.results)} | CPR: ${cpr}\n` +
        `   Impressions: ${item.impressions.toLocaleString()} | Clicks: ${item.clicks.toLocaleString()} | CTR: ${ctr}`
      );
    });

    return {
      structuredContent,
      content: [
        {
          type: 'text',
          text:
            `Performance Metrics by ${level}\n\n` +
            `Object: ${objectId}\n` +
            `Period: ${formatRequestedPeriod({ datePreset, timeRange })}\n` +
            `Items: ${structuredContent.summary.itemCount}\n` +
            `Total Spend: ${formatCurrency(structuredContent.summary.totals.spend)}\n` +
            `Total Results: ${formatMetricNumber(structuredContent.summary.totals.results)}\n` +
            `Average CPR: ${structuredContent.summary.totals.cpr > 0 ? formatCurrency(structuredContent.summary.totals.cpr) : 'N/A'}\n\n` +
            lines.join('\n\n'),
        },
      ],
    };
  }

  // Account level: aggregate into a single summary.
  const metrics = await insightsService!.getMetrics(objectId, level, datePreset, timeRange);

  const spendFormatted = `$${(metrics.spend / 100).toFixed(2)}`;
  const cprFormatted = metrics.cpr > 0 ? `$${(metrics.cpr / 100).toFixed(2)}` : 'N/A';

  return {
    content: [
      {
        type: 'text',
        text:
          `Performance Metrics\n\n` +
          `Object: ${objectId}\n` +
          `Level: ${level}\n` +
          `Period: ${metrics.dateRange || datePreset || 'default'}\n\n` +
          `Spend: ${spendFormatted}\n` +
          `Results: ${metrics.results}\n` +
          `CPR: ${cprFormatted}\n` +
          `Impressions: ${metrics.impressions.toLocaleString()}\n` +
          `Clicks: ${metrics.clicks.toLocaleString()}\n` +
          `CTR: ${metrics.ctr.toFixed(2)}%`,
      },
    ],
  };
}

function buildItemizedInsightsStructuredContent(
  objectId: string,
  level: 'campaign' | 'adset' | 'ad',
  datePreset: string | undefined,
  timeRange: { since: string; until: string } | undefined,
  items: ItemizedInsight[]
): ItemizedInsightsStructuredContent {
  const totals = items.reduce(
    (acc, item) => ({
      spend: acc.spend + item.spend,
      results: acc.results + item.results,
      impressions: acc.impressions + item.impressions,
      clicks: acc.clicks + item.clicks,
    }),
    {
      spend: 0,
      results: 0,
      impressions: 0,
      clicks: 0,
    }
  );

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpr = totals.results > 0 ? totals.spend / totals.results : 0;

  return {
    objectId,
    level,
    requestedPeriod: datePreset || null,
    requestedTimeRange: timeRange || null,
    summary: {
      itemCount: items.length,
      dateRange: items[0]?.dateRange || '',
      totals: {
        spend: totals.spend,
        results: totals.results,
        cpr,
        impressions: totals.impressions,
        clicks: totals.clicks,
        ctr: Math.round(ctr * 100) / 100,
      },
    },
    items,
  };
}

function formatCurrency(value: number): string {
  return `$${(value / 100).toFixed(2)}`;
}

function formatMetricNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function formatRequestedPeriod(period: FlexiblePeriodInput): string {
  if (period.timeRange) {
    return `${period.timeRange.since} → ${period.timeRange.until}`;
  }

  return period.datePreset || 'default';
}

function formatMetricValue(metric: CompareTwoPeriodsMetric, value: number): string {
  switch (metric) {
    case 'spend':
    case 'cpr':
      return formatCurrency(value);
    case 'ctr':
      return `${value.toFixed(2)}%`;
    default:
      return formatMetricNumber(value);
  }
}

function formatMetricAbsoluteChange(metric: CompareTwoPeriodsMetric, value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const absolute = Math.abs(value);

  switch (metric) {
    case 'spend':
    case 'cpr':
      return `${sign}${formatCurrency(absolute)}`;
    case 'ctr':
      return `${sign}${absolute.toFixed(2)} pts`;
    default:
      return `${sign}${formatMetricNumber(absolute)}`;
  }
}

function formatMetricPercentageChange(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

function getMetricDirectionArrow(direction: 'up' | 'down' | 'same'): string {
  if (direction === 'up') return '↑';
  if (direction === 'down') return '↓';
  return '→';
}

function buildComparedMetrics(
  comparison: PeriodComparison
): CompareTwoPeriodsStructuredContent['metrics']['returned'] {
  return comparison.requestedMetrics.reduce<
    CompareTwoPeriodsStructuredContent['metrics']['returned']
  >((acc, metric) => {
    const change = comparison.changes[metric];

    if (!change) {
      return acc;
    }

    acc[metric] = {
      ...compareTwoPeriodsMetricMetadata[metric],
      current: comparison.current[metric],
      previous: comparison.previous[metric],
      change,
    };

    return acc;
  }, {});
}

function isCompareTwoPeriodsFallbackApplied(
  resultDefinition: PeriodComparison['resultDefinition']
): boolean {
  return (
    resultDefinition.resolutionSource === 'previous_primary_action' ||
    resultDefinition.resolutionSource === 'all_actions_fallback'
  );
}

async function handleCompareTwoPeriods(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const objectId = args?.objectId as string;
  const level = (args?.level as 'account' | 'campaign' | 'adset' | 'ad') || 'account';
  const currentPeriod = args?.currentPeriod as FlexiblePeriodInput;
  const previousPeriod = args?.previousPeriod as FlexiblePeriodInput;
  const resultMode = args?.resultMode as CompareTwoPeriodsOptions['resultMode'];
  const resultActionType = args?.resultActionType as string | undefined;
  const metrics = args?.metrics as CompareTwoPeriodsMetric[];

  const comparison = await insightsService!.compareTwoPeriods(objectId, level, {
    currentPeriod,
    previousPeriod,
    resultMode,
    resultActionType,
    metrics,
  });

  const resultResolutionFallback = isCompareTwoPeriodsFallbackApplied(comparison.resultDefinition);

  const structuredContent: CompareTwoPeriodsStructuredContent = {
    objectId,
    level,
    currentPeriod: {
      requested: currentPeriod,
      dateRange: comparison.current.dateRange || null,
    },
    previousPeriod: {
      requested: previousPeriod,
      dateRange: comparison.previous.dateRange || null,
    },
    resultDefinition: comparison.resultDefinition,
    comparisonContext: {
      resultResolutionFallback,
      resultResolutionSource: resultResolutionFallback
        ? comparison.resultDefinition.resolutionSource
        : null,
      significanceThresholdPercentage: COMPARE_TWO_PERIODS_SIGNIFICANT_CHANGE_THRESHOLD,
    },
    reference: comparison.reference,
    metrics: {
      requested: comparison.requestedMetrics,
      returned: buildComparedMetrics(comparison),
    },
  };

  const resolvedResultsLabel =
    comparison.resultDefinition.resolvedMode === 'specific_action'
      ? comparison.resultDefinition.resolvedActionType
      : 'all actions';
  const includesResultMetrics = compareTwoPeriodsIncludesResultMetrics(comparison.requestedMetrics);
  const metricLines = comparison.requestedMetrics.flatMap((metric) => {
    const change = comparison.changes[metric];

    if (!change) {
      return [];
    }

    return [
      `${compareTwoPeriodsMetricMetadata[metric].label}: ${formatMetricValue(metric, comparison.current[metric])} vs ${formatMetricValue(metric, comparison.previous[metric])}`,
      `  Change: ${getMetricDirectionArrow(change.direction)} ${formatMetricAbsoluteChange(metric, change.absolute)} (${formatMetricPercentageChange(change.percentage)})`,
      '',
    ];
  });

  if (metricLines.length > 0 && metricLines[metricLines.length - 1] === '') {
    metricLines.pop();
  }

  const textLines = [
    'Comparison Between Two Periods',
    '',
    `Object: ${objectId}`,
    `Level: ${level}`,
    `Current Period: ${formatRequestedPeriod(currentPeriod)} (${comparison.current.dateRange || 'n/a'})`,
    `Previous Period: ${formatRequestedPeriod(previousPeriod)} (${comparison.previous.dateRange || 'n/a'})`,
    `Requested Metrics: ${comparison.requestedMetrics.join(', ')}`,
    `Reference Used: ${comparison.reference.message}`,
  ];

  if (includesResultMetrics) {
    textLines.push(
      `Results Definition: ${resolvedResultsLabel}`,
      `Resolved Mode: ${comparison.resultDefinition.resolvedMode}`,
      `Resolved Action Type: ${comparison.resultDefinition.resolvedActionType || 'n/a'}`,
      `Result Resolution Fallback: ${resultResolutionFallback ? `yes (${comparison.resultDefinition.resolutionSource})` : 'no'}`,
      `Result Resolution: ${comparison.resultDefinition.message}`
    );
  }

  textLines.push(
    `Significance Threshold: ${COMPARE_TWO_PERIODS_SIGNIFICANT_CHANGE_THRESHOLD.toFixed(2)}%`,
    ''
  );

  if (metricLines.length > 0) {
    textLines.push(...metricLines);
  }

  return {
    structuredContent,
    content: [
      {
        type: 'text',
        text: textLines.join('\n'),
      },
    ],
  };
}

// ==================== PRODUCTIVITY HANDLERS (v0.3.0) ====================

async function handleCloneCampaign(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const sourceCampaignId = args?.sourceCampaignId as string;
  const newName = args?.newName as string;
  const copyAdSets = args?.copyAdSets !== false; // Default: true
  const budgetAdjustment = (args?.budgetAdjustment as number) || 0;

  if (!sourceCampaignId || !newName) {
    throw new MetaMcpError(
      ErrorCategory.VALIDATION,
      'Required parameters: sourceCampaignId, newName'
    );
  }

  const result = await campaignService!.cloneCampaign(
    sourceCampaignId,
    newName,
    copyAdSets,
    budgetAdjustment
  );

  return {
    content: [
      {
        type: 'text',
        text:
          `Campaign cloned successfully:\n\n` +
          `New Campaign ID: ${result.newCampaignId}\n` +
          `Ad Sets Cloned: ${result.adSetsCloned}\n\n` +
          `Note: New campaign created as PAUSED. Review and activate when ready.`,
      },
    ],
  };
}

async function handleCloneAdSet(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const sourceAdSetId = args?.sourceAdSetId as string;
  const targetCampaignId = args?.targetCampaignId as string;
  const newName = args?.newName as string | undefined;

  if (!sourceAdSetId || !targetCampaignId) {
    throw new MetaMcpError(
      ErrorCategory.VALIDATION,
      'Required parameters: sourceAdSetId, targetCampaignId'
    );
  }

  const result = await adSetService!.cloneAdSet(sourceAdSetId, targetCampaignId, newName);

  return {
    content: [
      {
        type: 'text',
        text:
          `Ad Set cloned successfully:\n\n` +
          `New Ad Set ID: ${result.adSetId}\n` +
          `Name: ${result.adSetName}\n` +
          `Campaign: ${targetCampaignId}\n\n` +
          `Note: New ad set created as PAUSED.`,
      },
    ],
  };
}

async function handleBulkPauseCampaigns(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const campaignIds = args?.campaignIds as string[];
  const dryRun = args?.dryRun === true; // Default: false

  if (!campaignIds || !Array.isArray(campaignIds) || campaignIds.length === 0) {
    throw new MetaMcpError(
      ErrorCategory.VALIDATION,
      'Required parameter: campaignIds (array of campaign IDs)'
    );
  }

  const result = await campaignService!.bulkPauseCampaigns(campaignIds, dryRun);

  const lines = result.details.map((d) => `- ${d.name} (${d.id}): ${d.action}`);

  const actionVerb = dryRun ? 'would be paused' : 'paused';

  return {
    content: [
      {
        type: 'text',
        text:
          `Bulk Pause Campaigns${dryRun ? ' (DRY RUN)' : ''}\n\n` +
          `Processed: ${result.processed}\n` +
          `${actionVerb}: ${result.paused}\n` +
          `Already paused: ${result.alreadyPaused}\n` +
          `Errors: ${result.errors}\n\n` +
          `Details:\n${lines.join('\n')}`,
      },
    ],
  };
}

async function handleBulkActivateCampaigns(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const campaignIds = args?.campaignIds as string[];
  const dryRun = args?.dryRun === true; // Default: false

  if (!campaignIds || !Array.isArray(campaignIds) || campaignIds.length === 0) {
    throw new MetaMcpError(
      ErrorCategory.VALIDATION,
      'Required parameter: campaignIds (array of campaign IDs)'
    );
  }

  const result = await campaignService!.bulkActivateCampaigns(campaignIds, dryRun);

  const lines = result.details.map((d) => `- ${d.name} (${d.id}): ${d.action}`);

  const actionVerb = dryRun ? 'would be activated' : 'activated';

  return {
    content: [
      {
        type: 'text',
        text:
          `Bulk Activate Campaigns${dryRun ? ' (DRY RUN)' : ''}\n\n` +
          `Processed: ${result.processed}\n` +
          `${actionVerb}: ${result.activated}\n` +
          `Already active: ${result.alreadyActive}\n` +
          `Errors: ${result.errors}\n\n` +
          `Details:\n${lines.join('\n')}`,
      },
    ],
  };
}

async function handleCheckAlerts(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const accountId = args?.accountId as string;
  const cprThreshold = (args?.cprThreshold as number) || 5000;
  const minCtr = (args?.minCtr as number) || 1.0;
  const minDailySpend = (args?.minDailySpend as number) || 1000;
  const datePreset = (args?.datePreset as string) || 'yesterday';

  if (!accountId) {
    throw new MetaMcpError(ErrorCategory.VALIDATION, 'Required parameter: accountId');
  }

  const result = await campaignService!.checkAlerts(
    accountId,
    cprThreshold,
    minCtr,
    minDailySpend,
    datePreset
  );

  if (result.alerts.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text:
            `Performance Check: No alerts\n\n` +
            `Campaigns checked: ${result.campaignsChecked}\n\n` +
            `All campaigns are performing within thresholds:\n` +
            `- CPR below $${(cprThreshold / 100).toFixed(2)}\n` +
            `- CTR above ${minCtr}%\n` +
            `- Spend above $${(minDailySpend / 100).toFixed(2)}`,
        },
      ],
    };
  }

  const alertLines = result.alerts.map((a) => {
    const value =
      a.alertType === 'high_cpr'
        ? `$${(a.value / 100).toFixed(2)}`
        : a.alertType === 'low_ctr'
          ? `${a.value.toFixed(2)}%`
          : `$${(a.value / 100).toFixed(2)}`;

    const threshold =
      a.alertType === 'high_cpr'
        ? `$${(a.threshold / 100).toFixed(2)}`
        : a.alertType === 'low_ctr'
          ? `${a.threshold}%`
          : `$${(a.threshold / 100).toFixed(2)}`;

    return `- ${a.campaignName}\n  Issue: ${a.message}\n  Value: ${value} | Threshold: ${threshold}`;
  });

  return {
    content: [
      {
        type: 'text',
        text:
          `Performance Check: ${result.alerts.length} Alerts Found\n\n` +
          `Campaigns checked: ${result.campaignsChecked}\n\n` +
          `Alerts:\n${alertLines.join('\n\n')}`,
      },
    ],
  };
}

// ==================== DETAIL GETTER HANDLERS ====================

async function handleGetAccountInfo(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const accountId = args?.accountId as string;
  const result = await graphClient!.getAccountInfo(accountId);

  return {
    structuredContent: result,
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function handleGetCampaignDetails(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const campaignId = args?.campaignId as string;
  const result = await graphClient!.getCampaignDetails(campaignId);

  return {
    structuredContent: result as unknown as Record<string, unknown>,
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function handleGetAdSetDetails(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const adSetId = args?.adSetId as string;
  const result = await graphClient!.getAdSetDetails(adSetId);

  return {
    structuredContent: result as unknown as Record<string, unknown>,
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function handleGetAdDetails(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const adId = args?.adId as string;
  const result = await graphClient!.getAdDetails(adId);

  return {
    structuredContent: result as unknown as Record<string, unknown>,
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function handleUpdateAd(args: Record<string, unknown> | undefined): Promise<CallToolResult> {
  const adId = args?.adId as string;
  const status = args?.status as 'ACTIVE' | 'PAUSED' | undefined;
  const bidAmount = args?.bidAmount as number | undefined;

  const result = await graphClient!.updateAd(adId, { status, bidAmount });

  const lines = [`Ad updated successfully.`, `ID: ${result.id}`];
  if (status !== undefined) lines.push(`Status: ${status}`);
  if (bidAmount !== undefined) lines.push(`Bid Amount: ${bidAmount}`);

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
  };
}

// ==================== BUDGET HANDLERS ====================

async function handleCreateBudgetSchedule(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const campaignId = args?.campaignId as string;
  const budgetValue = args?.budgetValue as number;
  const budgetValueType = args?.budgetValueType as 'ABSOLUTE' | 'MULTIPLIER';
  const timeStart = args?.timeStart as number;
  const timeEnd = args?.timeEnd as number;

  const result = await graphClient!.createBudgetSchedule(campaignId, {
    budgetValue,
    budgetValueType,
    timeStart,
    timeEnd,
  });

  return {
    structuredContent: result,
    content: [
      {
        type: 'text',
        text: `Budget schedule created:\n\nID: ${result.id}\nCampaign: ${campaignId}\nType: ${budgetValueType}\nValue: ${budgetValue}`,
      },
    ],
  };
}

// ==================== TARGETING RESEARCH HANDLERS ====================

async function handleSearchInterests(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const query = args?.query as string;
  const limit = (args?.limit as number) ?? 25;

  const result = await targetingClient!.searchInterests(query, limit);

  return {
    structuredContent: { items: result },
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function handleGetInterestSuggestions(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const interestList = args?.interestList as string[];
  const limit = (args?.limit as number) ?? 25;

  const result = await targetingClient!.getInterestSuggestions(interestList, limit);

  return {
    structuredContent: { items: result },
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function handleValidateInterests(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const interestList = args?.interestList as string[] | undefined;
  const interestFbidList = args?.interestFbidList as string[] | undefined;

  const result = await targetingClient!.validateInterests(interestList, interestFbidList);

  return {
    structuredContent: { items: result },
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function handleSearchBehaviors(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const limit = (args?.limit as number) ?? 50;

  const result = await targetingClient!.searchBehaviors(limit);

  return {
    structuredContent: { items: result },
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function handleSearchDemographics(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const demographicClass = args?.demographicClass as string;
  const limit = (args?.limit as number) ?? 50;

  const result = await targetingClient!.searchDemographics(demographicClass, limit);

  return {
    structuredContent: { items: result },
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function handleSearchGeoLocations(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const query = args?.query as string;
  const locationTypes = args?.locationTypes as string[] | undefined;
  const limit = (args?.limit as number) ?? 25;

  const result = await targetingClient!.searchGeoLocations(query, locationTypes, limit);

  return {
    structuredContent: { items: result },
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

// ==================== CREATIVE HANDLERS ====================

async function handleGetAdCreatives(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const adId = args?.adId as string;
  const result = await creativeClient!.getAdCreatives(adId);

  return {
    structuredContent: { items: result },
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

