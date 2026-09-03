// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observePage } from '../src/observer';

describe('observePage — event-driven SPA observation (doc 3 §5.3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits route changes on pushState and popstate', () => {
    const events: string[] = [];
    const stop = observePage((change) => events.push(change));

    window.history.pushState({}, '', '/pricing');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(events).toEqual(['route', 'route']);
    stop();
  });

  it('emits a debounced dom change on DOM mutations', async () => {
    const events: string[] = [];
    const stop = observePage((change) => events.push(change));

    const el = document.createElement('div');
    document.body.appendChild(el);
    el.textContent = 'new content'; // second mutation inside the debounce window
    expect(events).toEqual([]);

    // MutationObserver delivery needs microtask flushes between timers
    await vi.advanceTimersByTimeAsync(350);
    expect(events).toEqual(['dom']);
    stop();
  });

  it('ignores mutations inside the KERN widget host but still catches real page changes', async () => {
    // The real SDK mounts the widget host BEFORE observation starts —
    // mirror that order so host insertion itself isn't counted as a change
    const host = document.createElement('div');
    host.setAttribute('data-kern-sdk', '');
    document.body.appendChild(host);

    const events: string[] = [];
    const stop = observePage((change) => events.push(change));

    // Real page content — proves the observer is live
    const content = document.createElement('div');
    document.body.appendChild(content);
    await vi.advanceTimersByTimeAsync(350);
    expect(events).toEqual(['dom']);
    events.length = 0;

    // Widget chatter must not register as page change
    host.textContent = 'widget chatter';
    await vi.advanceTimersByTimeAsync(350);
    expect(events).toEqual([]);
    stop();
  });

  it('cleanup restores the history API and stops observing', async () => {
    const events: string[] = [];
    const stop = observePage((change) => events.push(change));
    stop();

    window.history.pushState({}, '', '/services');
    const el = document.createElement('div');
    document.body.appendChild(el);
    await vi.advanceTimersByTimeAsync(350);

    expect(events).toEqual([]);
  });
});
