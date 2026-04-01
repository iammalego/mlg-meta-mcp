export const compareTwoPeriodsSupportedMetrics = [
  'spend',
  'results',
  'cpr',
  'impressions',
  'clicks',
  'ctr',
] as const;

export type CompareTwoPeriodsMetric = (typeof compareTwoPeriodsSupportedMetrics)[number];

export const defaultCompareTwoPeriodsMetrics = [
  'spend',
  'results',
  'cpr',
] as const satisfies readonly CompareTwoPeriodsMetric[];

export type CompareTwoPeriodsMetricUnit = 'currency_cents' | 'count' | 'percentage';

export const compareTwoPeriodsMetricMetadata: Record<
  CompareTwoPeriodsMetric,
  { label: string; unit: CompareTwoPeriodsMetricUnit }
> = {
  spend: { label: 'Spend', unit: 'currency_cents' },
  results: { label: 'Results', unit: 'count' },
  cpr: { label: 'CPR', unit: 'currency_cents' },
  impressions: { label: 'Impressions', unit: 'count' },
  clicks: { label: 'Clicks', unit: 'count' },
  ctr: { label: 'CTR', unit: 'percentage' },
};

export function normalizeCompareTwoPeriodsMetrics(
  metrics?: readonly CompareTwoPeriodsMetric[]
): CompareTwoPeriodsMetric[] {
  if (!metrics || metrics.length === 0) {
    return [...defaultCompareTwoPeriodsMetrics];
  }

  return [...new Set(metrics)];
}

export function compareTwoPeriodsIncludesResultMetrics(
  metrics: readonly CompareTwoPeriodsMetric[]
): boolean {
  return metrics.includes('results') || metrics.includes('cpr');
}
