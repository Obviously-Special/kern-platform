// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { capturePageContext, getElementByRef } from '../src/context';

describe('capturePageContext — element refs for guide mode', () => {
  beforeAll(() => {
    // jsdom has no layout: offsetParent is always null, so the SDK's
    // visibility check would treat everything as hidden. Stub it so
    // attached elements count as visible in tests.
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      get() {
        return this.parentElement;
      },
    });
  });

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('assigns kern-el-N refs to captured elements without ids and keeps a resolvable registry', () => {
    document.body.innerHTML = `
      <nav><a href="/pricing">Pricing</a><a href="/account">Account</a></nav>`;
    const ctx = capturePageContext();

    expect(ctx.elements).toHaveLength(2);
    expect(ctx.elements[0]).toMatchObject({ ref: 'kern-el-0', label: 'Pricing', href: '/pricing' });
    expect(ctx.elements[1]).toMatchObject({ ref: 'kern-el-1', label: 'Account' });

    // The registry resolves refs back to the LIVE nodes (widget highlight)
    const node = getElementByRef('kern-el-0');
    expect(node?.textContent).toBe('Pricing');
  });

  it('keeps real element ids alongside refs when the site provides them', () => {
    document.body.innerHTML = `<button id="booking-continue">Continue</button>`;
    const ctx = capturePageContext();
    expect(ctx.elements[0]).toMatchObject({ id: 'booking-continue', ref: 'kern-el-0' });
  });

  it('reads labels from wrapping <label> elements — inputs are no longer anonymous', () => {
    document.body.innerHTML = `
      <label><input type="radio" name="exp"> Intro to Rock Climbing</label>
      <label><input type="radio" name="exp"> Tandem Paragliding</label>`;
    const ctx = capturePageContext();
    expect(ctx.elements[0]?.label).toBe('Intro to Rock Climbing');
    expect(ctx.elements[1]?.label).toBe('Tandem Paragliding');
  });

  it('prefers aria-label and falls back to placeholder', () => {
    document.body.innerHTML = `
      <label for="email">Email address</label>
      <input id="email" aria-label="Your email" />
      <input placeholder="Search tours" />`;
    const ctx = capturePageContext();
    expect(ctx.elements[0]?.label).toBe('Your email');
    expect(ctx.elements[1]?.label).toBe('Search tours');
  });

  it('captures the page description from visible paragraphs', () => {
    document.body.innerHTML = `<main><p>First paragraph of text.</p><p>Second paragraph.</p></main>`;
    const ctx = capturePageContext();
    expect(ctx.visible_text.description).toBe('First paragraph of text. Second paragraph.');
  });
});
