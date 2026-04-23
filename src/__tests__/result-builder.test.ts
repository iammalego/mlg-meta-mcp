/**
 * result-builder.ts — unit tests (P2.1)
 *
 * buildResult<T> must:
 * - Set structuredContent = data
 * - Set content[0].text = textRenderer(data)
 * - Propagate renderer errors
 */

import { describe, it, expect } from 'vitest';
import { buildResult } from '../tools/result-builder.js';

type SampleData = { count: number; items: string[] } & Record<string, unknown>;

describe('buildResult (P2.1)', () => {
  it('sets structuredContent equal to the data object', () => {
    const data: SampleData = { count: 2, items: ['a', 'b'] };
    const result = buildResult(data, () => 'rendered text');

    expect(result.structuredContent).toBe(data);
  });

  it('sets content[0].text to the textRenderer output', () => {
    const data: SampleData = { count: 1, items: ['x'] };
    const result = buildResult(data, (d) => `Count is ${d.count}`);

    const firstContent = result.content[0];
    expect(firstContent).toBeDefined();
    expect(firstContent.type).toBe('text');
    if (firstContent.type !== 'text') throw new Error('Expected text content');
    expect(firstContent.text).toBe('Count is 1');
  });

  it('content array has exactly one entry', () => {
    const data: SampleData = { count: 0, items: [] };
    const result = buildResult(data, () => 'empty');

    expect(result.content).toHaveLength(1);
  });

  it('propagates renderer errors (renderer throws → buildResult throws)', () => {
    const data: SampleData = { count: 0, items: [] };
    const badRenderer = () => {
      throw new Error('render failed');
    };

    expect(() => buildResult(data, badRenderer)).toThrow('render failed');
  });

  it('triangulation: different data produces different textRenderer output', () => {
    const data1: SampleData = { count: 3, items: ['a', 'b', 'c'] };
    const data2: SampleData = { count: 0, items: [] };
    const renderer = (d: SampleData) => `items: ${d.items.join(',')}`;

    const result1 = buildResult(data1, renderer);
    const result2 = buildResult(data2, renderer);

    const text1 = result1.content[0];
    const text2 = result2.content[0];
    if (text1.type !== 'text' || text2.type !== 'text') throw new Error('Expected text content');

    expect(text1.text).toBe('items: a,b,c');
    expect(text2.text).toBe('items: ');
  });
});
