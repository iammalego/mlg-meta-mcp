import { describe, it, expect } from 'vitest';
import { getAllTools, parseToolArgs } from '../tools/index.js';
import { MetaMcpError } from '../utils/errors.js';
import { ErrorCategory } from '../utils/errors.js';

describe('Tool Registry', () => {
  it('exposes the expected set of tools', () => {
    const tools = getAllTools();
    const names = tools.map((t) => t.name);

    // Verify ad creation is not in the public tool surface (pending implementation).
    expect(names).not.toContain('createAd');

    // Verify the core tools are present.
    expect(names).toContain('discoverAdAccounts');
    expect(names).toContain('getCampaigns');
    expect(names).toContain('getAds');
    expect(names).toContain('getInsights');
    expect(names).toContain('compareTwoPeriods');
    expect(names).toContain('cloneCampaign');
    expect(names).toContain('cloneAdSet');
  });

  it('clone tool schemas do not include copyAds', () => {
    const tools = getAllTools();
    const cloneCampaign = tools.find((t) => t.name === 'cloneCampaign');
    const cloneAdSet = tools.find((t) => t.name === 'cloneAdSet');

    const cloneCampaignProps = (cloneCampaign?.inputSchema as { properties?: Record<string, unknown> })?.properties ?? {};
    const cloneAdSetProps = (cloneAdSet?.inputSchema as { properties?: Record<string, unknown> })?.properties ?? {};

    expect(cloneCampaignProps).not.toHaveProperty('copyAds');
    expect(cloneAdSetProps).not.toHaveProperty('copyAds');
  });

  it('rejects unknown tools', () => {
    expect(() => parseToolArgs('nonExistentTool', {})).toThrow(MetaMcpError);
  });

  it('rejects invalid arguments with a VALIDATION error', () => {
    try {
      parseToolArgs('getCampaigns', {});
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(MetaMcpError);
      expect((e as MetaMcpError).category).toBe(ErrorCategory.VALIDATION);
    }
  });
});
