import { serve } from "../_shared/http.ts";
import { createHandler, liveDeps } from "./handler.ts";

serve("appointment-notify", createHandler(liveDeps));
