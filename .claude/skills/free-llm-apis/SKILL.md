---
name: free-llm-apis
description: Guide users through obtaining and configuring free API keys for LLM providers. Use when the user wants to set up a free LLM API, get a free API key, connect to a free model provider, configure an OpenAI-compatible endpoint at no cost, or asks about free tiers for AI models. Triggers on "free API key", "free LLM", "set up Gemini/Groq/Mistral/etc.", "which free provider", "how to get an API key", "free model access", "configure LLM for free".
---

# Free LLM API Setup

Help users pick a free LLM provider and configure their API key. Every provider here has a permanent free tier, no credit card needed.

## Provider Selection

Ask the user what matters most, then recommend accordingly:

| Priority | Best picks |
|---|---|
| Fastest inference | Groq (LPU hardware; ~1,000 RPD on chat models) |
| Largest model selection | NVIDIA NIM (100+ models), Cloudflare Workers AI (60+), Hugging Face (thousands, small credit) |
| Strongest proprietary models | Google Gemini, Mistral AI, Cohere (non-commercial only) |
| Free frontier open-weight models | OpenRouter (`:free` models), Kilo Code, NVIDIA NIM |
| European provider / EU hosting | Mistral AI (FR), OVHcloud AI Endpoints (FR, EU data centers), LLM7.io (UK) |
| No signup or key required | OVHcloud AI Endpoints (2 RPM/IP), Kilo Code (200 req/hr/IP), LLM7.io (anonymous tier) |
| Privacy-sensitive prompts | Avoid Gemini free tier outside the EEA, Switzerland and the UK, Mistral free mode (unless opted out), OpenRouter/Kilo free routes, NVIDIA trial endpoints |

### Provider categories

<!-- providers:start -->
**Provider APIs** -- run by the companies that train the models:
- Aion Labs, Cohere, Google Gemini, Mistral AI, Z AI (Zhipu AI)
- See [references/provider-apis.md](references/provider-apis.md) for setup instructions.

**Inference providers** -- third-party platforms hosting open-weight models:
- Cloudflare Workers AI, Gonka Broker, Groq,
