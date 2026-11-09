"use client";

import { Bot, Send, Square, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppState } from "@/lib/store";
import { VoiceControls } from "./VoiceControls";

interface Msg {
  role: "user" | "assistant";
  content: string;
  /** which engine answered (assistant only) */
  by?: { provider: string; model: string | null; reason: string | null };
  error?: boolean;
}

const CHIPS = [
  "Should I wear a mask today?",
  "Is it safe to go for a run right now?",
  "When is the best time to go outside?",
  "Will the air get better this week?",
  "Which pollutant is the problem right now?",
  "How much can I trust this reading?",
];

const REASONS: Record<string, string> = {
  no_ai_configured: "no AI model is configured on this server",
  daily_cap: "the daily AI limit was reached",
  providers_unavailable: "the AI providers were unavailable",
};

const MAX_LEN = 500;

function engineLabel(by: NonNullable<Msg["by"]>) {
  if (by.provider === "basic") return `Basic mode (rule-based answers from the live data), because ${REASONS[by.reason ?? ""] ?? "no AI model could answer"}.`;
  return `Answered by ${by.provider === "gemini" ? "Gemini" : "Groq"}${by.model ? ` · ${by.model}` : ""}. AI can make mistakes; it was only given the live data shown on this site.`;
}

export function AssistantPage() {
  const { current } = useAppState();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speakNext, setSpeakNext] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [speakFn, setSpeakFn] = useState<((t: string) => void) | null>(null);
  const [voiceMsg, setVoiceMsg] = useState("");
  const onSpeakReady = useCallback((fn: (t: string) => void) => setSpeakFn(() => fn), []);
  const onVoiceText = useCallback((t: string) => void sendRef.current?.(t, true), []);
  const sendRef = useRef<((t: string, v?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [msgs]);

  const send = useCallback(
    async (text: string, viaVoice = false) => {
      const q = text.trim().slice(0, MAX_LEN);
      if (!q || busy) return;
      const history: Msg[] = [...msgs.filter((m) => !m.error), { role: "user", content: q }];
      setMsgs([...history, { role: "assistant", content: "" }]);
      setInput("");
      setBusy(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: history.slice(-6).map((m) => ({ role: m.role, content: m.content })), lat: current.lat, lon: current.lon, name: current.name }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          let msg = `Something went wrong (${res.status}).`;
          try {
            const j = await res.json();
            if (res.status === 429) msg = `You're asking quickly. Please wait ${j.retryAfterSec ?? 30} seconds and try again.`;
            else if (j?.error) msg = String(j.error);
          } catch {
            /* ignore */
          }
          setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: msg, error: true }]);
          return;
        }
        const by = { provider: res.headers.get("x-llm-provider") ?? "basic", model: res.headers.get("x-llm-model"), reason: res.headers.get("x-basic-reason") };
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let acc = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: acc, by }]);
        }
        if ((viaVoice || speakNext) && speakFn) speakFn(acc);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: "I couldn't reach the server. Check your connection and try again.", error: true }]);
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, msgs, current, speakNext, speakFn],
  );

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Ask Saans</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          An assistant for <strong>{current.name}</strong>. It is given the live readings, forecast and recent history first, and may only quote numbers from them. Anything else, it says “I don’t have that data.”
        </p>
      </div>

      <div className="card flex min-h-[22rem] flex-col p-4">
        <div className="flex-1 space-y-4" role="log" aria-live="polite" aria-label="Conversation">
          {!msgs.length && (
            <div className="py-6 text-center">
              <Bot aria-hidden size={32} className="mx-auto text-[color:var(--muted)]" />
              <p className="mt-2 font-display text-xl">What would you like to know?</p>
              <p className="text-sm text-[color:var(--muted)]">Pick a question or type your own.</p>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--accent)] text-[color:var(--accent-ink)]"><Bot size={16} aria-hidden /></span>}
              <div className={`max-w-[85%] ${m.role === "user" ? "rounded-2xl bg-[color:var(--ink)] px-4 py-2 text-[color:var(--bg)]" : ""}`}>
                <p className={`whitespace-pre-wrap leading-relaxed ${m.error ? "text-red-700 dark:text-red-300" : ""}`}>{m.content || (busy && i === msgs.length - 1 ? "Thinking…" : "")}</p>
                {m.by && m.content && <p className="mt-1.5 text-[11px] text-[color:var(--muted)]">{engineLabel(m.by)}</p>}
              </div>
              {m.role === "user" && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[color:var(--border)]"><User size={16} aria-hidden /></span>}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Suggested questions">
          {CHIPS.map((c) => (
            <li key={c}>
              <button type="button" disabled={busy} onClick={() => send(c)} className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[color:var(--surface-2)] disabled:opacity-50">
                {c}
              </button>
            </li>
          ))}
        </ul>

        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <div className="flex-1">
            <label htmlFor="ask" className="sr-only">Your question</label>
            <textarea
              id="ask"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={2}
              maxLength={MAX_LEN}
              placeholder="Ask about masks, exercise, the forecast…"
              className="w-full resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm"
            />
            <p className="text-right text-[11px] text-[color:var(--muted)]">{input.length}/{MAX_LEN}</p>
          </div>
          <VoiceControls disabled={busy} onTranscript={onVoiceText} onSpeakReady={onSpeakReady} speakNext={speakNext} onSpeakNext={setSpeakNext} onStatus={setVoiceMsg} />
          {busy ? (
            <button type="button" onClick={() => abortRef.current?.abort()} className="grid h-11 w-11 place-items-center rounded-full border border-[color:var(--border)]" aria-label="Stop generating">
              <Square size={16} aria-hidden />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="grid h-11 w-11 place-items-center rounded-full bg-[color:var(--ink)] text-[color:var(--bg)] disabled:opacity-40" aria-label="Send question">
              <Send size={16} aria-hidden />
            </button>
          )}
        </form>
        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-xs text-[color:var(--muted)]">{voiceMsg}</p>
      </div>
      <p className="text-xs text-[color:var(--muted)]">General information, not medical advice. Questions are sent to our server and an AI provider (Gemini or Groq) together with the live data for {current.name}; nothing is stored. Voice: hold the mic to speak (max 30 s); audio is transcribed by Groq Whisper and never stored. Rate-limited to protect free quotas.</p>
    </div>
  );
}
