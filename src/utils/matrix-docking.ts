/**
 * src/utils/matrix-docking.ts
 *
 * Meeglijdende en dockende groepskoppen helper conform Matrix V3 Benchmark.
 * Berekent de relatieve verschuiving (translateX) voor badges in thead
 * tegen de rechterkant van de sticky eerste kolom (th.sticky-col-0).
 */

export function syncStickyGroupHeaders(viewport: HTMLElement | null): void {
  if (!viewport) return;

  const col0 = (viewport.querySelector('thead th.sticky-col-0') ||
    viewport.querySelector('tbody td.sticky-col-0')) as HTMLElement | null;

  if (!col0) return;

  const col0Rect = col0.getBoundingClientRect();
  const dockX = col0Rect.right;

  // Zoek alle thead-cellen die een meeglijdend labelbadge bevatten
  const dockableBadges = viewport.querySelectorAll<HTMLElement>(
    '.sticky-group-label-etage, .sticky-group-label-room, .sticky-group-label-cluster'
  );

  dockableBadges.forEach((badge) => {
    const th = badge.closest('th');
    if (!th) return;

    const thRect = th.getBoundingClientRect();
    const badgeWidth = badge.offsetWidth;
    const padding = 12; // 12px veiligheidsmarge
    const maxShift = Math.max(0, thRect.width - badgeWidth - padding * 2);
    const needed = dockX - thRect.left + padding;

    if (needed > 0) {
      const shift = Math.min(needed, maxShift);
      badge.style.transform = `translateX(${shift}px)`;
    } else {
      badge.style.transform = '';
    }
  });
}

export function attachMatrixDockingListener(viewport: HTMLElement | null): () => void {
  if (!viewport || typeof window === 'undefined') {
    return () => {};
  }

  // Directe synchrone initiële positionering
  syncStickyGroupHeaders(viewport);

  let rafId: number | null = null;

  const onScrollOrResize = () => {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      syncStickyGroupHeaders(viewport);
      rafId = null;
    });
  };

  viewport.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });

  return () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    viewport.removeEventListener('scroll', onScrollOrResize);
    window.removeEventListener('resize', onScrollOrResize);
  };
}
