// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProposedAction } from '@kern/contracts';
import { executeBrowserAction } from '../src/actions';

function action(tool: string, args: Record<string, unknown>): ProposedAction {
  return {
    action_id: 'a1',
    tool,
    label: tool,
    permission_level: 'reversible',
    decision: 'confirmation_required',
    args,
  };
}

describe('executeBrowserAction — controlled actions with verification (doc 3 §10)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      get() {
        return this.parentElement;
      },
    });
  });

  it('fills an input React-compatibly (native setter + events) and verifies the value', async () => {
    document.body.innerHTML = `<input id="name" />`;
    // Register the element in the ref registry via a capture
    const { capturePageContext } = await import('../src/context');
    capturePageContext();

    const report = executeBrowserAction(action('fill_field', { ref: 'kern-el-0', value: 'Max' }), 's1');
    const el = document.getElementById('name') as HTMLInputElement;
    expect(el.value).toBe('Max');
    expect(report.result).toBe('succeeded');
    expect(report.evidence).toContain('Max');
  });

  it('refuses to fill password fields', () => {
    document.body.innerHTML = `<input id="pw" type="password" />`;
    const report = executeBrowserAction(action('fill_field', { ref: 'pw', value: 'secret' }), 's1');
    expect(report.result).toBe('failed');
    expect(report.error).toContain('password');
  });

  it('selects a radio option and verifies checked state', () => {
    document.body.innerHTML = `<input id="opt" type="radio" />`;
    const report = executeBrowserAction(action('select_option', { ref: 'opt' }), 's1');
    expect((document.getElementById('opt') as HTMLInputElement).checked).toBe(true);
    expect(report.result).toBe('succeeded');
  });

  it('clicks an element and reports evidence', () => {
    const clicked = vi.fn();
    document.body.innerHTML = `<button id="go">Go</button>`;
    document.getElementById('go')!.addEventListener('click', clicked);
    const report = executeBrowserAction(action('click_element', { ref: 'go' }), 's1');
    expect(clicked).toHaveBeenCalled();
    expect(report.result).toBe('succeeded');
  });

  it('fails gracefully on missing elements', () => {
    const report = executeBrowserAction(action('click_element', { ref: 'nothing' }), 's1');
    expect(report.result).toBe('failed');
    expect(report.error).toBe('element not found');
  });
});
