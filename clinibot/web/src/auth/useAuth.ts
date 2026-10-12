import { use } from "react";
import { AuthContext, type AuthValue } from "./context";

/** { session, user, loading, signOut } */
export function useAuth(): AuthValue {
  const value = use(AuthContext);
  if (!value) throw new Error("useAuth() must be used inside <AuthProvider>");
  return value;
}
