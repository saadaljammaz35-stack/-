// Staff test console for the AI assistant (owner, admin; user JWT required).
import { serviceClient } from "../_shared/db.ts";
import { serve } from "../_shared/http.ts";
import { createAssistantTestHandler } from "./handler.ts";

serve("assistant-test", createAssistantTestHandler({ db: serviceClient }));
