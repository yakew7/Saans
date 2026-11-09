import { llmConfig, streamGemini, streamGroq, type ChatMsg, type ProviderId } from "./providers";

export interface OpenStream {
  provider: ProviderId;
  model: string;
  stream: AsyncGenerator<string>;
}

interface Step {
  provider: ProviderId;
  model: string;
  open: () => Promise<AsyncGenerator<string>>;
}

/** Ordered attempts. auto: Gemini first, then Groq (120b, then 20b on 429/quota). Only configured providers are tried. */
export function plan(system: string, messages: ChatMsg[], maxTokens: number): Step[] {
  const c = llmConfig();
  const gemini: Step = { provider: "gemini", model: c.geminiModel, open: () => streamGemini(system, messages, maxTokens) };
  const groq = (model: string): Step => ({ provider: "groq", model, open: () => streamGroq(model, system, messages, maxTokens) });
  const groqSteps = [groq(c.groqModel), ...(c.groqFallbackModel !== c.groqModel ? [groq(c.groqFallbackModel)] : [])];
  if (c.provider === "none") return [];
  if (c.provider === "gemini") return c.hasGemini ? [gemini] : [];
  if (c.provider === "groq") return c.hasGroq ? groqSteps : [];
  return [...(c.hasGemini ? [gemini] : []), ...(c.hasGroq ? groqSteps : [])];
}

/**
 * Open a stream with automatic failover. The next provider is tried when a call fails (429, quota, 5xx, timeout, bad key)
 * or produces no first token. Once the first token is out we are committed to that provider.
 * Returns null when nothing works (callers fall back to the rule-based basic mode).
 */
export async function openStream(system: string, messages: ChatMsg[], maxTokens: number): Promise<OpenStream | null> {
  for (const step of plan(system, messages, maxTokens)) {
    try {
      const it = await step.open();
      const first = await it.next();
      if (first.done || !first.value) continue;
      const stream = (async function* () {
        yield first.value;
        for (;;) {
          const n = await it.next();
          if (n.done) return;
          yield n.value;
        }
      })();
      return { provider: step.provider, model: step.model, stream };
    } catch {
      /* try the next provider */
    }
  }
  return null;
}

/** Non-streaming convenience: collects a full reply (used for insights). */
export async function completeText(system: string, user: string, maxTokens: number): Promise<{ text: string; provider: ProviderId; model: string } | null> {
  const o = await openStream(system, [{ role: "user", content: user }], maxTokens);
  if (!o) return null;
  let text = "";
  for await (const t of o.stream) text += t;
  text = text.trim();
  return text ? { text, provider: o.provider, model: o.model } : null;
}
