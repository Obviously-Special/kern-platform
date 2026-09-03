/**
 * Guide pulse — the eye-catching highlight for guide targets.
 *
 * The rings float in a fixed-position overlay and TRACK the target's
 * bounding rect every animation frame, so they follow it during smooth
 * scrolling. (They cannot live inside the target: void elements like
 * <input> and <textarea> reject children, and shadow-root styles don't
 * apply to host-page nodes.)
 *
 * Keyframes are injected once into the HOST document under a namespaced
 * name so the light-DOM overlay can use them.
 */
const KEYFRAMES_ID = 'kernsdk-pulse-style';
const KEYFRAMES = '@keyframes kernsdk-pulse { 0% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(1.8); opacity: 0; } }';

function ensureKeyframes(doc: Document): void {
  if (doc.getElementById(KEYFRAMES_ID)) return;
  const style = doc.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = KEYFRAMES;
  doc.head.appendChild(style);
}

/**
 * Starts the three-ring pulse on an element and returns a cleanup
 * function. Safe for every element type — nothing is ever appended to
 * the target itself.
 */
export function pulseElement(el: HTMLElement, durationMs = 3200): () => void {
  const doc = el.ownerDocument;
  ensureKeyframes(doc);

  const fx = doc.createElement('div');
  fx.style.cssText = 'position: fixed; z-index: 2147483001; pointer-events: none;';
  for (let i = 0; i < 3; i++) {
    const ring = doc.createElement('div');
    ring.style.cssText =
      `position: absolute; inset: 0; border: 3px solid #C0FF43; border-radius: 8px; ` +
      `opacity: 0; animation: kernsdk-pulse 1s ease-out ${i * 0.65}s forwards;`;
    fx.appendChild(ring);
  }
  (doc.body ?? doc.documentElement).appendChild(fx);

  const update = () => {
    const r = el.getBoundingClientRect();
    fx.style.left = `${r.left}px`;
    fx.style.top = `${r.top}px`;
    fx.style.width = `${r.width}px`;
    fx.style.height = `${r.height}px`;
  };
  update();

  // Frame-by-frame tracking keeps the rings glued to the element during
  // the smooth scroll; cleanup cancels the loop and removes the overlay.
  let rafId: number;
  const tick = () => {
    update();
    rafId = doc.defaultView!.requestAnimationFrame(tick);
  };
  rafId = doc.defaultView!.requestAnimationFrame(tick);

  const cleanup = () => {
    doc.defaultView?.cancelAnimationFrame(rafId);
    fx.remove();
  };
  doc.defaultView?.setTimeout(cleanup, durationMs);
  return cleanup;
}
