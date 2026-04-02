import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGraphClient = {
  getAccountInfo: vi.fn(),
  getCampaignDetails: vi.fn(),
  getAdSetDetails: vi.fn(),
  getAdDetails: vi.fn(),
  updateAd: vi.fn(),
  createBudgetSchedule: vi.fn(),
};

const mockTargetingClient = {
  searchInterests: vi.fn(),
  getInterestSuggestions: vi.fn(),
  validateInterests: vi.fn(),
  searchBehaviors: vi.fn(),
  searchDemographics: vi.fn(),
  searchGeoLocations: vi.fn(),
};

const mockCreativeClient = {
  getAdCreatives: vi.fn(),
};

vi.mock('../api/graph-client.js', () => ({
  GraphClient: vi.fn().mockImplementation(() => mockGraphClient),
}));

vi.mock('../api/client.js', () => ({
  TargetingClient: vi.fn().mockImplementation(() => mockTargetingClient),
  CreativeClient: vi.fn().mockImplementation(() => mockCreativeClient),
}));

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

// ==================== GROUP 1: DETAIL GETTERS ====================

describe('handleToolCall getAccountInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  it('returns full account info with all expected fields', async () => {
    mockGraphClient.getAccountInfo.mockResolvedValue({
      id: 'act_123',
      name: 'Test Account',
      currency: 'USD',
      timezoneId: '1',
      accountStatus: 1,
      business: { id: 'biz_1', name: 'Test Biz' },
    });

    const result = await handleToolCall('getAccountInfo', { accountId: 'act_123' });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');

    expect(textContent.text).toContain('"name"');
    expect(textContent.text).toContain('"currency"');
    expect(textContent.text).toContain('"timezoneId"');
    expect(textContent.text).toContain('"accountStatus"');
    expect(textContent.text).toContain('"business"');
    expect(textContent.text).toContain('Test Account');
    expect(result.isError).toBeFalsy();
  });
});

describe('handleToolCall getCampaignDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  it('returns campaign details with bidStrategy, buyingType and issues fields', async () => {
    mockGraphClient.getCampaignDetails.mockResolvedValue({
      id: 'cmp_1',
      name: 'Test Campaign',
      status: 'ACTIVE',
      objective: 'LEAD_GENERATION',
      dailyBudget: 5000,
      lifetimeBudget: undefined,
      createdTime: '2026-01-01',
      accountId: 'act_123',
      bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
      buyingType: 'AUCTION',
      specialAdCategories: [],
      stopTime: undefined,
      issuesInfo: [{ error_code: 1815745, error_message: 'Delivery issue', level: 'campaign' }],
    });

    const result = await handleToolCall('getCampaignDetails', { campaignId: 'cmp_1' });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');

    expect(textContent.text).toContain('"bidStrategy"');
    expect(textContent.text).toContain('"buyingType"');
    expect(textContent.text).toContain('"issuesInfo"');
    expect(textContent.text).toContain('LOWEST_COST_WITHOUT_CAP');
    expect(result.isError).toBeFalsy();
  });
});

describe('handleToolCall getAdSetDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  it('returns ad set details with bidAmount and effectiveStatus fields', async () => {
    mockGraphClient.getAdSetDetails.mockResolvedValue({
      id: 'adset_1',
      name: 'Test Ad Set',
      campaignId: 'cmp_1',
      status: 'ACTIVE',
      dailyBudget: 2000,
      lifetimeBudget: undefined,
      bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
      billingEvent: 'IMPRESSIONS',
      optimizationGoal: 'LEAD_GENERATION',
      bidAmount: 150,
      effectiveStatus: 'ACTIVE',
    });

    const result = await handleToolCall('getAdSetDetails', { adSetId: 'adset_1' });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');

    expect(textContent.text).toContain('"bidAmount"');
    expect(textContent.text).toContain('"effectiveStatus"');
    expect(textContent.text).toContain('150');
    expect(result.isError).toBeFalsy();
  });
});

describe('handleToolCall getAdDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  it('returns ad details with adSetId, campaignId and creativeId fields', async () => {
    mockGraphClient.getAdDetails.mockResolvedValue({
      id: 'ad_1',
      name: 'Test Ad',
      status: 'PAUSED',
      effectiveStatus: 'PAUSED',
      adSetId: 'adset_1',
      campaignId: 'cmp_1',
      creativeId: 'creative_1',
    });

    const result = await handleToolCall('getAdDetails', { adId: 'ad_1' });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');

    expect(textContent.text).toContain('"adSetId"');
    expect(textContent.text).toContain('"campaignId"');
    expect(textContent.text).toContain('"creativeId"');
    expect(textContent.text).toContain('adset_1');
    expect(textContent.text).toContain('cmp_1');
    expect(textContent.text).toContain('creative_1');
    expect(result.isError).toBeFalsy();
  });
});

// ==================== GROUP 2: AD OPERATIONS ====================


describe('handleToolCall updateAd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  it('updates ad status and returns the ID', async () => {
    mockGraphClient.updateAd.mockResolvedValue({ id: 'ad_1' });

    const result = await handleToolCall('updateAd', {
      adId: 'ad_1',
      status: 'PAUSED',
    });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');

    expect(textContent.text).toContain('ID: ad_1');
    expect(textContent.text).toContain('Status: PAUSED');
    expect(result.isError).toBeFalsy();
  });
});

// ==================== GROUP 3: BUDGET SCHEDULE ====================

describe('handleToolCall createBudgetSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  it('returns schedule ID in response', async () => {
    mockGraphClient.createBudgetSchedule.mockResolvedValue({ id: 'schedule_42' });

    const result = await handleToolCall('createBudgetSchedule', {
      campaignId: 'cmp_1',
      budgetValue: 20000,
      budgetValueType: 'ABSOLUTE',
      timeStart: 1700000000,
      timeEnd: 1700086400,
    });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');

    expect(textContent.text).toContain('ID: schedule_42');
    expect(result.isError).toBeFalsy();
  });
});

// ==================== GROUP 4: TARGETING ====================

describe('handleToolCall searchInterests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  it('returns empty array when no results found', async () => {
    mockTargetingClient.searchInterests.mockResolvedValue([]);

    const result = await handleToolCall('searchInterests', { query: 'obscure term' });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');

    expect(textContent.text).toContain('[]');
    expect(result.isError).toBeFalsy();
  });

  it('returns array of items with id and name', async () => {
    mockTargetingClient.searchInterests.mockResolvedValue([
      { id: '6003139266461', name: 'Soccer' },
      { id: '6003020834693', name: 'Football' },
    ]);

    const result = await handleToolCall('searchInterests', { query: 'soccer' });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');

    expect(textContent.text).toContain('Soccer');
    expect(textContent.text).toContain('Football');
    expect(result.isError).toBeFalsy();
  });
});

describe('handleToolCall getInterestSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  it('returns empty array when no suggestions found', async () => {
    mockTargetingClient.getInterestSuggestions.mockResolvedValue([]);

    const result = await handleToolCall('getInterestSuggestions', {
      interestList: ['6003139266461'],
    });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');

    expect(textContent.text).toContain('[]');
    expect(result.isError).toBeFalsy();
  });
});

describe('handleToolCall validateInterests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  it('returns empty array when interests are invalid', async () => {
    mockTargetingClient.validateInterests.mockResolvedValue([]);

    const result = await handleToolCall('validateInterests', {
      interestList: ['nonexistent interest'],
    });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');

    expect(textContent.text).toContain('[]');
    expect(result.isError).toBeFalsy();
  });
});

describe('handleToolCall searchBehaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  it('returns empty array when no behaviors found', async () => {
    mockTargetingClient.searchBehaviors.mockResolvedValue([]);

    const result = await handleToolCall('searchBehaviors', {});

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');

    expect(textContent.text).toContain('[]');
    expect(result.isError).toBeFalsy();
  });

  it('returns array of items with id and name', async () => {
    mockTargetingClient.searchBehaviors.mockResolvedValue([
      { id: 'beh_1', name: 'Early adopters' },
    ]);

    const result = await handleToolCall('searchBehaviors', {});

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');

    expect(textContent.text).toContain('Early adopters');
    expect(result.isError).toBeFalsy();
  });
});

describe('handleToolCall searchDemographics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  it('returns empty array when no demographics found', async () => {
    mockTargetingClient.searchDemographics.mockResolvedValue([]);

    const result = await handleToolCall('searchDemographics', {
      demographicClass: 'life_events',
    });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');

    expect(textContent.text).toContain('[]');
    expect(result.isError).toBeFalsy();
  });
});

describe('handleToolCall searchGeoLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  it('returns empty array when no geo results found', async () => {
    mockTargetingClient.searchGeoLocations.mockResolvedValue([]);

    const result = await handleToolCall('searchGeoLocations', { query: 'zzz' });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');

    expect(textContent.text).toContain('[]');
    expect(result.isError).toBeFalsy();
  });

  it('returns array of items with id and name', async () => {
    mockTargetingClient.searchGeoLocations.mockResolvedValue([
      { id: 'AR', name: 'Argentina' },
    ]);

    const result = await handleToolCall('searchGeoLocations', { query: 'Argentina' });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');

    expect(textContent.text).toContain('Argentina');
    expect(result.isError).toBeFalsy();
  });
});

// ==================== GROUP 5: CREATIVES ====================

describe('handleToolCall getAdCreatives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  it('returns mapped creative fields including objectStorySpec, imageHash, callToAction', async () => {
    mockCreativeClient.getAdCreatives.mockResolvedValue([
      {
        id: 'creative_1',
        name: 'My Creative',
        objectStorySpec: { page_id: 'page_1', link_data: { link: 'https://example.com' } },
        imageHash: 'abc123hash',
        callToAction: { type: 'LEARN_MORE' },
      },
    ]);

    const result = await handleToolCall('getAdCreatives', { adId: 'ad_1' });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');

    expect(textContent.text).toContain('"objectStorySpec"');
    expect(textContent.text).toContain('"imageHash"');
    expect(textContent.text).toContain('"callToAction"');
    expect(textContent.text).toContain('abc123hash');
    expect(textContent.text).toContain('LEARN_MORE');
    expect(result.isError).toBeFalsy();
  });
});

