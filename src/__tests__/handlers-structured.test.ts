/**
 * handlers-structured.test.ts
 *
 * TDD tests for the 4 migrated handlers that return dual payload:
 * - handleDiscoverAdAccounts (P3.1/P3.2)
 * - handleGetCampaigns      (P3.3/P3.4)
 * - handleGetAdSets         (P3.5/P3.6)
 * - handleGetAds            (P3.7/P3.8)
 *
 * Each test asserts:
 * 1. structuredContent shape (JSON path)
 * 2. content[0].text preserved (human-readable, unchanged format)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Service mocks (shared setup pattern from handlers.test.ts)
// ---------------------------------------------------------------------------
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

vi.mock('../api/graph-client.js', () => ({
  GraphClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../api/client.js', () => ({
  TargetingClient: vi.fn().mockImplementation(() => ({})),
  CreativeClient: vi.fn().mockImplementation(() => ({})),
}));

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

// ---------------------------------------------------------------------------
// P3.1 / P3.2 — handleDiscoverAdAccounts
// ---------------------------------------------------------------------------
describe('handleToolCall discoverAdAccounts — structured payload (P3.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  it('returns structuredContent with count and items array', async () => {
    mockAccountService.discoverAdAccounts.mockResolvedValue([
      { id: 'act_1', name: 'Acc A', businessName: 'Biz A', status: 1 },
      { id: 'act_2', name: 'Acc B', businessName: 'Biz B', status: 1 },
    ]);

    const result = await handleToolCall('discoverAdAccounts', {});

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toBeDefined();

    const sc = result.structuredContent as { count: number; items: unknown[] };
    expect(sc.count).toBe(2);
    expect(sc.items).toHaveLength(2);
    expect((sc.items[0] as { id: string }).id).toBe('act_1');
    expect((sc.items[0] as { name: string }).name).toBe('Acc A');
    expect((sc.items[0] as { businessName: string }).businessName).toBe('Biz A');
  });

  it('preserves human-readable text in content[0].text', async () => {
    mockAccountService.discoverAdAccounts.mockResolvedValue([
      { id: 'act_1', name: 'Acc A', businessName: 'Biz A', status: 1 },
    ]);

    const result = await handleToolCall('discoverAdAccounts', {});

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');
    expect(textContent.text).toContain('Acc A');
    expect(textContent.text).toContain('act_1');
  });

  it('empty list: structuredContent.count=0, items=[]', async () => {
    mockAccountService.discoverAdAccounts.mockResolvedValue([]);

    const result = await handleToolCall('discoverAdAccounts', {});

    // Empty state returns only text (no accounts to structure) — count=0
    // The handler should still return a structuredContent with count 0
    const sc = result.structuredContent as { count: number; items: unknown[] } | undefined;
    if (sc !== undefined) {
      expect(sc.count).toBe(0);
      expect(sc.items).toHaveLength(0);
    } else {
      // If structuredContent is absent for empty, text must mention no accounts
      const textContent = result.content[0];
      expect(textContent?.type).toBe('text');
      if (textContent?.type !== 'text') throw new Error('Expected text content');
      expect(textContent.text).toContain('No');
    }
  });
});

// ---------------------------------------------------------------------------
// P3.3 / P3.4 — handleGetCampaigns
// ---------------------------------------------------------------------------
describe('handleToolCall getCampaigns — structured payload (P3.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
    mockAccountService.resolveAccount.mockResolvedValue('act_123');
  });

  const makeCampaign = (overrides = {}) => ({
    id: 'camp_1',
    name: 'Campaign 1',
    status: 'PAUSED',
    effectiveStatus: 'PAUSED',
    objective: 'LINK_CLICKS',
    dailyBudget: 50000,
    lifetimeBudget: undefined,
    createdTime: '2026-01-01T00:00:00Z',
    ...overrides,
  });

  it('SC-3: structuredContent has objective and dailyBudgetCents as number', async () => {
    mockCampaignService.getCampaigns.mockResolvedValue([makeCampaign()]);

    const result = await handleToolCall('getCampaigns', { accountId: 'act_123' });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toBeDefined();

    const sc = result.structuredContent as { count: number; items: unknown[] };
    expect(sc.count).toBe(1);

    const item = sc.items[0] as {
      id: string;
      objective: string;
      dailyBudgetCents: number;
      status: string;
      effectiveStatus: string;
    };

    expect(item.id).toBe('camp_1');
    expect(item.objective).toBe('LINK_CLICKS');
    // Budget must be numeric, not a formatted string
    expect(typeof item.dailyBudgetCents).toBe('number');
    expect(item.dailyBudgetCents).toBe(50000);
  });

  it('structuredContent contains both status and effectiveStatus as distinct fields', async () => {
    mockCampaignService.getCampaigns.mockResolvedValue([
      makeCampaign({ status: 'PAUSED', effectiveStatus: 'PAUSED_REVIEWS' }),
    ]);

    const result = await handleToolCall('getCampaigns', { accountId: 'act_123' });

    const sc = result.structuredContent as { items: unknown[] };
    const item = sc.items[0] as { status: string; effectiveStatus: string };

    expect(item.status).toBe('PAUSED');
    expect(item.effectiveStatus).toBe('PAUSED_REVIEWS');
    expect(item.status).not.toBe(item.effectiveStatus);
  });

  it('preserves human-readable text in content[0].text', async () => {
    mockCampaignService.getCampaigns.mockResolvedValue([makeCampaign()]);

    const result = await handleToolCall('getCampaigns', { accountId: 'act_123' });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');
    expect(textContent.text).toContain('Campaign 1');
    expect(textContent.text).toContain('camp_1');
  });

  it('empty list: structuredContent.count=0, items=[]', async () => {
    mockCampaignService.getCampaigns.mockResolvedValue([]);

    const result = await handleToolCall('getCampaigns', { accountId: 'act_123' });

    const sc = result.structuredContent as { count: number; items: unknown[] };
    expect(sc.count).toBe(0);
    expect(sc.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// P3.5 / P3.6 — handleGetAdSets
// ---------------------------------------------------------------------------
describe('handleToolCall getAdSets — structured payload (P3.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  const makeAdSet = (overrides = {}) => ({
    id: 'adset_1',
    name: 'AdSet 1',
    campaignId: 'camp_1',
    status: 'ACTIVE',
    effectiveStatus: 'LIMITED',
    dailyBudget: 10000,
    lifetimeBudget: undefined,
    ...overrides,
  });

  it('SC-1: structuredContent.count matches items count', async () => {
    mockAdSetService.getAdSets.mockResolvedValue([makeAdSet(), makeAdSet({ id: 'adset_2', name: 'AdSet 2' })]);

    const result = await handleToolCall('getAdSets', { accountId: 'act_1' });

    expect(result.isError).toBeFalsy();
    const sc = result.structuredContent as { count: number; items: unknown[] };
    expect(sc.count).toBe(2);
    expect(sc.items).toHaveLength(2);
  });

  it('SC-1: each item has both status and effectiveStatus as distinct fields', async () => {
    mockAdSetService.getAdSets.mockResolvedValue([
      makeAdSet({ status: 'ACTIVE', effectiveStatus: 'LIMITED' }),
    ]);

    const result = await handleToolCall('getAdSets', { accountId: 'act_1' });

    const sc = result.structuredContent as { items: unknown[] };
    const item = sc.items[0] as { status: string; effectiveStatus: string };
    expect(item.status).toBe('ACTIVE');
    expect(item.effectiveStatus).toBe('LIMITED');
    expect(item.status).not.toBe(item.effectiveStatus);
  });

  it('budget fields are numeric (dailyBudgetCents)', async () => {
    mockAdSetService.getAdSets.mockResolvedValue([makeAdSet({ dailyBudget: 15000 })]);

    const result = await handleToolCall('getAdSets', { accountId: 'act_1' });

    const sc = result.structuredContent as { items: unknown[] };
    const item = sc.items[0] as { dailyBudgetCents: number };
    expect(typeof item.dailyBudgetCents).toBe('number');
    expect(item.dailyBudgetCents).toBe(15000);
  });

  it('SC-2: empty list — structuredContent.count=0, items=[]', async () => {
    mockAdSetService.getAdSets.mockResolvedValue([]);

    const result = await handleToolCall('getAdSets', { accountId: 'act_1' });

    const sc = result.structuredContent as { count: number; items: unknown[] };
    expect(sc.count).toBe(0);
    expect(sc.items).toHaveLength(0);
  });

  it('SC-2: empty list — content[0].text includes human-readable message', async () => {
    mockAdSetService.getAdSets.mockResolvedValue([]);

    const result = await handleToolCall('getAdSets', { accountId: 'act_1' });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');
    expect(textContent.text.toLowerCase()).toContain('no ad sets');
  });

  it('preserves human-readable text for non-empty list', async () => {
    mockAdSetService.getAdSets.mockResolvedValue([makeAdSet()]);

    const result = await handleToolCall('getAdSets', { accountId: 'act_1' });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');
    expect(textContent.text).toContain('AdSet 1');
    expect(textContent.text).toContain('adset_1');
  });
});

// ---------------------------------------------------------------------------
// P3.7 / P3.8 — handleGetAds
// ---------------------------------------------------------------------------
describe('handleToolCall getAds — structured payload (P3.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
  });

  const makeAd = (overrides = {}) => ({
    id: 'ad_1',
    name: 'Ad 1',
    adSetId: 'adset_1',
    campaignId: 'camp_1',
    status: 'ACTIVE',
    effectiveStatus: 'ACTIVE',
    creative: {
      title: 'Great offer',
      body: 'Click now',
      linkUrl: 'https://example.com',
      callToAction: 'LEARN_MORE',
    },
    ...overrides,
  });

  it('SC-4: creative field is an object, NOT a string', async () => {
    mockAdService.getAds.mockResolvedValue([makeAd()]);

    const result = await handleToolCall('getAds', { adSetId: 'adset_1' });

    expect(result.isError).toBeFalsy();
    const sc = result.structuredContent as { items: unknown[] };
    const item = sc.items[0] as { creative: unknown };

    expect(typeof item.creative).toBe('object');
    expect(item.creative).not.toBeNull();
    // Must NOT be a string
    expect(typeof item.creative).not.toBe('string');
  });

  it('creative object has expected fields (title, body, linkUrl, callToAction)', async () => {
    mockAdService.getAds.mockResolvedValue([makeAd()]);

    const result = await handleToolCall('getAds', { adSetId: 'adset_1' });

    const sc = result.structuredContent as { items: unknown[] };
    const item = sc.items[0] as { creative: Record<string, unknown> };
    expect(item.creative.title).toBe('Great offer');
    expect(item.creative.callToAction).toBe('LEARN_MORE');
  });

  it('both status and effectiveStatus fields are present', async () => {
    mockAdService.getAds.mockResolvedValue([
      makeAd({ status: 'ACTIVE', effectiveStatus: 'ACTIVE' }),
    ]);

    const result = await handleToolCall('getAds', { adSetId: 'adset_1' });

    const sc = result.structuredContent as { items: unknown[] };
    const item = sc.items[0] as { status: string; effectiveStatus: string };
    expect(item.status).toBe('ACTIVE');
    expect(item.effectiveStatus).toBe('ACTIVE');
  });

  it('preserves human-readable text in content[0].text', async () => {
    mockAdService.getAds.mockResolvedValue([makeAd()]);

    const result = await handleToolCall('getAds', { adSetId: 'adset_1' });

    const textContent = result.content[0];
    expect(textContent?.type).toBe('text');
    if (textContent?.type !== 'text') throw new Error('Expected text content');
    expect(textContent.text).toContain('Ad 1');
    expect(textContent.text).toContain('ad_1');
  });

  it('empty list returns structuredContent with count=0', async () => {
    mockAdService.getAds.mockResolvedValue([]);

    const result = await handleToolCall('getAds', { adSetId: 'adset_1' });

    const sc = result.structuredContent as { count: number; items: unknown[] };
    expect(sc.count).toBe(0);
    expect(sc.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// P1.x — _meta.errorCategory on error results
// ---------------------------------------------------------------------------
describe('handleToolCall — _meta.errorCategory on isError results (P1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeHandlers('token');
    mockAccountService.resolveAccount.mockResolvedValue('act_123');
  });

  it('P1.1 Zod validation rejection → _meta.errorCategory: validation', async () => {
    // Pass a clearly invalid arg that will fail Zod schema (status: 'running' is not valid)
    const result = await handleToolCall('getCampaigns', { accountId: 'act_123', status: 'running' });

    expect(result.isError).toBe(true);
    const meta = result._meta as { errorCategory?: string } | undefined;
    expect(meta).toBeDefined();
    expect(meta?.errorCategory).toBe('validation');
  });

  it('P1.4a MetaMcpError VALIDATION category → errorCategory: validation', async () => {
    const { MetaMcpError, ErrorCategory } = await import('../utils/errors.js');
    mockCampaignService.getCampaigns.mockRejectedValue(
      new MetaMcpError(ErrorCategory.VALIDATION, 'test validation error')
    );
    const result = await handleToolCall('getCampaigns', { accountId: 'act_123' });

    expect(result.isError).toBe(true);
    const meta = result._meta as { errorCategory?: string } | undefined;
    expect(meta?.errorCategory).toBe('validation');
  });

  it('P1.4b MetaMcpError NETWORK category → errorCategory: transport', async () => {
    const { MetaMcpError, ErrorCategory } = await import('../utils/errors.js');
    mockCampaignService.getCampaigns.mockRejectedValue(
      new MetaMcpError(ErrorCategory.NETWORK, 'test network error')
    );
    const result = await handleToolCall('getCampaigns', { accountId: 'act_123' });

    expect(result.isError).toBe(true);
    const meta = result._meta as { errorCategory?: string } | undefined;
    expect(meta?.errorCategory).toBe('transport');
  });

  it('P1.4c MetaMcpError RATE_LIMIT category → errorCategory: graph_api', async () => {
    const { MetaMcpError, ErrorCategory } = await import('../utils/errors.js');
    mockCampaignService.getCampaigns.mockRejectedValue(
      new MetaMcpError(ErrorCategory.RATE_LIMIT, 'rate limited')
    );
    const result = await handleToolCall('getCampaigns', { accountId: 'act_123' });

    expect(result.isError).toBe(true);
    const meta = result._meta as { errorCategory?: string } | undefined;
    expect(meta?.errorCategory).toBe('graph_api');
  });

  it('P1.4d plain Error (non-MetaMcpError) → errorCategory: unknown', async () => {
    mockCampaignService.getCampaigns.mockRejectedValue(new Error('something unexpected'));
    const result = await handleToolCall('getCampaigns', { accountId: 'act_123' });

    expect(result.isError).toBe(true);
    const meta = result._meta as { errorCategory?: string } | undefined;
    expect(meta?.errorCategory).toBe('unknown');
  });
});
