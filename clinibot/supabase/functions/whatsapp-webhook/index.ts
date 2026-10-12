// Meta's WhatsApp webhook. verify_jwt is off (config.toml): GET is checked
// against the clinic's verify token, POST against Meta's HMAC signature.
import { serve } from "../_shared/http.ts";
import { createHandler, liveDeps } from "./handler.ts";

serve("whatsapp-webhook", createHandler(liveDeps), { methods: ["GET", "POST"] });
