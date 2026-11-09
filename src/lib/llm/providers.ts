/**
 * Free-tier LLM providers behind one streaming interface.
 * Gemini: streamGenerateContent (SSE). Groq: OpenAI-compatible chat completions (SSE).
 * Keys are read from the environment on the server only and are never logged or returned.
 */
export type ProviderId = "gemini" | "groq";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export interface LlmConfig {
  provider: "auto" | "gemini" | "groq" | "none";
  geminiModel: string;
  groqModel: string;
  groqFallbackModel: string;
  whisperModel: string;
  hasGemini: boolean;
  hasGroq: boolean;
}

export function llmConfig(): LlmConfig {
  const p = (process.env.LLM_PROVIDER ?? "auto").trim().toLowerCase();
  return {
    provider: (["auto", "gemini", "groq", "none"].includes(p) ? p : "auto") as LlmConfig["provider"],
    geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash",
    groqModel: process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b",
    groqFallbackModel: process.env.GROQ_FALLBACK_MODEL?.trim() || "openai/gpt-oss-20b",
    whisperModel: process.env.GROQ_WHISPER_MODEL?.trim() || "whisper-large-v3-turbo",
    hasGemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
    hasGroq: Boolean(process.env.GROQ_API_KEY?.trim()),
  };
}

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly provider: ProviderId,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

const CONNECT_TIMEOUT_MS = 15_000;

async function* sse(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data && data !== "[DONE]") yield data;
      }
    }
  }
}

async function post(url: string, init: RequestInit, provider: ProviderId): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONNECT_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new LlmError(`${provider} HTTP ${res.status}`, provider, res.status);
    return res;
  } catch (e) {
    if (e instanceof LlmError) throw e;
    throw new LlmError(`${provider} ${e instanceof Error && e.name === "AbortError" ? "timed out" : "network error"}`, provider, null);
  } finally {
    clearTimeout(timer);
  }
}

export async function streamGemini(system: string, messages: ChatMsg[], maxTokens: number): Promise<AsyncGenerator<string>> {
  const cfg = llmConfig();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.geminiModel)}:streamGenerateContent?alt=sse`;
  const res = await post(
    url,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY!.trim() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        // thinking tokens count against maxOutputTokens, so leave headroom; keep reasoning minimal for speed
        generationConfig: { maxOutputTokens: maxTokens + 700, temperature: 0.3, thinkingConfig: { thinkingLevel: "low" } },
      }),
    },
    "gemini",
  );
  return (async function* () {
    for await (const data of sse(res)) {
      try {
        const j = JSON.parse(data) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
        for (const p of j.candidates?.[0]?.content?.parts ?? []) if (p.text && !p.thought) yield p.text;
      } catch {
        /* ignore malformed chunk */
      }
    }
  })();
}

export async function streamGroq(model: string, system: string, messages: ChatMsg[], maxTokens: number): Promise<AsyncGenerator<string>> {
  const res = await post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY!.trim()}` },
      body: JSON.stringify({
        model,
        stream: true,
        // gpt-oss are reasoning models: lowest effort, no reasoning in the reply, no chain-of-thought prompting
        reasoning_effort: "low",
        include_reasoning: false,
        max_completion_tokens: maxTokens + 300,
        temperature: 0.3,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    },
    "groq",
  );
  return (async function* () {
    let used = 0;
    for await (const data of sse(res)) {
      try {
        const j = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
        const t = j.choices?.[0]?.delta?.content;
        if (t) {
          used += t.length;
          yield t;
        }
      } catch {
        /* ignore malformed chunk */
      }
      if (used > maxTokens * 8) break; // hard character ceiling as a belt-and-braces output cap
    }
  })();
}

export async function transcribeGroq(audio: Blob, filename: string): Promise<{ text: string; model: string }> {
  const cfg = llmConfig();
  const models = [cfg.whisperModel, "whisper-large-v3"].filter((m, i, a) => a.indexOf(m) === i);
  let last: LlmError | null = null;
  for (const model of models) {
    const form = new FormData();
    form.append("file", audio, filename);
    form.append("model", model);
    form.append("response_format", "json");
    form.append("temperature", "0");
    try {
      const res = await post("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${process.env.GROQ_API_KEY!.trim()}` }, body: form }, "groq");
      const j = (await res.json()) as { text?: string };
      return { text: (j.text ?? "").trim(), model };
    } catch (e) {
      last = e instanceof LlmError ? e : new LlmError("transcription failed", "groq", null);
    }
  }
  throw last ?? new LlmError("transcription failed", "groq", null);
}
