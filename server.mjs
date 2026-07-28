import "dotenv/config";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 3001);
const groqModel = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const groqApiUrl = "https://api.groq.com/openai/v1/chat/completions";
const rootDirectory = fileURLToPath(new URL(".", import.meta.url));
const conversations = new Map();

const systemPrompt =
  process.env.SYSTEM_PROMPT ||
  "You are Alliance Navigator, a concise and helpful business assistant. " +
    "Reply in the same language as the user. Never claim access to company " +
    "records, CRM, SharePoint, or Power BI unless that data appears in the conversation.";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function rememberConversation(conversationId, messages) {
  conversations.delete(conversationId);
  conversations.set(conversationId, messages.slice(-20));

  if (conversations.size > 100) {
    conversations.delete(conversations.keys().next().value);
  }
}

function writeEvent(response, event) {
  response.write(`${JSON.stringify(event)}\n`);
}

async function requestGroq(messages, signal) {
  return fetch(groqApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: groqModel,
      messages,
      stream: true,
      temperature: 0.4,
    }),
    signal,
  });
}

async function requestGemini(history, prompt, signal) {
  const contents = [
    ...history.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),
    { role: "user", parts: [{ text: prompt }] },
  ];
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(geminiModel)}:streamGenerateContent?alt=sse`;

  return fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.4 },
    }),
    signal,
  });
}

async function getUpstream(history, messages, prompt, signal) {
  if (process.env.GROQ_API_KEY) {
    let groqResponse;
    try {
      groqResponse = await requestGroq(messages, signal);
    } catch {
      if (signal.aborted) return null;
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GROQ_UNAVAILABLE");
      }
    }

    if (groqResponse?.ok && groqResponse.body) {
      return { provider: "groq", response: groqResponse };
    }

    if (groqResponse) {
      const details = await groqResponse.text();
      console.error(`Groq error ${groqResponse.status}: ${details.slice(0, 500)}`);

      const canFallback =
        process.env.GEMINI_API_KEY &&
        (groqResponse.status === 429 || groqResponse.status >= 500);
      if (!canFallback) {
        return { provider: "groq", response: groqResponse };
      }

      console.info(`Falling back to Gemini after Groq ${groqResponse.status}.`);
    }
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("NO_PROVIDER_KEY");
  }

  try {
    const geminiResponse = await requestGemini(history, prompt, signal);
    return { provider: "gemini", response: geminiResponse };
  } catch {
    if (signal.aborted) return null;
    throw new Error("GEMINI_UNAVAILABLE");
  }
}

function getDelta(provider, chunk) {
  if (provider === "groq") {
    return chunk.choices?.[0]?.delta?.content;
  }

  return chunk.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("");
}

async function handleChat(request, response) {
  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    sendJson(response, 503, {
      error:
        "An API key is required. Add GROQ_API_KEY or GEMINI_API_KEY to the .env file.",
    });
    return;
  }

  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "REQUEST_TOO_LARGE";
    sendJson(response, tooLarge ? 413 : 400, {
      error: tooLarge ? "The message is too large." : "The request body is invalid.",
    });
    return;
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const conversationId =
    typeof body.conversationId === "string" ? body.conversationId : "";

  if (!prompt || prompt.length > 8_000 || !conversationId) {
    sendJson(response, 400, { error: "The message or conversation is invalid." });
    return;
  }

  const history = conversations.get(conversationId) || [];
  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: prompt },
  ];

  const upstreamController = new AbortController();
  request.on("aborted", () => upstreamController.abort());
  response.on("close", () => {
    if (!response.writableEnded) upstreamController.abort();
  });

  let upstreamResult;
  try {
    upstreamResult = await getUpstream(
      history,
      messages,
      prompt,
      upstreamController.signal
    );
  } catch (error) {
    if (upstreamController.signal.aborted) return;
    const noKey = error instanceof Error && error.message === "NO_PROVIDER_KEY";
    sendJson(response, noKey ? 503 : 502, {
      error: noKey
        ? "Groq reached its limit and GEMINI_API_KEY is missing for fallback."
        : "Could not connect to the AI provider.",
    });
    return;
  }

  if (!upstreamResult) return;
  const { provider, response: upstream } = upstreamResult;

  if (!upstream.ok || !upstream.body) {
    const details = await upstream.text();
    console.error(`${provider} error ${upstream.status}: ${details.slice(0, 500)}`);
    sendJson(response, upstream.status === 429 ? 429 : 502, {
      error:
        upstream.status === 429
          ? `${provider === "groq" ? "Groq" : "Gemini"} reached its free-tier limit.`
          : `${provider === "groq" ? "Groq" : "Gemini"} could not complete the response.`,
    });
    return;
  }

  response.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Content-Type-Options": "nosniff",
  });

  const reader = upstream.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let assistantContent = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += value ?? "";

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;

        const chunk = JSON.parse(data);
        const delta = getDelta(provider, chunk);
        if (typeof delta === "string" && delta) {
          assistantContent += delta;
          writeEvent(response, { type: "text_delta", delta });
        }
      }

      if (done) break;
    }

    if (assistantContent) {
      rememberConversation(conversationId, [
        ...history,
        { role: "user", content: prompt },
        { role: "assistant", content: assistantContent },
      ]);
    }
  } catch (error) {
    if (!upstreamController.signal.aborted) {
      console.error("Streaming error:", error);
    }
  } finally {
    response.end();
  }
}

async function serveStatic(request, response) {
  const requestedPath = new URL(request.url, "http://localhost").pathname;
  const safePath = normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = join(rootDirectory, "dist", safePath === "/" ? "index.html" : safePath);

  try {
    if (!(await stat(filePath)).isFile()) throw new Error("NOT_FILE");
  } catch {
    filePath = join(rootDirectory, "dist", "index.html");
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
    });
    response.end(content);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

const server = createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/chat") {
    await handleChat(request, response);
    return;
  }

  if (request.method === "GET") {
    await serveStatic(request, response);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`Alliance Navigator server listening on http://localhost:${port}`);
});
