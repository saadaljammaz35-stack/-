/**
 * Local test harness: loads every Edge Function module and serves them behind
 * one router (/functions/v1/<name>), using the host's Deno. Used when the
 * Docker Edge Runtime cannot download npm dependencies (offline CI sandboxes).
 *   deno run -A --config supabase/functions/deno.json supabase/tests/functions-harness.ts
 */
type Handler = (req: Request) => Response | Promise<Response>;
const FUNCTIONS = ['ai-recognize-item', 'ai-detect-items', 'ai-understand-query', 'remove-background', 'account-delete', 'account-export', 'revenuecat-webhook'];
const handlers = new Map<string, Handler>();
const realServe = Deno.serve;
let current = '';
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (h: Handler) => {
  handlers.set(current, h);
  return { finished: Promise.resolve(), shutdown: async () => {}, ref() {}, unref() {}, addr: { hostname: '', port: 0, transport: 'tcp' } };
};
for (const name of FUNCTIONS) {
  current = name;
  await import(`../functions/${name}/index.ts`);
}
// deno-lint-ignore no-explicit-any
(Deno as any).serve = realServe;
const port = Number(Deno.env.get('HARNESS_PORT') ?? '54400');
Deno.serve({ port, hostname: '127.0.0.1' }, (req) => {
  const name = new URL(req.url).pathname.replace(/^\/functions\/v1\//, '').split('/')[0];
  const h = handlers.get(name);
  return h ? h(req) : new Response('not found', { status: 404 });
});
console.log(`functions harness on :${port} (${[...handlers.keys()].join(', ')})`);
