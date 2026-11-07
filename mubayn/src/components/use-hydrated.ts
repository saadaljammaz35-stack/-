"use client";
import { useEffect, useState } from "react";

/**
 * True once React has attached event handlers. Submit buttons stay disabled
 * until then, so a fast click can never fall back to a native form submit
 * (which would otherwise send the fields — including passwords — in the URL).
 */
export function useHydrated(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  return ok;
}
