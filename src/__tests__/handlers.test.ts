import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAccountService = {
  discoverAdAccounts: vi.fn(),
  getAccount: vi.fn(),
  resolveAccount: vi.fn(),
};

const mockCampaignService = {
  getCampaigns: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  pauseCampaign: vi.fn(),
  activateCampaign: vi.fn(),
  cloneCampaign: vi.fn(),
  bulkPauseCampaigns: vi.fn(),
  bulkActivateCampaigns: vi.fn(),
  checkAlerts: vi.fn(),
};

const mockAdSetService = {
  getAdSets: vi.fn(),
  createAdSet: vi.fn(),
  updateAdSet: vi.fn(),
  pauseAdSet: vi.fn(),
  activateAdSet: vi.fn(),
  cloneAdSet: vi.fn(),
};

const mockAdService = {
  getAds: vi.fn(),
};

const mockInsightsService = {
  getMetrics: vi.fn(),
  getItemizedInsights: vi.fn(),
  compareTwoPeriods: vi.fn(),
};

vi.mock('../services/account-service.js', () => ({
  AccountService: vi.fn().mockImplementation(() => mockAccountService),
}));

vi.mock('../services/campaign-service.js', () => ({
  CampaignService: vi.fn().mockImplementation(() => mockCampaignService),
}));

vi.mock('../services/adset-service.js', () => ({
  AdSetService: vi.fn().mockImplementation(() => mockAdSetService),
}));

vi.mock('../services/ad-service.js', () => ({
  AdService: vi.fn().mockImplementation(() => mockAdService),
}));

vi.mock('../services/insights-service.js', () => ({
  COMPARE_TWO_PERIODS_SIGNIFICANT_CHANGE_THRESHOLD: 10,
  InsightsService: vi.fn().mockImplementation(() => mockInsightsService),
}));

import { handleToolCall, initializeHandlers } from '../tools/handlers.js';

describe('handleToolCall getInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  it('returns structured itemized insights for non-account levels', async () => {
    mockInsightsService.getItemizedInsights.mockResolvedValue([
      {
        level: 'adset',
        id: 'adset_1',
        name: 'Ad Set 1',
        campaignId: 'cmp_1',
        campaignName: 'Campaign 1',
        adsetId: 'adset_1',
        adsetName: 'Ad Set 1',
        spend: 2500,
        results: 5,
        cpr: 500,
        impressions: 1000,
        clicks: 40,
        ctr: 4,
        actions: [{ actionType: 'lead', value: '5' }],
        costPerActionType: [{ actionType: 'lead', value: '500' }],
        dateStart: '2026-03-01',
        dateStop: '2026-03-07',
        dateRange: '2026-03-01 → 2026-03-07',
      },
      {
        level: 'adset',
        id: 'adset_2',
        name: 'Ad Set 2',
        campaignId: 'cmp_1',
        campaignName: 'Campaign 1',
        adsetId: 'adset_2',
        adsetName: 'Ad Set 2',
        spend: 1500,
        results: 3,
        cpr: 500,
        impressions: 500,
        clicks: 20,
        ctr: 4,
        dateStart: '2026-03-01',
        dateStop: '2026-03-07',
        dateRange: '2026-03-01 → 2026-03-07',
      },
    ]);

    const result = await handleToolCall('getInsights', {
      objectId: 'cmp_1',
      level: 'adset',
      datePreset: 'last_7d',
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      objectId: 'cmp_1',
      level: 'adset',
      requestedPeriod: 'last_7d',
      requestedTimeRange: null,
      summary: {
        itemCount: 2,
        dateRange: '2026-03-01 → 2026-03-07',
        totals: {
          spend: 4000,
          results: 8,
          cpr: 500,
          impressions: 1500,
          clicks: 60,
          ctr: 4,
        },
      },
      items: [
        {
          level: 'adset',
          id: 'adset_1',
          name: 'Ad Set 1',
          campaignId: 'cmp_1',
          campaignName: 'Campaign 1',
          adsetId: 'adset_1',
          adsetName: 'Ad Set 1',
          spend: 2500,
          results: 5,
          cpr: 500,
          impressions: 1000,
          clicks: 40,
          ctr: 4,
          actions: [{ actionType: 'lead', value: '5' }],
          costPerActionType: [{ actionType: 'lead', value: '500' }],
          dateStart: '2026-03-01',
          dateStop: '2026-03-07',
          dateRange: '2026-03-01 → 2026-03-07',
        },
        {
          level: 'adset',
          id: 'adset_2',
          name: 'Ad Set 2',
          campaignId: 'cmp_1',
          campaignName: 'Campaign 1',
          adsetId: 'adset_2',
          adsetName: 'Ad Set 2',
          spend: 1500,
          results: 3,
          cpr: 500,
          impressions: 500,
          clicks: 20,
          ctr: 4,
          dateStart: '2026-03-01',
          dateStop: '2026-03-07',
          dateRange: '2026-03-01 → 2026-03-07',
        },
      ],
    });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') {
      throw new Error('Expected text content');
    }

    expect(textContent.text).toContain('Performance Metrics by adset');
    expect(textContent.text).toContain('Total Results: 8');
    expect(textContent.text).toContain('Average CPR: $5.00');
    expect(textContent.text).toContain('ID: adset_1');
  });

  it('keeps account-level getInsights compatible with text output', async () => {
    mockInsightsService.getMetrics.mockResolvedValue({
      spend: 5000,
      results: 10,
      cpr: 500,
      impressions: 2000,
      clicks: 100,
      ctr: 5,
      dateRange: '2026-03-01 → 2026-03-07',
    });

    const result = await handleToolCall('getInsights', {
      objectId: 'act_123',
      level: 'account',
      datePreset: 'last_7d',
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toBeUndefined();

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') {
      throw new Error('Expected text content');
    }

    expect(textContent.text).toContain('Results: 10');
    expect(textContent.text).toContain('CPR: $5.00');
  });
});

describe('handleToolCall compareTwoPeriods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  it('returns structured comparison output with resolved result definition', async () => {
    mockInsightsService.compareTwoPeriods.mockResolvedValue({
      requestedMetrics: ['spend', 'results', 'cpr'],
      current: {
        spend: 12000,
        results: 12,
        cpr: 1000,
        impressions: 4000,
        clicks: 120,
        ctr: 3,
        dateRange: '2026-03-01 → 2026-03-07',
      },
      previous: {
        spend: 9000,
        results: 9,
        cpr: 1000,
        impressions: 3500,
        clicks: 90,
        ctr: 2.57,
        dateRange: '2026-02-22 → 2026-02-28',
      },
      resultDefinition: {
        requestedMode: 'primary_from_insights',
        requestedActionType: null,
        resolvedMode: 'specific_action',
        resolvedActionType: 'lead',
        resolutionSource: 'current_primary_action',
        message: 'Results use the current period primary action type "lead" across both periods.',
      },
      comparisonContext: {
        resultResolutionFallback: false,
        resultResolutionSource: null,
        significanceThresholdPercentage: 10,
      },
      reference: {
        basis: 'same_campaign',
        message: 'Compared against the same campaign in the previous period.',
      },
      changes: {
        spend: {
          absolute: 3000,
          percentage: 33.33,
          direction: 'up',
          significant: true,
        },
        results: {
          absolute: 3,
          percentage: 33.33,
          direction: 'up',
          significant: true,
        },
        cpr: {
          absolute: 0,
          percentage: 0,
          direction: 'same',
          significant: false,
        },
      },
    });

    const result = await handleToolCall('compareTwoPeriods', {
      objectId: '123',
      level: 'campaign',
      currentPeriod: {
        timeRange: { since: '2026-03-01', until: '2026-03-07' },
      },
      previousPeriod: {
        datePreset: 'last_month',
      },
    });

    expect(mockInsightsService.compareTwoPeriods).toHaveBeenCalledWith('123', 'campaign', {
      currentPeriod: {
        timeRange: { since: '2026-03-01', until: '2026-03-07' },
      },
      previousPeriod: {
        datePreset: 'last_month',
      },
      metrics: ['spend', 'results', 'cpr'],
      resultMode: 'primary_from_insights',
      resultActionType: undefined,
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      objectId: '123',
      level: 'campaign',
      currentPeriod: {
        requested: {
          timeRange: { since: '2026-03-01', until: '2026-03-07' },
        },
        dateRange: '2026-03-01 → 2026-03-07',
      },
      previousPeriod: {
        requested: {
          datePreset: 'last_month',
        },
        dateRange: '2026-02-22 → 2026-02-28',
      },
      resultDefinition: {
        requestedMode: 'primary_from_insights',
        requestedActionType: null,
        resolvedMode: 'specific_action',
        resolvedActionType: 'lead',
        resolutionSource: 'current_primary_action',
        message: 'Results use the current period primary action type "lead" across both periods.',
      },
      comparisonContext: {
        resultResolutionFallback: false,
        resultResolutionSource: null,
        significanceThresholdPercentage: 10,
      },
      reference: {
        basis: 'same_campaign',
        message: 'Compared against the same campaign in the previous period.',
      },
      metrics: {
        requested: ['spend', 'results', 'cpr'],
        returned: {
          spend: {
            label: 'Spend',
            unit: 'currency_cents',
            current: 12000,
            previous: 9000,
            change: {
              absolute: 3000,
              percentage: 33.33,
              direction: 'up',
              significant: true,
            },
          },
          results: {
            label: 'Results',
            unit: 'count',
            current: 12,
            previous: 9,
            change: {
              absolute: 3,
              percentage: 33.33,
              direction: 'up',
              significant: true,
            },
          },
          cpr: {
            label: 'CPR',
            unit: 'currency_cents',
            current: 1000,
            previous: 1000,
            change: {
              absolute: 0,
              percentage: 0,
              direction: 'same',
              significant: false,
            },
          },
        },
      },
    });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') {
      throw new Error('Expected text content');
    }

    expect(textContent.text).toContain('Results Definition: lead');
    expect(textContent.text).toContain('Resolved Action Type: lead');
    expect(textContent.text).toContain('Result Resolution Fallback: no');
    expect(textContent.text).toContain('Significance Threshold: 10.00%');
    expect(textContent.text).toContain('Current Period: 2026-03-01 → 2026-03-07');
    expect(textContent.text).toContain('Requested Metrics: spend, results, cpr');
    expect(textContent.text).not.toContain('Executive Summary');
    expect(textContent.text).not.toContain('improved');
    expect(textContent.text).not.toContain('declined');
    expect(textContent.text).not.toContain('worsened');
    expect(textContent.text).not.toContain('| Significant');
  });

  it('keeps text output focused on requested non-result metrics', async () => {
    mockInsightsService.compareTwoPeriods.mockResolvedValue({
      requestedMetrics: ['impressions', 'clicks', 'ctr'],
      current: {
        spend: 12000,
        results: 12,
        cpr: 1000,
        impressions: 4000,
        clicks: 120,
        ctr: 3,
        dateRange: '2026-03-01 → 2026-03-07',
      },
      previous: {
        spend: 9000,
        results: 9,
        cpr: 1000,
        impressions: 3500,
        clicks: 90,
        ctr: 2.57,
        dateRange: '2026-02-22 → 2026-02-28',
      },
      resultDefinition: {
        requestedMode: 'primary_from_insights',
        requestedActionType: null,
        resolvedMode: 'specific_action',
        resolvedActionType: 'lead',
        resolutionSource: 'current_primary_action',
        message: 'Results use the current period primary action type "lead" across both periods.',
      },
      reference: {
        basis: 'same_campaign',
        message: 'Compared against the same campaign in the previous period.',
      },
      changes: {
        impressions: {
          absolute: 500,
          percentage: 14.29,
          direction: 'up',
          significant: true,
        },
        clicks: {
          absolute: 30,
          percentage: 33.33,
          direction: 'up',
          significant: true,
        },
        ctr: {
          absolute: 0.43,
          percentage: 16.73,
          direction: 'up',
          significant: true,
        },
      },
    });

    const result = await handleToolCall('compareTwoPeriods', {
      objectId: '123',
      level: 'campaign',
      currentPeriod: { datePreset: 'last_7d' },
      previousPeriod: { datePreset: 'last_month' },
      metrics: ['impressions', 'clicks', 'ctr'],
    });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') {
      throw new Error('Expected text content');
    }

    expect(textContent.text).toContain('Requested Metrics: impressions, clicks, ctr');
    expect(textContent.text).toContain('Impressions: 4000 vs 3500');
    expect(textContent.text).toContain('CTR: 3.00% vs 2.57%');
    expect(textContent.text).toContain('Change: ↑ +0.43 pts (+16.73%)');
    expect(textContent.text).not.toContain('Results Definition:');
    expect(textContent.text).not.toContain('Resolved Action Type:');
  });
});
