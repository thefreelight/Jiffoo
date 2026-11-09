/** Public viewport space available to an opaque frame, in bounded CSS pixels. */
export function availableFrameHeight(viewportHeight: number, frameTop: number, bottomSpace = 24): number {
  return Math.max(240, Math.min(2000, Math.floor(viewportHeight - Math.max(0, frameTop) - bottomSpace)));
}

/** Reserve host padding and ignore existing scroll offsets when fitting a workspace. */
export function frameViewportHeight(frame: HTMLElement, viewportHeight: number): number {
  const document = frame.ownerDocument, view = document.defaultView!;
  let top = frame.getBoundingClientRect().top, bottom = viewportHeight, padding = 0, nested = false;
  for (let parent = frame.parentElement; parent; parent = parent.parentElement) {
    const style = view.getComputedStyle(parent);
    padding += (Number.parseFloat(style.paddingBottom) || 0) + (Number.parseFloat(style.marginBottom) || 0);
    if (parent !== document.scrollingElement) top += parent.scrollTop;
    if (/^(auto|scroll)$/.test(style.overflowY)) {
      bottom = Math.min(bottom, parent.getBoundingClientRect().bottom); nested = true; break;
    }
  }
  if (!nested) top += view.scrollY;
  return availableFrameHeight(bottom, top, Math.max(24, padding + 8));
}
