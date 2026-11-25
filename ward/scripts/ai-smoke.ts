import './_env';
import { z } from 'zod';
import { adapterFor, completeJson, configuredProviders, costOf, priceFor } from '@/lib/ai/gateway';
import { DEFAULT_SETTINGS, type ProviderId } from '@/lib/settings';

/**
 * Live smoke test for every configured AI provider (real calls, a few cents at most):
 *   1. a tool call, 2. the tool result replayed with "answer without tools", 3. structured JSON.
 * Usage: npm run ai:smoke [-- <provider> <model>]
 */
const [onlyProvider, onlyModel] = process.argv.slice(2);
const providers = onlyProvider ? [onlyProvider as ProviderId] : configuredProviders();
if (!providers.length) {
  console.error('No AI provider configured.');
  process.exit(1);
}
const tool = {
  name: 'search_knowledge',
  description: 'Search WARD institutional memory',
  parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false },
};
const system = 'أنت مساعد لوارد. ابحث في الذاكرة بالأداة قبل الإجابة.';
let failed = false;

for (const provider of providers) {
  const model = onlyModel ?? DEFAULT_SETTINGS['ai.models'][provider].economy;
  const price = priceFor(DEFAULT_SETTINGS, provider, model);
  const adapter = adapterFor(provider);
  try {
    const t0 = Date.now();
    const r1 = await adapter.chat({ model, system, maxTokens: 4000, tools: [tool], messages: [{ role: 'user', content: 'ما هو شعار وارد؟' }] });
    const call = r1.toolCalls[0];
    if (!call) throw new Error(`expected a tool call, got: ${r1.text.slice(0, 120)}`);
    const r2 = await adapter.chat({
      model,
      system,
      maxTokens: 4000,
      tools: [tool],
      toolChoice: 'none',
      messages: [
        { role: 'user', content: 'ما هو شعار وارد؟' },
        { role: 'assistant', content: r1.text, toolCalls: r1.toolCalls, raw: r1.raw },
        { role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify({ results: [{ source: 'هوية وارد', excerpt: 'الشعار: «كل شيء وارد.»' }] }) },
      ],
    });
    if (r2.toolCalls.length || !r2.text.trim()) throw new Error('expected a final text answer after the tool result');
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings['ai.fallback_order'] = [provider];
    settings['ai.models'][provider].economy = model;
    const { data, result } = await completeJson({
      settings,
      tier: 'economy',
      name: 'ideas',
      schema: z.object({ ideas: z.array(z.object({ title: z.string().min(3).max(140), why: z.string().max(400) })).min(2).max(3) }),
      request: {
        system: 'أنت مدير المحتوى في وارد.',
        messages: [{ role: 'user', content: 'اقترح فكرتين قصيرتين لحلقات بودكاست عن ريادة الأعمال للشباب.' }],
        maxTokens: 4000,
      },
    });
    const cost = costOf(price, r1.usage) + costOf(price, r2.usage) + result.costUsd;
    console.info(`✓ ${provider}:${r2.model}  ${Date.now() - t0}ms  $${cost.toFixed(5)}${price.verified ? '' : ' (estimated price)'}`);
    console.info(`  answer: ${r2.text.trim().slice(0, 140).replace(/\n/g, ' ')}`);
    console.info(`  ideas:  ${data.ideas.map((i) => i.title).join(' | ')}`);
  } catch (err) {
    failed = true;
    console.error(`✗ ${provider}:${model}  ${err instanceof Error ? err.message.slice(0, 400) : String(err)}`);
  }
}
process.exit(failed ? 1 : 0);
