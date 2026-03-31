import { describe, it, expect, beforeAll } from 'vitest';
import { initializeHandlers, handleToolCall } from '../tools/handlers.js';

// Integration tests - require real META_SYSTEM_USER_TOKEN
const token = process.env.META_SYSTEM_USER_TOKEN;

describe('Tool Handlers Integration', () => {
  beforeAll(() => {
    if (token) {
      initializeHandlers(token);
    }
  });

  describe('discoverAdAccounts', () => {
    it.skipIf(!token)('should discover accounts with real token', async () => {
      const result = await handleToolCall('discoverAdAccounts', {});

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = result.content[0].text;
      expect(text).toContain('Available Ad Accounts');
    });

    it('should return error without token', async () => {
      if (token) return;

      const result = await handleToolCall('discoverAdAccounts', {});
      expect(result.isError).toBe(true);
    });
  });

  describe('getCampaigns', () => {
    it.skipIf(!token)('should get campaigns for first account', async () => {
      const accountsResult = await handleToolCall('discoverAdAccounts', {});
      if (accountsResult.isError) return;

      const text = accountsResult.content[0].text;
      const match = text.match(/ID: (act_\d+)/);
      if (!match) return;

      const accountId = match[1];

      const result = await handleToolCall('getCampaigns', { accountId });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Campaigns');
    });

    it('should validate required parameter', async () => {
      const result = await handleToolCall('getCampaigns', {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('[VALIDATION]');
    });
  });

  describe('pauseCampaign and activateCampaign', () => {
    it.skipIf(!token)('should pause and reactivate a campaign', async () => {
      const accountsResult = await handleToolCall('discoverAdAccounts', {});
      if (accountsResult.isError) return;

      const match = accountsResult.content[0].text.match(/ID: (act_\d+)/);
      if (!match) return;

      const campaignsResult = await handleToolCall('getCampaigns', {
        accountId: match[1],
        status: 'ACTIVE',
      });

      if (campaignsResult.isError) return;

      const campaignMatch = campaignsResult.content[0].text.match(/ID: (\d+)/);
      if (!campaignMatch) return;

      const campaignId = campaignMatch[1];

      const pauseResult = await handleToolCall('pauseCampaign', { campaignId });
      expect(pauseResult.isError).toBeFalsy();
      expect(pauseResult.content[0].text).toContain('paused');

      const activateResult = await handleToolCall('activateCampaign', { campaignId });
      expect(activateResult.isError).toBeFalsy();
      expect(activateResult.content[0].text).toContain('activated');
    });
  });

  describe('getInsights', () => {
    it.skipIf(!token)('should get insights for account', async () => {
      const accountsResult = await handleToolCall('discoverAdAccounts', {});
      if (accountsResult.isError) return;

      const match = accountsResult.content[0].text.match(/ID: (act_\d+)/);
      if (!match) return;

      const accountId = match[1];

      const result = await handleToolCall('getInsights', {
        objectId: accountId,
        level: 'account',
        datePreset: 'yesterday',
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Spend');
      expect(result.content[0].text).toContain('Results');
    });

    it('should validate required parameters', async () => {
      const result = await handleToolCall('getInsights', {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('[VALIDATION]');
    });
  });
});
