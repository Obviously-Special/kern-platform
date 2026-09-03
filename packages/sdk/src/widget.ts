import type { ChatMessage, ChatResponse, GuideTarget } from '@kern/contracts';
import { capturePageContext, getElementByRef } from './context';
import { formatMarkdown } from './format';
import { postChat, postEvent, type KernApiConfig } from './api';

/**
 * The customer-facing chat widget.
 *
 * Rendered inside a shadow root so host-page CSS can never break or
 * restyle it. Quiet by default (doc 2: "calm and inevitable, not a noisy
 * AI demo") — a launcher button, a compact panel, nothing else.
 */

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; padding: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }

.launcher {
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
  width: 52px; height: 52px; border-radius: 50%;
  background: #111111; color: #ffffff; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(17,17,17,0.25);
  transition: transform 140ms ease;
}
.launcher:hover { transform: scale(1.05); }
.launcher svg { width: 24px; height: 24px; }

.panel {
  position: fixed; right: 20px; bottom: 84px; z-index: 2147483000;
  width: 380px; max-width: calc(100vw - 40px); height: 520px; max-height: calc(100vh - 120px);
  display: flex; flex-direction: column;
  background: #ffffff; border: 1px solid #D9D6CF; border-radius: 16px;
  box-shadow: 0 12px 40px rgba(17,17,17,0.16);
  overflow: hidden;
}

.header {
  padding: 14px 16px; border-bottom: 1px solid #F1EFE9;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
.header .title { font-size: 14px; font-weight: 650; color: #111111; }
.header .page { font-size: 11px; color: #8A8577; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.close { background: none; border: none; cursor: pointer; color: #8A8577; font-size: 16px; line-height: 1; padding: 4px; }

.messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.msg { max-width: 85%; padding: 10px 12px; border-radius: 12px; font-size: 13.5px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
.msg.user { align-self: flex-end; background: #111111; color: #ffffff; border-bottom-right-radius: 4px; }
.msg.assistant { align-self: flex-start; background: #F6F4EF; color: #111111; border-bottom-left-radius: 4px; }
.sources { align-self: flex-start; font-size: 11px; color: #8A8577; padding: 0 12px 4px; margin-top: -6px; }
.msg.assistant strong { font-weight: 700; }
.msg.assistant em { font-style: italic; }
.msg.assistant code { font-family: ui-monospace, monospace; font-size: 12.5px; background: rgba(17,17,17,0.06); padding: 1px 4px; border-radius: 4px; }
.msg.assistant a { color: #4B7EFF; text-decoration: underline; }
.typing { align-self: flex-start; color: #8A8577; font-size: 12.5px; padding: 4px 12px; }

.inputrow { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #F1EFE9; }
.inputrow input {
  flex: 1; border: 1px solid #D9D6CF; border-radius: 10px; padding: 10px 12px;
  font-size: 13.5px; outline: none; color: #111111;
}
.inputrow input:focus { border-color: #111111; }
.send {
  background: #C0FF43; color: #111111; border: none; border-radius: 10px;
  padding: 0 16px; font-weight: 650; font-size: 13.5px; cursor: pointer;
}
.send:disabled { opacity: 0.5; cursor: default; }

/* Guide pulse: expanding rings draw the eye to the target element */
@keyframes kern-pulse {
  0% { transform: scale(1); opacity: 0.9; }
  100% { transform: scale(1.8); opacity: 0; }
}
`;

export class KernWidget {
  private root: ShadowRoot;
  private host: HTMLDivElement;
  private panelEl: HTMLDivElement;
  private messagesEl: HTMLDivElement;
  private inputEl: HTMLInputElement;
  private sendBtn: HTMLButtonElement;
  private pageEl: HTMLSpanElement;
  private history: ChatMessage[] = [];
  private busy = false;

  constructor(private config: KernApiConfig) {
    this.host = document.createElement('div');
    this.host.style.cssText = 'all: initial;';
    (document.body || document.documentElement).appendChild(this.host);
    this.root = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    this.root.appendChild(style);

    // Launcher
    const launcher = document.createElement('button');
    launcher.className = 'launcher';
    launcher.setAttribute('aria-label', 'Open assistant');
    launcher.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
    launcher.addEventListener('click', () => this.toggle(true));

    // Panel
    this.panelEl = document.createElement('div');
    this.panelEl.className = 'panel';
    this.panelEl.style.display = 'none';

    const header = document.createElement('div');
    header.className = 'header';
    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = 'Assistant';
    this.pageEl = document.createElement('div');
    this.pageEl.className = 'page';
    titleWrap.append(title, this.pageEl);
    const close = document.createElement('button');
    close.className = 'close';
    close.setAttribute('aria-label', 'Close assistant');
    close.textContent = '✕';
    close.addEventListener('click', () => this.toggle(false));
    header.append(titleWrap, close);

    this.messagesEl = document.createElement('div');
    this.messagesEl.className = 'messages';

    const inputrow = document.createElement('div');
    inputrow.className = 'inputrow';
    this.inputEl = document.createElement('input');
    this.inputEl.type = 'text';
    this.inputEl.placeholder = 'Ask about anything on this page…';
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.busy) void this.send();
    });
    this.sendBtn = document.createElement('button');
    this.sendBtn.className = 'send';
    this.sendBtn.textContent = 'Send';
    this.sendBtn.addEventListener('click', () => void this.send());
    inputrow.append(this.inputEl, this.sendBtn);

    this.panelEl.append(header, this.messagesEl, inputrow);
    this.root.append(launcher, this.panelEl);
  }

  destroy() {
    this.host.remove();
  }

  private toggle(open: boolean) {
    this.panelEl.style.display = open ? 'flex' : 'none';
    if (open) {
      this.refreshPageLabel();
      this.inputEl.focus();
    }
  }

  refreshPageLabel() {
    const ctx = capturePageContext();
    this.pageEl.textContent = `You're on: ${ctx.page_type === 'unknown' ? 'this page' : ctx.page_type}`;
  }

  private addMessage(role: 'user' | 'assistant', content: string, citations?: string[]) {
    const el = document.createElement('div');
    el.className = `msg ${role}`;
    // Assistant replies render a safe markdown subset (**bold** etc.);
    // user messages stay plain text. HTML is escaped before transforms.
    if (role === 'assistant') {
      el.innerHTML = formatMarkdown(content);
    } else {
      el.textContent = content;
    }
    this.messagesEl.appendChild(el);
    if (citations && citations.length > 0) {
      const sources = document.createElement('div');
      sources.className = 'sources';
      sources.textContent = `Sources: ${citations.join(' · ')}`;
      this.messagesEl.appendChild(sources);
    }
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  /**
   * Guide mode: highlight the target element in the host page with the
   * signal-green outline and scroll it into view (doc 2 §3: "visual focus
   * on target"). Resolves by element id first, then by the SDK's
   * kern-el-N registry — works even when the site provides no ids.
   */
  private guideTo(guide: GuideTarget) {
    const el =
      (guide.element_id ? document.getElementById(guide.element_id) : null) ??
      (guide.element_ref ? getElementByRef(guide.element_ref) : null);
    if (!el) return;
    const target = guide.element_id ?? guide.element_ref ?? '';
    postEvent(this.config, { type: 'guide_started', data: { target_element_id: target } });
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Outline holds the element while the pulse rings draw the eye
    const previous = el.style.outline;
    el.style.outline = '3px solid #C0FF43';
    el.style.outlineOffset = '2px';
    el.style.borderRadius = el.style.borderRadius || '4px';

    // Expanding rings — three staggered pulses over the target's rect
    const rect = el.getBoundingClientRect();
    const fx = document.createElement('div');
    fx.style.cssText = `position: fixed; z-index: 2147483001; pointer-events: none; left: ${rect.left}px; top: ${rect.top}px; width: ${rect.width}px; height: ${rect.height}px;`;
    for (let i = 0; i < 3; i++) {
      const ring = document.createElement('div');
      ring.style.cssText = `position: absolute; inset: 0; border: 3px solid #C0FF43; border-radius: 8px; opacity: 0; animation: kern-pulse 1s ease-out ${i * 0.65}s forwards;`;
      fx.appendChild(ring);
    }
    this.root.appendChild(fx);

    window.setTimeout(() => {
      fx.remove();
      el.style.outline = previous;
      postEvent(this.config, { type: 'guide_completed', data: { target_element_id: target } });
    }, 3200);
  }

  private async send() {
    const text = this.inputEl.value.trim();
    if (!text || this.busy) return;
    this.inputEl.value = '';
    this.addMessage('user', text);
    this.history.push({ role: 'user', content: text });

    this.busy = true;
    this.sendBtn.disabled = true;
    const typing = document.createElement('div');
    typing.className = 'typing';
    typing.textContent = '…';
    this.messagesEl.appendChild(typing);

    const started = Date.now();
    postEvent(this.config, {
      type: 'question_asked',
      data: { message: text },
    });

    try {
      // Fresh page context at send time — includes any errors now visible
      const pageContext = capturePageContext();
      const res: ChatResponse = await postChat(this.config, text, this.history.slice(0, -1), pageContext);
      typing.remove();
      this.addMessage('assistant', res.reply, res.citations);
      if (res.guide) this.guideTo(res.guide);
      this.history.push({ role: 'assistant', content: res.reply });
      postEvent(this.config, {
        type: 'answer_shown',
        data: { message_id: res.message_id, mode: res.mode, latency_ms: Date.now() - started },
      });
    } catch {
      typing.remove();
      const fallback = "I can't reach the assistant right now. Please try again in a moment.";
      this.addMessage('assistant', fallback);
      this.history.push({ role: 'assistant', content: fallback });
    } finally {
      this.busy = false;
      this.sendBtn.disabled = false;
      this.inputEl.focus();
    }
  }
}
