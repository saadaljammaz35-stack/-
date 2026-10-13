import { createContext, useContext } from "react";

/** True inside the landing page, where section links scroll instead of navigating. */
export const OnHomeContext = createContext(false);

export function useOnHome(): boolean {
  return useContext(OnHomeContext);
}
