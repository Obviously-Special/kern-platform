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
});
