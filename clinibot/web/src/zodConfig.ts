// Zod compiles object parsers with `new Function` when it may. The CSP has no
// 'unsafe-eval', so its probe for that is blocked and logged as a CSP error on
// every page. Jitless mode skips the probe; parsing works the same.
// Imported first in main.tsx, before any schema is used.
import { z } from "zod";

z.config({ jitless: true });
