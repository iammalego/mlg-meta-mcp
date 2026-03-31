import { describe, expect, it } from 'vitest';
import { parseToolArgs } from '../tools/index.js';
import { MetaMcpError } from '../utils/errors.js';

describe('parseToolArgs', () => {
  it('applies defaults for getCampaigns', () => {
    const result = parseToolArgs('getCampaigns', { accountId: 'act_123' });

    expect(result).toEqual({
      accountId: 'act_123',
      status: 'ALL',
    });
  });

  it('rejects invalid enums for compareTwoPeriods', () => {
    expect(() =>
      parseToolArgs('compareTwoPeriods', {
        objectId: '123',
        level: 'creative',
        currentPeriod: 'last_7d',
        previousPeriod: 'last_month',
      })
    ).toThrow(MetaMcpError);
  });

  it('enforces conditional requirements for getAdSets', () => {
    expect(() => parseToolArgs('getAdSets', {})).toThrow(MetaMcpError);
  });
});
