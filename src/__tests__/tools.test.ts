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
        currentPeriod: { datePreset: 'last_7d' },
        previousPeriod: { datePreset: 'last_month' },
      })
    ).toThrow(MetaMcpError);
  });

  it('normalizes compareTwoPeriods period selectors, metrics, and default result mode', () => {
    const result = parseToolArgs('compareTwoPeriods', {
      objectId: '123',
      level: 'campaign',
      currentPeriod: 'last_7d',
      previousPeriod: {
        timeRange: {
          since: '2026-02-01',
          until: '2026-02-29',
        },
      },
      metrics: 'ctr',
    });

    expect(result).toEqual({
      objectId: '123',
      level: 'campaign',
      currentPeriod: {
        datePreset: 'last_7d',
      },
      previousPeriod: {
        timeRange: {
          since: '2026-02-01',
          until: '2026-02-29',
        },
      },
      metrics: ['ctr'],
      resultMode: 'primary_from_insights',
    });
  });

  it('applies default compareTwoPeriods metrics when omitted', () => {
    const result = parseToolArgs('compareTwoPeriods', {
      objectId: '123',
      level: 'campaign',
      currentPeriod: { datePreset: 'last_7d' },
      previousPeriod: { datePreset: 'last_month' },
    });

    expect(result).toEqual({
      objectId: '123',
      level: 'campaign',
      currentPeriod: { datePreset: 'last_7d' },
      previousPeriod: { datePreset: 'last_month' },
      metrics: ['spend', 'results', 'cpr'],
      resultMode: 'primary_from_insights',
    });
  });

  it('infers specific_action when resultActionType is provided', () => {
    const result = parseToolArgs('compareTwoPeriods', {
      objectId: '123',
      level: 'campaign',
      currentPeriod: { datePreset: 'last_7d' },
      previousPeriod: { datePreset: 'last_month' },
      resultActionType: 'lead',
    });

    expect(result).toEqual({
      objectId: '123',
      level: 'campaign',
      currentPeriod: { datePreset: 'last_7d' },
      previousPeriod: { datePreset: 'last_month' },
      metrics: ['spend', 'results', 'cpr'],
      resultMode: 'specific_action',
      resultActionType: 'lead',
    });
  });

  it('rejects compareTwoPeriods periods that mix datePreset and timeRange', () => {
    expect(() =>
      parseToolArgs('compareTwoPeriods', {
        objectId: '123',
        level: 'campaign',
        currentPeriod: {
          datePreset: 'last_7d',
          timeRange: {
            since: '2026-03-01',
            until: '2026-03-07',
          },
        },
        previousPeriod: { datePreset: 'last_month' },
      })
    ).toThrow(MetaMcpError);
  });

  it('rejects resultActionType when resultMode is not specific_action', () => {
    expect(() =>
      parseToolArgs('compareTwoPeriods', {
        objectId: '123',
        level: 'campaign',
        currentPeriod: { datePreset: 'last_7d' },
        previousPeriod: { datePreset: 'last_month' },
        resultMode: 'all_actions',
        resultActionType: 'lead',
      })
    ).toThrow(MetaMcpError);
  });

  it('rejects empty compareTwoPeriods metrics arrays', () => {
    expect(() =>
      parseToolArgs('compareTwoPeriods', {
        objectId: '123',
        level: 'campaign',
        currentPeriod: { datePreset: 'last_7d' },
        previousPeriod: { datePreset: 'last_month' },
        metrics: [],
      })
    ).toThrow(MetaMcpError);
  });

  it('enforces conditional requirements for getAdSets', () => {
    expect(() => parseToolArgs('getAdSets', {})).toThrow(MetaMcpError);
  });
});
