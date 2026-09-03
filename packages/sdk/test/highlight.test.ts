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

  it('appends the pulse rings INSIDE the target element (they travel with it during scroll)', () => {
    const el = document.getElementById('target')!;
    pulseElement(el);

    const fx = el.querySelector('div');
    expect(fx).not.toBeNull();
    expect(fx!.children.length).toBe(3); // three staggered rings
    expect(fx!.style.position).toBe('absolute');
    expect(el.style.position).toBe('relative'); // anchor for the absolute rings
  });

  it('injects the namespaced keyframes into the HOST document once', () => {
    const el = document.getElementById('target')!;
    pulseElement(el);
    pulseElement(el);
    expect(document.querySelectorAll('#kernsdk-pulse-style')).toHaveLength(1);
  });

  it('cleans up: removes rings and restores the element position', () => {
    const el = document.getElementById('target')!;
    pulseElement(el);
    vi.advanceTimersByTime(3300);
    expect(el.querySelector('div')).toBeNull();
    expect(el.style.position).toBe('');
  });
});
