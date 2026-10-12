// Anonymous patient web chat. verify_jwt is off for this function (config.toml):
// callers are authenticated by their session token and limited per IP.
import { serviceClient } from "../_shared/db.ts";
import { serve } from "../_shared/http.ts";
import { createPublicChatHandler } from "./handler.ts";

serve("public-chat", createPublicChatHandler({ db: serviceClient }));
