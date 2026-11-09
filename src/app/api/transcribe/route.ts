import { clientIp, countAi, rateLimit } from "@/lib/llm/guard";
import { LlmError, llmConfig, transcribeGroq } from "@/lib/llm/providers";

export const maxDuration = 60;

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB (about 30 s of browser-recorded audio is far below this)
const OK_TYPES = /^(audio\/|video\/webm|video\/mp4|application\/ogg)/;

/** Push-to-talk transcription with Groq Whisper. Audio is processed in memory and never stored. */
export async function POST(req: Request) {
  const rl = rateLimit(clientIp(req));
  if (!rl.ok) return Response.json({ error: "Too many requests", retryAfterSec: rl.retryAfterSec }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });
  if (!llmConfig().hasGroq) return Response.json({ error: "Speech transcription is not configured on this server.", code: "no_key" }, { status: 503 });

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES + 4096) return Response.json({ error: "Audio too large (max 2 MB)" }, { status: 413 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  const file = form.get("audio");
  if (!(file instanceof File)) return Response.json({ error: "Missing 'audio' file" }, { status: 400 });
  if (file.size === 0) return Response.json({ error: "Empty recording" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Audio too large (max 2 MB)" }, { status: 413 });
  if (!OK_TYPES.test(file.type)) return Response.json({ error: "Unsupported audio type" }, { status: 415 });

  const cap = countAi();
  if (!cap.ok) return Response.json({ error: "The daily AI limit has been reached. Try again tomorrow, or type your question.", code: "daily_cap" }, { status: 429, headers: { "retry-after": String(cap.retryAfterSec) } });

  try {
    const ext = file.type.includes("mp4") ? "m4a" : file.type.includes("ogg") ? "ogg" : file.type.includes("wav") ? "wav" : "webm";
    const r = await transcribeGroq(file, `speech.${ext}`);
    return Response.json({ text: r.text.slice(0, 500), model: r.model });
  } catch (e) {
    return Response.json({ error: "Transcription failed. Please try again or type your question.", status: e instanceof LlmError ? e.status : null }, { status: 502 });
  }
}
