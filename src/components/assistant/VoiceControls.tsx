"use client";

import { Mic } from "lucide-react";

/** Placeholder replaced in the voice commit: renders nothing until voice input is wired up. */
export function VoiceControls(_props: {
  disabled: boolean;
  onTranscript: (text: string) => void;
  onSpeakReady: (speak: (text: string) => void) => void;
  speakNext: boolean;
  onSpeakNext: (v: boolean) => void;
}) {
  void Mic;
  return null;
}
