// Marketing "book a demo" form. verify_jwt is off for this function (config.toml):
// callers are anonymous and limited per IP.
import { serve } from "../_shared/http.ts";
import { createHandler, liveDeps } from "./handler.ts";

serve("demo-request", createHandler(liveDeps));
