// Setup and integration status for the dashboard (any member; user JWT required).
import { serve } from "../_shared/http.ts";
import { createHandler, liveDeps } from "./handler.ts";

serve("system-status", createHandler(liveDeps));
