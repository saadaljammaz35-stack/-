// Staff invitations (owner, admin; user JWT required).
import { serve } from "../_shared/http.ts";
import { createHandler, liveDeps } from "./handler.ts";

serve("invite-member", createHandler(liveDeps));
