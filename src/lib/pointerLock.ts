/**
 * Pointer lock with raw mouse input (no OS acceleration) where supported,
 * falling back to a plain lock. Must be called from a user gesture.
 */
export function lockPointer(el: HTMLElement | null) {
  if (!el || document.pointerLockElement) return;
  const req = el.requestPointerLock as unknown as (o?: { unadjustedMovement?: boolean }) => Promise<void> | void;
  try {
    const p = req.call(el, { unadjustedMovement: true });
    if (p && typeof p.catch === "function")
      p.catch(() => {
        try {
          const p2 = req.call(el);
          if (p2 && typeof p2.catch === "function") p2.catch(() => {});
        } catch {}
      });
  } catch {
    try {
      req.call(el);
    } catch {}
  }
}
