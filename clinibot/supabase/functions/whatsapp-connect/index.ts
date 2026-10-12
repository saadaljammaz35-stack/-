import { serve } from "../_shared/http.ts";
import { createHandler, liveDeps } from "./handler.ts";

serve("whatsapp-connect", createHandler(liveDeps));
