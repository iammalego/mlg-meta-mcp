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
import { getLogger } from '../utils/logger.js';
import { MetaMcpError, ErrorCategory } from '../utils/errors.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { parseToolArgs } from './index.js';

const logger = getLogger();

// Service singletons (initialized once)
let accountService: AccountService | null = null;
let campaignService: CampaignService | null = null;
let adSetService: AdSetService | null = null;
let adService: AdService | null = null;
let insightsService: InsightsService | null = null;

export function initializeHandlers(accessToken: string): void {
  accountService = new AccountService(accessToken);
  campaignService = new CampaignService(accessToken, accountService);
  adSetService = new AdSetService(accessToken, accountService);
  adService = new AdService(accessToken);
  insightsService = new InsightsService(accessToken, accountService);
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
    if (!accountService || !campaignService || !adSetService || !adService || !insightsService) {
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
      case 'createCampaign':
        return await handleCreateCampaign(parsedArgs);
      case 'updateCampaign':
        return await handleUpdateCampaign(parsedArgs);
      case 'pauseCampaign':
        return await handlePauseCampaign(parsedArgs);
      case 'activateCampaign':
        return await handleActivateCampaign(parsedArgs);

      // AdSets
      case 'getAdSets':
        return await handleGetAdSets(parsedArgs);
      case 'createAdSet':
        return await handleCreateAdSet(parsedArgs);
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

async function handleCreateCampaign(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const accountId = args?.accountId as string;
  const name = args?.name as string;
  const objective = args?.objective as string;
  const status = (args?.status as 'ACTIVE' | 'PAUSED') || 'PAUSED';
  const dailyBudget = args?.dailyBudget as number | undefined;
  const lifetimeBudget = args?.lifetimeBudget as number | undefined;

  if (!accountId || !name || !objective) {
    throw new MetaMcpError(
      ErrorCategory.VALIDATION,
      'Required parameters: accountId, name, objective'
    );
  }

  const result = await campaignService!.createCampaign(accountId, {
    name,
    objective,
    status,
    dailyBudget,
    lifetimeBudget,
  });

  return {
    content: [
      {
        type: 'text',
        text: `Campaign created:\n\nName: ${result.name}\nID: ${result.id}\nStatus: ${status}`,
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

async function handleCreateAdSet(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const campaignId = args?.campaignId as string;
  const name = args?.name as string;

  if (!campaignId || !name) {
    throw new MetaMcpError(ErrorCategory.VALIDATION, 'Required parameters: campaignId, name');
  }

  const result = await adSetService!.createAdSet(campaignId, {
    name,
    dailyBudget: args?.dailyBudget as number | undefined,
    lifetimeBudget: args?.lifetimeBudget as number | undefined,
    targeting: args?.targeting as Record<string, unknown> | undefined,
    bidStrategy: args?.bidStrategy as string | undefined,
    billingEvent: args?.billingEvent as string | undefined,
    optimizationGoal: args?.optimizationGoal as string | undefined,
    status: (args?.status as 'ACTIVE' | 'PAUSED') || 'PAUSED',
  });

  return {
    content: [
      {
        type: 'text',
        text: `Ad Set created:\n\nName: ${result.name}\nID: ${result.id}\nCampaign: ${campaignId}`,
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
    const items = await insightsService!.getItemizedInsights(objectId, level, datePreset, timeRange);

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

    const lines = items.map((item, i) => {
      const label =
        item.campaignName || item.adsetName || item.adName || item.campaignId || `Item ${i + 1}`;
      const spend = `$${(item.spend / 100).toFixed(2)}`;
      const ctr = `${item.ctr.toFixed(2)}%`;
      const period =
        item.dateStart && item.dateStop ? ` (${item.dateStart} → ${item.dateStop})` : '';

      return (
        `${i + 1}. ${label}${period}\n` +
        `   Spend: ${spend} | Impressions: ${item.impressions.toLocaleString()} | Clicks: ${item.clicks.toLocaleString()} | CTR: ${ctr}`
      );
    });

    return {
      content: [
        {
          type: 'text',
          text:
            `Performance Metrics by ${level}\n\n` +
            `Object: ${objectId}\n` +
            `Period: ${datePreset || 'default'}\n\n` +
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

async function handleCompareTwoPeriods(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const objectId = args?.objectId as string;
  const level = (args?.level as 'account' | 'campaign' | 'adset' | 'ad') || 'account';
  const currentPeriod = args?.currentPeriod as string;
  const previousPeriod = args?.previousPeriod as string;

  if (!objectId || !currentPeriod || !previousPeriod) {
    throw new MetaMcpError(
      ErrorCategory.VALIDATION,
      'Required parameters: objectId, currentPeriod, previousPeriod'
    );
  }

  const comparison = await insightsService!.compareTwoPeriods(
    objectId,
    level,
    currentPeriod,
    previousPeriod
  );

  const formatCurrency = (value: number): string => `$${(value / 100).toFixed(2)}`;
  const formatSignedCurrency = (value: number): string => {
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    return `${sign}${formatCurrency(Math.abs(value))}`;
  };
  const formatSignedNumber = (value: number): string => {
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    const absolute = Math.abs(value);
    return `${sign}${Number.isInteger(absolute) ? absolute : absolute.toFixed(2)}`;
  };
  const formatNumber = (value: number): string =>
    Number.isInteger(value) ? value.toString() : value.toFixed(2);
  const formatPercentage = (value: number): string => {
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    return `${sign}${Math.abs(value).toFixed(2)}%`;
  };
  const getArrow = (direction: 'up' | 'down' | 'same'): string => {
    if (direction === 'up') return '↑';
    if (direction === 'down') return '↓';
    return '→';
  };

  const summaryPoints: string[] = [];

  if (comparison.changes.spend.significant) {
    summaryPoints.push(
      `Spend ${comparison.changes.spend.direction === 'up' ? 'increased' : 'decreased'} significantly (${formatPercentage(comparison.changes.spend.percentage)}).`
    );
  }

  if (comparison.changes.results.significant) {
    summaryPoints.push(
      `Results ${comparison.changes.results.direction === 'up' ? 'improved' : 'declined'} significantly (${formatPercentage(comparison.changes.results.percentage)}).`
    );
  }

  if (comparison.changes.cpr.significant) {
    const cprTrend =
      comparison.changes.cpr.direction === 'down'
        ? 'improved'
        : comparison.changes.cpr.direction === 'up'
          ? 'worsened'
          : 'stayed flat';

    summaryPoints.push(`CPR ${cprTrend} (${formatPercentage(comparison.changes.cpr.percentage)}).`);
  }

  const executiveSummary =
    summaryPoints.length > 0
      ? summaryPoints.join(' ')
      : 'No significant changes detected above the 10% threshold.';

  return {
    content: [
      {
        type: 'text',
        text:
          `Comparison Between Two Periods\n\n` +
          `Object: ${objectId}\n` +
          `Level: ${level}\n` +
          `Current Period: ${currentPeriod} (${comparison.current.dateRange || 'n/a'})\n` +
          `Previous Period: ${previousPeriod} (${comparison.previous.dateRange || 'n/a'})\n` +
          `Reference Used: ${comparison.reference.message}\n\n` +
          `Executive Summary:\n${executiveSummary}\n\n` +
          `Spend: ${formatCurrency(comparison.current.spend)} vs ${formatCurrency(comparison.previous.spend)}\n` +
          `  ${getArrow(comparison.changes.spend.direction)} ${formatSignedCurrency(comparison.changes.spend.absolute)} (${formatPercentage(comparison.changes.spend.percentage)})${comparison.changes.spend.significant ? ' | Significant' : ''}\n\n` +
          `Results: ${formatNumber(comparison.current.results)} vs ${formatNumber(comparison.previous.results)}\n` +
          `  ${getArrow(comparison.changes.results.direction)} ${formatSignedNumber(comparison.changes.results.absolute)} (${formatPercentage(comparison.changes.results.percentage)})${comparison.changes.results.significant ? ' | Significant' : ''}\n\n` +
          `CPR: ${formatCurrency(comparison.current.cpr)} vs ${formatCurrency(comparison.previous.cpr)}\n` +
          `  ${getArrow(comparison.changes.cpr.direction)} ${formatSignedCurrency(comparison.changes.cpr.absolute)} (${formatPercentage(comparison.changes.cpr.percentage)})${comparison.changes.cpr.significant ? ' | Significant' : ''}`,
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
