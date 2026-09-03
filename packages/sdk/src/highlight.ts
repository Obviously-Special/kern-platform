/**
 * Guide pulse — the eye-catching highlight for guide targets.
 *
 * The rings are appended INSIDE the target element (position: absolute,
 * inset: 0) so they travel with it during smooth scrolling — fixed
 * viewport coordinates would leave the animation behind at the
 * pre-scroll position.
 *
 * Keyframes are injected once into the HOST document (light DOM) under a
 * namespaced name: the widget's shadow-root styles do not apply to nodes
 * appended to host-page elements.
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
 * function. Temporarily sets position:relative so the absolute rings
 * anchor to the target (restored on cleanup).
 */
export function pulseElement(el: HTMLElement, durationMs = 3200): () => void {
  ensureKeyframes(el.ownerDocument);

  const previousPosition = el.style.position;
  if (!previousPosition) el.style.position = 'relative';

  const fx = el.ownerDocument.createElement('div');
  fx.style.cssText = 'position: absolute; inset: 0; pointer-events: none; overflow: visible;';
  for (let i = 0; i < 3; i++) {
    const ring = el.ownerDocument.createElement('div');
    ring.style.cssText =
      `position: absolute; inset: 0; border: 3px solid #C0FF43; border-radius: 8px; ` +
      `opacity: 0; animation: kernsdk-pulse 1s ease-out ${i * 0.65}s forwards;`;
    fx.appendChild(ring);
  }
  el.appendChild(fx);

  const cleanup = () => {
    fx.remove();
    el.style.position = previousPosition;
  };
  el.ownerDocument.defaultView?.setTimeout(cleanup, durationMs);
  return cleanup;
}
