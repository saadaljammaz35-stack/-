# OMNIX Personal AI — Evaluation

## 1. What the suite is — and is not

`src/lib/ai/eval/suite.ts`, version `omnix-eval-1.0`: **33 fixed cases**, each
scored by **deterministic checks** (contains / number / exact word / JSON
keys / line count / Arabic-script ratio / refusal phrase / tool call /
retrieval top-1 / latency). No model grades another model, so runs are
reproducible and comparable between versions.

It is a **regression gate**: it tells you whether a version still does a set
of narrow, checkable things in Arabic and English. It is **not** a benchmark
and supports no claim of being better than any other AI system. Such a claim
would need independent, published benchmarks run under comparable
conditions; none was run.

| Category | Cases | Pass threshold | What a check looks like |
| --- | --- | --- | --- |
| Arabic quality | 4 | 75 % | capital → «الرياض»; plural of كتاب; one MSA sentence (Arabic-script ratio ≥ 0.85) |
| Saudi dialect | 4 | 50 % | meaning of «الحين», «أبغى», «زين», «وش تبي؟» |
| English quality | 3 | 67 % | exactly one sentence; antonym; spelling fix |
| Coding | 4 | 75 % | predict JS / Python output; SQL keyword |
| Reasoning | 4 | 75 % | arithmetic word problems (Arabic and English), time arithmetic |
| Instruction following | 4 | 75 % | uppercase YES only; valid JSON; Arabic-only answer; exactly three lines |
| Hallucination | 4 | 75 % | answer from the given source; **say "not found"** when the source lacks it; do not claim to be ChatGPT |
| Retrieval | 3 | 100 % | Arabic, English and cross-language query → correct fixture document (real embedder + SQL; fixtures live inside a rolled-back savepoint) |
| Tool calling | 2 | 50 % | correct tool + arguments; **skipped** (not passed) when the provider cannot call tools |
| Latency | 1 | 100 % | first token ≤ 10 s, total ≤ 60 s |

Thresholds are a policy choice made for this project, editable in one place.

## 2. Gate and comparison

- A run is **passed** only if every category with evaluated cases meets its
  threshold. Skipped cases are recorded but never counted as passes.
- The database refuses to deploy a version without a passed `full` run
  (`omnix_enforce_deploy_gate`).
- **Base vs customised**: *Evaluation → Compare versions* (or
  `GET /api/ai/evaluations/compare?baseline=&candidate=`) puts the latest
  full run of each version side by side per category and per case
  (improved / regressed / same). Runs from different suite versions are
  refused as not comparable.

## 3. Real result: development model

`Qwen/Qwen2.5-0.5B-Instruct` (ONNX q8, CPU, in-process), suite
`omnix-eval-1.0`, 2026-11-11 — recorded by `tests/integration/evaluation.test.ts`:

| Category | Passed |
| --- | --- |
| Arabic quality | 2 / 4 |
| Saudi dialect | **0 / 4** |
| English quality | 1 / 3 |
| Coding | 1 / 4 |
| Reasoning | 1 / 4 |
| Instruction following | 2 / 4 |
| Hallucination | 1 / 4 — it invented a designer for the Falcon reactor |
| Retrieval | 3 / 3 |
| Tool calling | skipped (2) — the in-process provider has no tool calling |
| Latency | 1 / 1 |
| **Overall** | **12 / 31 = 38.7 % → failed** |

**The deploy gate refused to deploy it**, which is the intended behaviour: a
0.5 B model exists here to make the pipeline testable on a CPU, not to be
used. The production candidates (Qwen3-8B, ALLaM-7B) have **not** been
evaluated yet because they need a GPU host; run the suite against each before
choosing.

The gate's success path (pass → deploy → external API → role pinning →
rollback) is tested with a scripted provider that answers the suite
correctly **by construction**. That test checks the gate logic only and says
nothing about model quality.

## 4. Retrieval calibration

The relevance threshold for `intfloat/multilingual-e5-small` was measured on
the test fixtures with the real model (cosine similarity):

| Query → document | Similarity |
| --- | --- |
| related query → its document (Arabic, English, cross-language) | 0.862 – 0.902 |
| unrelated query → best document | 0.734 – 0.779 |
| related query → a different document | up to 0.815 |

`RELEVANCE_SIMILARITY = 0.83` sits in that gap. A keyword match counts as
relevant only when the semantic score is within 0.06 of the bar (so exact
codes like `QX-4471` still match, but one incidental shared word does not).
The margin is narrow; re-measure on your own documents, and calibrate
`BAAI/bge-m3` before using it (its value is an untested starting point).

## 5. Running it

UI: *Evaluation → Run full evaluation*, or *Versions → Evaluate*.
API: `POST /api/ai/evaluations {"modelVersionId": "…", "evaluationType": "full"}` (202),
then `GET /api/ai/evaluations/{id}`. Each run records per-case input,
expected, actual, pass/fail, latency and the reason, and a usage event with
the tokens it consumed.
