/**
 * compact-integration.test.ts (P4.2/P4.3)
 *
 * Validates that structuredContent for large adset/campaign payloads
 * stays within size bounds for safe agent consumption.
 *
 * The MCP side doesn't apply jsleek (that's agent-side). What we test:
 * - JSON.stringify(structuredContent) for 15+ items is under 16000 chars
 *   (conservative ceiling; jsleek on agent side will compress further)
 * - Each item has the expected dual-status fields (regression guard)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type AdSetItem = {
  id: string;
  status: string;
  effectiveStatus: string;
  dailyBudgetCents: number | null;
};

type AdSetsFixture = {
  count: number;
  filter: { parentId: string; status: string };
  items: AdSetItem[];
};

type CampaignItem = {
  id: string;
  status: string;
  effectiveStatus: string;
  objective: string;
  dailyBudgetCents: number | null;
};

type CampaignsFixture = {
  count: number;
  filter: { accountId: string; status: string };
  items: CampaignItem[];
};

describe('structuredContent size + shape (P4.2)', () => {
  it('adsets fixture: JSON size under 16000 chars for 15 items', () => {
    const fixturePath = join(__dirname, 'fixtures/real/meta-getAdSets-structured.json');
    const raw = readFileSync(fixturePath, 'utf-8');
    const data = JSON.parse(raw) as AdSetsFixture;

    const json = JSON.stringify(data);

    expect(data.count).toBeGreaterThanOrEqual(10);
    expect(json.length).toBeLessThan(16000);
  });

  it('adsets fixture: all items have both status and effectiveStatus', () => {
    const fixturePath = join(__dirname, 'fixtures/real/meta-getAdSets-structured.json');
    const data = JSON.parse(readFileSync(fixturePath, 'utf-8')) as AdSetsFixture;

    for (const item of data.items) {
      expect(typeof item.status).toBe('string');
      expect(typeof item.effectiveStatus).toBe('string');
    }
  });

  it('campaigns fixture: JSON size under 12000 chars for 12 items', () => {
    const fixturePath = join(__dirname, 'fixtures/real/meta-getCampaigns-structured.json');
    const raw = readFileSync(fixturePath, 'utf-8');
    const data = JSON.parse(raw) as CampaignsFixture;

    const json = JSON.stringify(data);

    expect(data.count).toBeGreaterThanOrEqual(10);
    expect(json.length).toBeLessThan(12000);
  });

  it('campaigns fixture: dailyBudgetCents is a number or null (not a string)', () => {
    const fixturePath = join(__dirname, 'fixtures/real/meta-getCampaigns-structured.json');
    const data = JSON.parse(readFileSync(fixturePath, 'utf-8')) as CampaignsFixture;

    for (const item of data.items) {
      // Must be a number (integer) or null — never a string like "$5.00"
      const isValid = item.dailyBudgetCents === null || typeof item.dailyBudgetCents === 'number';
      expect(isValid).toBe(true);
    }
  });
});
