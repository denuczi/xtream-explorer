/**
 * True once the user has scrolled past `fraction` of the scrollable range.
 * Pages without any overflow never trigger it.
 */
export function isBeyondScrollFraction(
  scrollY: number,
  viewportHeight: number,
  documentHeight: number,
  fraction: number,
): boolean {
  const maxScroll = documentHeight - viewportHeight;
  if (maxScroll <= 0) return false;
  return scrollY >= maxScroll * fraction;
}
