/**
 * GraphClient — mapper unit tests
 *
 * P1.1: Verify effectiveStatus / status dual-field output (RED before P1.2/P1.3)
 * P1.4: Verify ACTIVE filter widening (RED before P1.5)
 */

import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { MetaApiClient } from '../api/base-client.js';
import { GraphClient } from '../api/graph-client.js';

// ---------------------------------------------------------------------------
// Spy on the base client methods so we never hit the real Meta API
// ---------------------------------------------------------------------------
let mockGet: MockInstance;
let mockPost: MockInstance;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------
function makeCampaignApiResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: [
      {
        id: 'camp_1',
        name: 'Test Campaign',
        status: 'PAUSED',
        effective_status: 'PAUSED_REVIEWS',
        objective: 'LINK_CLICKS',
        daily_budget: '50000',
        created_time: '2026-01-01T00:00:00Z',
        ...overrides,
      },
    ],
    paging: {},
  };
}

function makeAdSetApiResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: [
      {
        id: 'adset_1',
        name: 'Test AdSet',
        campaign_id: 'camp_1',
        status: 'ACTIVE',
        effective_status: 'LIMITED',
        daily_budget: '10000',
        ...overrides,
      },
    ],
    paging: {},
  };
}

function makeAdApiResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: [
      {
        id: 'ad_1',
        name: 'Test Ad',
        adset_id: 'adset_1',
        campaign_id: 'camp_1',
        status: 'ACTIVE',
        effective_status: 'ACTIVE',
        ...overrides,
      },
    ],
    paging: {},
  };
}

// ---------------------------------------------------------------------------
// P1.1 — Dual-field output: status and effectiveStatus are distinct
// ---------------------------------------------------------------------------
describe('GraphClient mapper — dual-field output (P1.1)', () => {
  let client: GraphClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet = vi.spyOn(MetaApiClient.prototype as unknown as { get: () => unknown }, 'get');
    mockPost = vi.spyOn(MetaApiClient.prototype as unknown as { post: () => unknown }, 'post');
    client = new GraphClient('dummy-token');
  });

  describe('getCampaigns()', () => {
    it('MG-1: maps status and effectiveStatus as distinct fields when they differ', async () => {
      mockGet.mockResolvedValue(
        makeCampaignApiResponse({ status: 'PAUSED', effective_status: 'PAUSED_REVIEWS' })
      );

      const [campaign] = await client.getCampaigns('act_1');

      expect(campaign.status).toBe('PAUSED');
      expect(campaign.effectiveStatus).toBe('PAUSED_REVIEWS');
      expect(campaign.status).not.toBe(campaign.effectiveStatus);
    });

    it('MG-2: maps both fields when configured=ACTIVE and effective=ACTIVE', async () => {
      mockGet.mockResolvedValue(
        makeCampaignApiResponse({ status: 'ACTIVE', effective_status: 'ACTIVE' })
      );

      const [campaign] = await client.getCampaigns('act_1');

      expect(campaign.status).toBe('ACTIVE');
      expect(campaign.effectiveStatus).toBe('ACTIVE');
    });

    it('MG-4: falls back effectiveStatus to status when effective_status is absent, and does not crash', async () => {
      const apiResp = makeCampaignApiResponse();
      // Remove effective_status to simulate absence
      delete (apiResp.data[0] as Record<string, unknown>).effective_status;
      mockGet.mockResolvedValue(apiResp);

      const [campaign] = await client.getCampaigns('act_1');

      expect(campaign.effectiveStatus).toBe('PAUSED');
      expect(campaign.status).toBe('PAUSED');
    });
  });

  describe('getAdSets()', () => {
    it('maps status and effectiveStatus as distinct fields for adsets', async () => {
      mockGet.mockResolvedValue(
        makeAdSetApiResponse({ status: 'ACTIVE', effective_status: 'LIMITED' })
      );

      const [adset] = await client.getAdSets('camp_1');

      expect(adset.status).toBe('ACTIVE');
      expect(adset.effectiveStatus).toBe('LIMITED');
      expect(adset.status).not.toBe(adset.effectiveStatus);
    });

    it('falls back effectiveStatus to status when effective_status is absent', async () => {
      const apiResp = makeAdSetApiResponse();
      delete (apiResp.data[0] as Record<string, unknown>).effective_status;
      mockGet.mockResolvedValue(apiResp);

      const [adset] = await client.getAdSets('camp_1');

      expect(adset.effectiveStatus).toBe('ACTIVE');
      expect(adset.status).toBe('ACTIVE');
    });
  });

  describe('getAds()', () => {
    it('maps status and effectiveStatus as distinct fields for ads', async () => {
      mockGet.mockResolvedValue(
        makeAdApiResponse({ status: 'ACTIVE', effective_status: 'ACTIVE' })
      );

      const [ad] = await client.getAds('adset_1');

      expect(ad.status).toBe('ACTIVE');
      expect(ad.effectiveStatus).toBe('ACTIVE');
    });
  });
});

// ---------------------------------------------------------------------------
// P1.4 — ACTIVE filter widening
// ---------------------------------------------------------------------------
describe('GraphClient ACTIVE filter widening (P1.4)', () => {
  let client: GraphClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet = vi.spyOn(MetaApiClient.prototype as unknown as { get: () => unknown }, 'get');
    mockPost = vi.spyOn(MetaApiClient.prototype as unknown as { post: () => unknown }, 'post');
    client = new GraphClient('dummy-token');
    // Return empty list — we only care about how params are built
    mockGet.mockResolvedValue({ data: [], paging: {} });
  });

  it('MG-3: getCampaigns with status=ACTIVE sends effective_status IN [ACTIVE,LIMITED,PENDING_BILLING_INFO]', async () => {
    await client.getCampaigns('act_1', 'ACTIVE');

    expect(mockGet).toHaveBeenCalledOnce();
    const [, params] = mockGet.mock.calls[0] as [string, Record<string, unknown>];
    const effectiveStatus = JSON.parse(params.effective_status as string) as string[];

    expect(effectiveStatus).toContain('ACTIVE');
    expect(effectiveStatus).toContain('LIMITED');
    expect(effectiveStatus).toContain('PENDING_BILLING_INFO');
  });

  it('getCampaigns with status=PAUSED sends effective_status=[PAUSED] (no widening)', async () => {
    await client.getCampaigns('act_1', 'PAUSED');

    const [, params] = mockGet.mock.calls[0] as [string, Record<string, unknown>];
    const effectiveStatus = JSON.parse(params.effective_status as string) as string[];

    expect(effectiveStatus).toEqual(['PAUSED']);
  });

  it('getAdSets with status=ACTIVE sends widened effective_status', async () => {
    await client.getAdSets('act_1', 'ACTIVE');

    const [, params] = mockGet.mock.calls[0] as [string, Record<string, unknown>];
    const effectiveStatus = JSON.parse(params.effective_status as string) as string[];

    expect(effectiveStatus).toContain('ACTIVE');
    expect(effectiveStatus).toContain('LIMITED');
    expect(effectiveStatus).toContain('PENDING_BILLING_INFO');
  });
});
