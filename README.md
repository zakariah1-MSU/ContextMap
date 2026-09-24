# ContextMap

ContextMap is a reading workspace that turns unfamiliar terms into contextual lessons and a navigable concept map. The MVP runs as a Next.js app and stores the current session in the browser.

## Requirements

- Node.js 20.9 or newer
- pnpm 10 or newer
- An OpenAI API key and API billing enabled on your OpenAI account

## Local setup

```bash
pnpm install
Copy-Item .env.example .env.local
```

Set `OPENAI_MODEL` and `OPENAI_API_KEY` in `.env.local`, then run:

```bash
pnpm dev
```

Open http://localhost:3000. The `.env.local` file must never be committed.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_MODEL` | Yes | OpenAI model identifier, such as `gpt-4o-mini` |
| `OPENAI_API_KEY` | Yes | Server-only OpenAI API credential |
| `UPSTASH_REDIS_REST_URL` | No | Upstash REST endpoint for shared rate limits |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash REST token; configure together with the URL |

The API routes use the AI SDK OpenAI provider to request schema-constrained structured output and validate it locally with Zod. Configure `OPENAI_API_KEY` and `OPENAI_MODEL` in `.env.local` for local development and in your deployment environment for production.

When both Upstash values are present, the API uses a shared Redis request counter. Without them, the in-memory limiter is per process and is not shared between serverless instances. The app limits each client to 30 requests per minute per route.

## Build and tests

```bash
pnpm test
pnpm build
```

## Deploy to Vercel

1. Import this repository into Vercel.
2. Add `OPENAI_MODEL` and `OPENAI_API_KEY` to the project environment variables. Add both Upstash values for shared rate limiting if desired.
3. Deploy using the default Next.js build settings.

The model endpoints use the Node.js runtime and a 30-second maximum duration. No database is required.

## Assumptions and MVP limits

- A session lives in this browser's localStorage. Import/export is JSON; there is no account sync or server-side session storage.
- Documents are plain text or Markdown. Markdown is displayed as safe plain text; rich Markdown rendering is intentionally not enabled.
- Text over 20,000 characters can be truncated client-side after confirmation. The server rejects oversized requests.
- LLM output is validated and displayed as text. Provider/model availability and output quality depend on the configured Gateway account.
- The graph records concepts the learner opens. Its first-discovery parent defines the outline and lesson path; additional links are graph cross-links.
- PDF, Obsidian vault export, streaming, multi-session management, and arbitrary selected-text explanations are stretch features and are not included in this MVP.
- Text, prompts, and API requests are sent to the selected model provider for processing. Do not paste material you are not permitted to share with that provider.
