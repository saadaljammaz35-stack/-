import { SUITE, SUITE_VERSION, THRESHOLDS } from "@/lib/ai/eval/suite";
import { route } from "@/lib/http/route";

export const runtime = "nodejs";

/** The fixed test suite and its pass thresholds. */
export const GET = route.auth({ sessionOnly: true }, async () => ({
  suiteVersion: SUITE_VERSION,
  thresholds: THRESHOLDS,
  cases: SUITE.map((c) => ({ key: c.key, category: c.category, input: c.input, expected: c.expected, checks: c.checks.map((x) => x.kind) })),
}));
