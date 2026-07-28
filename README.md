# Alliance Navigator Chat

A full-stack reference project for an enterprise conversational interface built
with React 19, TypeScript, Vite, and Node.js.

The application includes real-time response streaming, cancellation, provider
fallback, and conversation history. Its domain contracts and UI components also
support citations and structured result cards, although the current backend
only emits text events.

## Requirements

- Node.js 22
- npm
- A Groq API key, a Gemini API key, or both

## Provider setup

API keys are read only by the backend and are never included in the Vite bundle.

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Configure at least one provider:

   ```dotenv
   GROQ_API_KEY=gsk_your_key_here
   GEMINI_API_KEY=your_gemini_key_here
   ```

3. Optionally customize models, the server port, or the system prompt:

   ```dotenv
   GROQ_MODEL=llama-3.1-8b-instant
   GEMINI_MODEL=gemini-2.5-flash-lite
   PORT=3001
   SYSTEM_PROMPT=You are a helpful assistant.
   ```

Groq is the primary provider when configured. The backend falls back to Gemini
when Groq is unavailable, returns `429`, or returns a `5xx` response. Other
Groq `4xx` errors are returned to the client without fallback.

Never commit `.env`; it is excluded by `.gitignore`.

### Secret management

Provider credentials are server-side secrets. They must never use the `VITE_`
prefix, be committed to Git, be logged, or be returned to the browser.

- Local development reads credentials from the ignored `.env` file.
- Deployed environments must inject credentials through the hosting provider's
  secret or environment-variable manager.
- Contributors use their own provider credentials.
- Development and production credentials should be separate, scoped as narrowly
  as possible, rate limited at the provider, and rotated if exposure is suspected.

The application cannot safely bundle a shared provider key for people who clone
the repository. A public demo must keep the key on its backend.

## Development

```bash
npm install
npm run dev
```

The development command starts two processes:

| Process | URL | Purpose |
|---|---|---|
| `npm run dev:api` | `http://localhost:3001` | Node API and provider connections |
| `npm run dev:web` | `http://localhost:5173` | Vite frontend |

Vite proxies `/api/*` to the Node backend during development.

The chat endpoint applies an in-memory per-client rate limit. Its defaults can be
adjusted with `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS`. Set
`TRUST_PROXY=true` only when the application runs behind a trusted reverse proxy
that sanitizes `X-Forwarded-For`.

## Production

```bash
npm run build
npm start
```

The build command generates `dist`. The Node server then handles
`POST /api/chat`, serves the frontend assets, and falls back to
`dist/index.html` for client-side routes.

### Deploy to Render

The repository includes a `render.yaml` Blueprint. Create a new Render Blueprint,
connect this repository, and provide at least one of `GROQ_API_KEY` or
`GEMINI_API_KEY` when Render prompts for secret environment values. Render builds
and starts the full-stack application and checks `GET /health`.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The GitHub Actions workflow runs linting, type checking, tests, and a production
build for pushes to `main` and pull requests.

## Architecture

```text
Browser
┌─────────────────────────────────────────────────────────────────┐
│ ChatComposer                                                    │
│      │ sendMessage(prompt)                                      │
│      ▼                                                          │
│ ChatProvider ── dispatch ──► chatReducer ──► Context ──► UI      │
│      │                                                          │
│      ▼                                                          │
│ streamChatResponse                                              │
│      │ POST /api/chat { prompt, conversationId }                │
│      │ ReadableStream + NDJSON parser                           │
└──────┼──────────────────────────────────────────────────────────┘
       │ Vite development proxy
       ▼
Node server.mjs
       │
       ├──► Groq Chat Completions streaming (SSE)
       │
       └──► Gemini streamGenerateContent (SSE fallback)
                       │
                       ▼
       normalized as {"type":"text_delta","delta":"..."}\n
```

The browser stores visible conversation state in `localStorage`. The backend
keeps provider context in memory for up to 100 conversations and the latest 20
messages in each conversation. Restarting the backend clears that server-side
context.

Cancellation propagates from the browser's `AbortController` through the Node
server to the active provider request. Partial response text remains visible and
the message is marked as cancelled.

`GET /health` provides a credential-free health check for deployment platforms.
The server also sets a restrictive Content Security Policy and baseline browser
security headers.

## Current capabilities

| Capability | Status |
|---|---|
| React 19, TypeScript, and Vite | Implemented |
| Reducer, Context, and memoization | Implemented |
| Streaming and cancellation | Implemented with a real backend |
| Follow-up context | Implemented in memory |
| Conversation history | Implemented in `localStorage` |
| Groq/Gemini fallback | Implemented |
| Citations and deep links | UI and types ready; backend events pending |
| Structured result cards | UI and types ready; backend events pending |
| Accessibility | Baseline implemented; full WCAG 2.2 AA audit pending |
| Component tests | Partial coverage |
| CI/CD | CI implemented; deployment pending |
