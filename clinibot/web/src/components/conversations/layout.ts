/**
 * The inbox grid, shared by the workspace and its loading skeleton so nothing
 * jumps when the workspace chunk arrives. Desktop (lg+): list and thread side
 * by side in a fixed-height area. Phones: one column in the page flow.
 */
export const WORKSPACE_GRID =
  "grid grid-cols-1 gap-4 lg:h-[calc(100dvh-13rem)] lg:min-h-[36rem] lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]";
