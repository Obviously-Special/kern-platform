import { describe, expect, it } from 'vitest';
import { hashState, inferPageType } from '../src/context';

describe('inferPageType — generic URL-pattern page classifier', () => {
  it('classifies the home route', () => {
    expect(inferPageType('/')).toBe('home');
  });

  it('classifies booking routes', () => {
    expect(inferPageType('/booking')).toBe('booking');
    expect(inferPageType('/booking/step-2')).toBe('booking');
    expect(inferPageType('/reserve')).toBe('booking');
  });

  it('classifies checkout and cart before other patterns', () => {
    expect(inferPageType('/checkout/payment')).toBe('checkout');
  });

  it('classifies pricing, account, help, search, product', () => {
    expect(inferPageType('/pricing')).toBe('pricing');
    expect(inferPageType('/account/settings')).toBe('account');
    expect(inferPageType('/help')).toBe('help');
    expect(inferPageType('/search?q=tour')).toBe('search');
    expect(inferPageType('/services')).toBe('product');
  });

  it('falls back to other for unknown routes', () => {
    expect(inferPageType('/some/random/path')).toBe('other');
  });
});

describe('hashState — stable change detection', () => {
  it('produces the same hash for the same input', () => {
    expect(hashState(['a', 'b'])).toBe(hashState(['a', 'b']));
  });

  it('produces a different hash when any part changes', () => {
    expect(hashState(['a', 'b'])).not.toBe(hashState(['a', 'c']));
  });

  it('is order-sensitive', () => {
    expect(hashState(['a', 'b'])).not.toBe(hashState(['b', 'a']));
  });
});
