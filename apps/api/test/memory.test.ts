import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractMemories, recall, remember } from '../src/memory';

describe('extractMemories — directives never leak into the visible reply', () => {
  it('collects and strips REMEMBER directives', () => {
    const { reply, facts } = extractMemories(
      'The Eiger hike is CHF 89 per person.\n<<REMEMBER:guest is booking the Eiger hike for 2>>',
    );
    expect(reply).toBe('The Eiger hike is CHF 89 per person.');
    expect(facts).toEqual(['guest is booking the Eiger hike for 2']);
  });

  it('collects multiple directives and ignores empty ones', () => {
    const { facts } = extractMemories('A\n<<REMEMBER:one>>\n<<REMEMBER:two>>\n<<REMEMBER:   >>');
    expect(facts).toEqual(['one', 'two']);
  });

  it('leaves replies without directives untouched', () => {
    const { reply, facts } = extractMemories('Plain answer.');
    expect(reply).toBe('Plain answer.');
    expect(facts).toEqual([]);
  });
});

describe('remember / recall — per-session facts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and recalls facts per session, deduplicated', () => {
    remember('s1', ['guest chose the Eiger hike']);
    remember('s1', ['guest chose the Eiger hike', 'group size 2']);
    expect(recall('s1')).toEqual(['guest chose the Eiger hike', 'group size 2']);
    expect(recall('s2')).toEqual([]); // strict session isolation
  });

  it('caps facts at 10', () => {
    remember('s1', Array.from({ length: 15 }, (_, i) => `fact ${i}`));
    expect(recall('s1')).toHaveLength(10);
  });

  it('expires after the 30-minute TTL', () => {
    remember('s1', ['fact']);
    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(recall('s1')).toEqual([]);
  });
});
