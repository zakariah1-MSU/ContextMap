# ContextMap

```text
                         ▓▓▓▓
                    ▓▓▓▓▓▓▓▓▓▓▓
                  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
                    ▓▓▓▓▓▓▓▓▓▓▓
                       ▓▓▓
                 ▓▓▓▓▓▓▓▓▓▓▓▓▓
              ▓▓▓▓▓      │      ▓▓▓▓▓
           ▓▓▓▓▓          │          ▓▓▓▓▓
                         ▓▓▓
                        ▓▓▓▓▓
                       ▓▓▓▓▓▓▓
```

**Keep the thread. Find the meaning.**

ContextMap turns a reading into a map of ideas. Start with an article or a passage, open an unfamiliar term, and follow its connections through short, level-aware lessons. The original reading stays beside your growing concept graph, so each new idea remains connected to where you found it.

## What you can do

- **Bring your own reading:** paste text or open a `.txt` or `.md` file. You can also start with the built-in sample.
- **Find useful terms:** ContextMap identifies technical language, acronyms, methods, theories, and domain-specific phrases in the source.
- **Read in context:** select a highlighted term to get a concise explanation connected to its source sentence and learning path.
- **Set your level:** choose beginner, intermediate, or advanced explanations.
- **Follow related ideas:** explore foundations, sibling concepts, and deeper topics from each lesson.
- **See the big picture:** use the graph and outline to move through ideas you have explored.
- **Keep your place:** navigate backward and forward through your learning trail. `Alt+←` and `Alt+→` work when focus is outside a text field.
- **Save and move sessions:** sessions persist in this browser. Import or export a session as JSON to move or back it up.
- **Make it yours:** switch between dark and light themes, resize the reader and map panes, and use the reader, graph, and outline tabs on smaller screens.

## Quick start

### Requirements

- Node.js 20.9 or newer
- pnpm 10 or newer
- An OpenAI API key with API access and billing enabled

### Install

From the project folder, install dependencies:

```powershell
pnpm install
```

Create `.env.local` from the example only if you do not already have a `.env.local` file:

```powershell
Copy-Item .env.example .env.local
```

Open `.env.local` and set your model and key:

```dotenv
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=your_openai_api_key_here
```

Keep the key on the server. Do not add a `NEXT_PUBLIC_` prefix, commit `.env.local`, or paste the key into client-side code. OpenAI API usage is billed to your OpenAI API account; a ChatGPT subscription does not include API usage.

Start the development server:

```powershell
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). After changing environment variables, stop the server with `Ctrl+C` and run `pnpm dev` again.

## How a session works

1. **Load a source.** Paste text, choose a `.txt` or `.md` file, or try the sample. Input is limited to 20,000 characters; longer pasted text can be clipped to the first 20,000 characters after confirmation.
2. **Review the map.** ContextMap identifies terms in the source and highlights them in the reader.
3. **Open a term.** Select a highlighted phrase to request an explanation. The server sends the relevant term, source context, learning level, and explored concepts to the configured OpenAI model.
4. **Explore connections.** Select keywords in a lesson or a related-concept chip to add another idea to the graph. ContextMap remembers the first-discovery path and can also show cross-links.
5. **Return later.** The current session is saved in the browser's local storage. Use the toolbar's import and export controls for JSON backups.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Server-only credential for the OpenAI API. |
| `OPENAI_MODEL` | Yes | OpenAI model ID. The example uses `gpt-4o-mini`. Choose a model available to your API account that supports structured output. |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis REST endpoint for a shared request counter. |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis REST token; configure it with the URL. |

The AI SDK OpenAI provider requests schema-constrained structured output. The server validates the response with Zod before returning it to the browser. API credentials remain on the server.

Each API route is limited to 30 requests per minute per client. With both Upstash variables configured, the counter is shared through Redis. Without them, the limiter is in memory and is local to each server process.

## Development commands

```powershell
pnpm dev       # Run the local development server
pnpm typecheck # Check TypeScript types
pnpm test      # Run unit tests
pnpm build     # Create a production build
pnpm start     # Serve the production build
```

## Deploy to Vercel

1. Import the repository into Vercel.
2. Add `OPENAI_API_KEY` and `OPENAI_MODEL` under the project's environment variables. Add both Upstash values if you want a shared rate limiter.
3. Deploy with the default Next.js build settings.

The API routes use the Node.js runtime and allow up to 30 seconds for a model request. No database is required. Set environment variables in Vercel's project settings; do not commit secrets to the repository.

## Project map

```text
app/
  api/explain/          Generate a lesson for a concept
  api/extract-keywords/ Find terms in a source text
  globals.css           App styles and responsive layout
components/
  Workspace.tsx         Reader, graph, outline, and session controls
  GraphCanvas.tsx       Interactive concept graph
  HighlightedText.tsx   Selectable terms within reading text
lib/
  prompts.ts             Model instructions
  schemas.ts             Request and response validation
  structured-generation.ts
  store.ts               Browser session state and persistence
  graph.ts               Concept paths and graph operations
```

## Current scope and privacy

- Sessions live in this browser's local storage. There are no accounts, cloud sync, or server-side session database.
- Source files are plain text or Markdown. Markdown is treated as safe text; rich Markdown rendering is not enabled. PDF import is not included.
- Source text and the context needed for lessons are sent to OpenAI for processing. Only submit material you are permitted to share with that provider.
- Model output can vary. ContextMap validates its shape and filters lesson keywords against the returned explanation, but lesson wording and the number of useful suggestions may vary.
- The graph tracks concepts you open; it is not a general-purpose knowledge graph editor.
