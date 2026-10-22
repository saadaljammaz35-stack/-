/**
 * Runs a retry whose button disappears when it succeeds (the error block it
 * sits in is replaced by the content). If that took keyboard focus with it,
 * focus moves to `target()` instead of falling to <body>.
 */
export async function retryKeepingFocus(
  retry: () => Promise<unknown>,
  target: () => HTMLElement | null,
): Promise<void> {
  const focused = document.activeElement;
  await retry();
  requestAnimationFrame(() => {
    const lost =
      focused instanceof HTMLElement &&
      !focused.isConnected &&
      (document.activeElement === null || document.activeElement === document.body);
    if (lost) target()?.focus();
  });
}
