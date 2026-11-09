import { z } from "zod";
import { badRequest, latSchema, lonSchema } from "@/lib/api";
import { basicAnswer } from "@/lib/llm/basic";
import { buildFacts, factsToText, SYSTEM_PROMPT } from "@/lib/llm/facts";
import { clientIp, countAi, rateLimit } from "@/lib/llm/guard";
import { llmConfig } from "@/lib/llm/providers";
import { openStream } from "@/lib/llm/router";

export const maxDuration = 60;

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(500) })).min(1).max(8),
  lat: latSchema,
  lon: lonSchema,
  name: z.string().trim().max(80).default("this location"),
});

const MAX_OUTPUT_TOKENS = 500;
const enc = new TextEncoder();

function basicResponse(text: string, reason: string) {
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8", "x-llm-provider": "basic", "x-basic-reason": reason, "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const rl = rateLimit(clientIp(req));
  if (!rl.ok) return Response.json({ error: "Too many requests. Please wait a moment and try again.", retryAfterSec: rl.retryAfterSec }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  const { messages, lat, lon, name } = parsed.data;
  if (messages[messages.length - 1].role !== "user") return Response.json({ error: "The last message must be from the user" }, { status: 400 });

  const facts = await buildFacts(lat, lon, name);
  const question = messages[messages.length - 1].content;
  const cfg = llmConfig();
  if (cfg.provider === "none" || (!cfg.hasGemini && !cfg.hasGroq)) return basicResponse(basicAnswer(question, facts), "no_ai_configured");

  const cap = countAi();
  if (!cap.ok) return basicResponse(basicAnswer(question, facts), "daily_cap");

  const system = `${SYSTEM_PROMPT}\n\nFACTS:\n${factsToText(facts)}`;
  const opened = await openStream(system, messages.slice(-6), MAX_OUTPUT_TOKENS);
  if (!opened) return basicResponse(basicAnswer(question, facts), "providers_unavailable");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of opened.stream) controller.enqueue(enc.encode(chunk));
      } catch {
        controller.enqueue(enc.encode("\n\n[The answer was cut short because the AI provider disconnected.]"));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "x-llm-provider": opened.provider, "x-llm-model": opened.model, "cache-control": "no-store" } });
}
