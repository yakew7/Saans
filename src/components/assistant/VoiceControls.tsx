"use client";

import { Loader2, Mic, Square, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const MAX_SECONDS = 30;
const MAX_BYTES = 2 * 1024 * 1024;

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecCtor = new () => SpeechRec;

function recognitionCtor(): SpeechRecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecCtor; webkitSpeechRecognition?: SpeechRecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t));
}

type Phase = "idle" | "recording" | "transcribing";

/**
 * Push-to-talk. Primary path: record in the browser (MediaRecorder, works in Chrome, Safari and Firefox), send to
 * /api/transcribe (Groq Whisper, audio never stored). If cloud transcription is unavailable we fall back to the
 * browser's SpeechRecognition where it exists, otherwise explain that voice input is unsupported.
 */
export function VoiceControls({
  disabled,
  onTranscript,
  onSpeakReady,
  speakNext,
  onSpeakNext,
  onStatus,
}: {
  disabled: boolean;
  onTranscript: (text: string) => void;
  onSpeakReady: (speak: (text: string) => void) => void;
  speakNext: boolean;
  onSpeakNext: (v: boolean) => void;
  onStatus: (msg: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [useBrowserSr, setUseBrowserSr] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sr = useRef<SpeechRec | null>(null);
  const chunks = useRef<Blob[]>([]);
  // false on the server and during hydration, then the real capability (avoids a hydration mismatch)
  const canSpeak = useSyncExternalStore(
    () => () => {},
    () => "speechSynthesis" in window,
    () => false,
  );

  useEffect(() => {
    if (!canSpeak) return;
    onSpeakReady((text: string) => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[*_#`]/g, "").replace(/\s+/g, " ").trim());
      u.lang = "en-IN";
      window.speechSynthesis.speak(u);
    });
    return () => window.speechSynthesis.cancel();
  }, [canSpeak, onSpeakReady]);

  const cleanup = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const startBrowserSr = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      onStatus("Voice input isn't supported in this browser. You can type your question instead.");
      return;
    }
    const r = new Ctor();
    r.lang = "en-IN";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript?.trim();
      if (t) onTranscript(t);
      else onStatus("I didn't catch that. Please try again.");
    };
    r.onerror = (e) => onStatus(e.error === "not-allowed" ? "Microphone permission was denied." : "Browser speech recognition failed. Please type your question.");
    r.onend = () => setPhase("idle");
    sr.current = r;
    setPhase("recording");
    onStatus("Listening (browser speech recognition)… release to finish.");
    r.start();
  }, [onStatus, onTranscript]);

  const transcribe = useCallback(
    async (blob: Blob) => {
      setPhase("transcribing");
      onStatus("Transcribing…");
      try {
        const form = new FormData();
        form.append("audio", blob, "speech");
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        if (res.status === 503) {
          setUseBrowserSr(true);
          onStatus(recognitionCtor() ? "Cloud transcription isn't set up here. Press and hold the mic again to use your browser's speech recognition." : "Voice input isn't available: cloud transcription isn't configured and this browser has no speech recognition. Please type your question.");
          return;
        }
        const j = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok) {
          onStatus(res.status === 429 ? j.error ?? "Too many requests. Try again in a moment." : j.error ?? "Transcription failed. Please type your question.");
          return;
        }
        if (!j.text) onStatus("I didn't catch that. Please try again, speaking a little closer to the mic.");
        else {
          onStatus(`Heard: “${j.text}”`);
          onTranscript(j.text);
        }
      } catch {
        onStatus("Couldn't reach the server for transcription. Please type your question.");
      } finally {
        setPhase("idle");
      }
    },
    [onStatus, onTranscript],
  );

  const start = useCallback(async () => {
    if (disabled || phase !== "idle") return;
    window.speechSynthesis?.cancel();
    if (useBrowserSr) return startBrowserSr();
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return startBrowserSr();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const mime = pickMime();
      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        cleanup();
        const blob = new Blob(chunks.current, { type: rec.mimeType || mime || "audio/webm" });
        if (blob.size < 800) {
          setPhase("idle");
          onStatus("That was too short. Press and hold the mic while you speak.");
        } else if (blob.size > MAX_BYTES) {
          setPhase("idle");
          onStatus("That recording was too long. Please keep it under 30 seconds.");
        } else void transcribe(blob);
      };
      recorder.current = rec;
      rec.start();
      setPhase("recording");
      onStatus(`Recording… release to send (max ${MAX_SECONDS} s).`);
      timer.current = setTimeout(() => rec.state === "recording" && rec.stop(), MAX_SECONDS * 1000);
    } catch (e) {
      cleanup();
      const name = (e as Error).name;
      onStatus(name === "NotAllowedError" || name === "SecurityError" ? "Microphone permission was denied. Allow it in your browser settings, or type your question." : "No microphone was found. You can type your question instead.");
    }
  }, [cleanup, disabled, onStatus, phase, startBrowserSr, transcribe, useBrowserSr]);

  const stop = useCallback(() => {
    if (sr.current && phase === "recording") {
      sr.current.stop();
      sr.current = null;
    } else if (recorder.current?.state === "recording") recorder.current.stop();
  }, [phase]);

  const recording = phase === "recording";
  return (
    <>
      <button
        type="button"
        disabled={disabled || phase === "transcribing"}
        aria-label={recording ? "Release to send your question" : "Hold to speak your question"}
        aria-pressed={recording}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          void start();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            void start();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") stop();
        }}
        className={`grid h-11 w-11 shrink-0 touch-none select-none place-items-center rounded-full border transition-colors ${recording ? "border-red-600 bg-red-600 text-white motion-safe:animate-pulse" : "border-[color:var(--border)] hover:bg-[color:var(--surface-2)]"} disabled:opacity-50`}
      >
        {phase === "transcribing" ? <Loader2 size={18} className="animate-spin" aria-hidden /> : recording ? <Square size={16} aria-hidden /> : <Mic size={18} aria-hidden />}
      </button>
      {canSpeak && (
        <button
          type="button"
          aria-pressed={speakNext}
          aria-label={speakNext ? "Spoken answers on" : "Spoken answers off"}
          title="Read answers aloud"
          onClick={() => {
            if (speakNext) window.speechSynthesis.cancel();
            onSpeakNext(!speakNext);
          }}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${speakNext ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--bg)]" : "border-[color:var(--border)] hover:bg-[color:var(--surface-2)]"}`}
        >
          {speakNext ? <Volume2 size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />}
        </button>
      )}
    </>
  );
}
