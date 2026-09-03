import type { ActionResultReport, ProposedAction } from '@kern/contracts';
import { getElementByRef } from './context';

/**
 * Browser tool runners (executor: 'browser'). Each performs the action,
 * VERIFIES the outcome (doc 3: "never assume a click succeeded") and
 * returns an explainable result with evidence.
 */
export type ExecutedAction = ActionResultReport;

function resolveElement(ref: string): HTMLElement | null {
  return document.getElementById(ref) ?? getElementByRef(ref);
}

/** React-compatible value setting: native setter + real input/change events. */
function setFieldValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function executeBrowserAction(action: ProposedAction, sessionId: string): ExecutedAction {
  const base = { action_id: action.action_id, session_id: sessionId };

  if (action.tool === 'fill_field') {
    const ref = String(action.args.ref);
    const value = String(action.args.value);
    const el = resolveElement(ref);
    if (!el) return { ...base, result: 'failed', error: 'element not found' };
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
      return { ...base, result: 'failed', error: 'element is not an input field' };
    }
    if (el.type === 'password') {
      return { ...base, result: 'failed', error: 'refusing to fill a password field' };
    }
    setFieldValue(el, value);
    const verified = el.value === value;
    return {
      ...base,
      result: verified ? 'succeeded' : 'failed',
      evidence: `field value is now "${el.value}"`,
    };
  }

  if (action.tool === 'select_option') {
    const ref = String(action.args.ref);
    const el = resolveElement(ref);
    if (!el) return { ...base, result: 'failed', error: 'element not found' };
    if (!(el instanceof HTMLInputElement) || !['radio', 'checkbox'].includes(el.type)) {
      return { ...base, result: 'failed', error: 'element is not a selectable option' };
    }
    el.click();
    const verified = el.checked === true;
    return { ...base, result: verified ? 'succeeded' : 'failed', evidence: `option checked: ${el.checked}` };
  }

  if (action.tool === 'click_element') {
    const ref = String(action.args.ref);
    const el = resolveElement(ref);
    if (!el) return { ...base, result: 'failed', error: 'element not found' };
    el.click();
    return { ...base, result: 'succeeded', evidence: `clicked "${(el as HTMLElement).innerText?.slice(0, 60) || el.id || ref}"` };
  }

  return { ...base, result: 'failed', error: `unknown browser tool: ${action.tool}` };
}
