// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pulseElement } from '../src/highlight';

describe('pulseElement — the guide pulse', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `<button id="target">Continue</button>`;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders three staggered rings in a body-level overlay (never inside the target — inputs reject children)', () => {
    const el = document.getElementById('target')!;
    pulseElement(el);

    expect(el.querySelector('div')).toBeNull(); // target untouched
    const fx = document.body.querySelector('div');
    expect(fx).not.toBeNull();
    expect(fx!.children.length).toBe(3);
    expect(fx!.style.position).toBe('fixed');
  });

  it('works for void elements like <input>', () => {
    document.body.innerHTML = `<input type="radio" id="radio">`;
    const el = document.getElementById('radio')!;
    expect(() => pulseElement(el)).not.toThrow();
    expect(document.body.querySelectorAll('div').length).toBeGreaterThan(0);
  });

  it('injects the namespaced keyframes into the HOST document once', () => {
    const el = document.getElementById('target')!;
    pulseElement(el);
    pulseElement(el);
    expect(document.querySelectorAll('#kernsdk-pulse-style')).toHaveLength(1);
  });

  it('cleans up after the duration: overlay removed, rAF cancelled', () => {
    const el = document.getElementById('target')!;
    const cleanup = pulseElement(el, 3200);
    vi.advanceTimersByTime(3300);
    expect(document.body.querySelector('div')).toBeNull();
    // cleanup stays idempotent
    expect(() => cleanup()).not.toThrow();
  });
});
