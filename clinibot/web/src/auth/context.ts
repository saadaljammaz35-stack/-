import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthValue {
  session: Session | null;
  user: User | null;
  /** True until the stored session (or the one in the URL) has been checked. */
  loading: boolean;
  /** Signs out on this device and clears cached data. */
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);
