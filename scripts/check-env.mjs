// Reports which environment variables are set (booleans only, never values).
try {
  process.loadEnvFile(".env.local");
} catch {
  console.log("(no .env.local found — reading process environment only)\n");
}

const vars = [
  ["OPENAQ_API_KEY", "required", "Measured raw concentrations + history. Without it: falls back to WAQI measured, then modelled data; History uses modelled data."],
  ["WAQI_API_TOKEN", "required", "Map, heatmap, leaderboard, clean-air finder, WAQI forecast. Without it: those features are unavailable or fall back to modelled data."],
  ["GEMINI_API_KEY", "optional", "AI assistant / insights (primary). Without it: Groq is used, else rule-based basic mode."],
  ["GROQ_API_KEY", "optional", "AI failover + voice transcription. Without it: Gemini only; voice uses browser SpeechRecognition if available."],
  ["LLM_PROVIDER", "optional", "auto | gemini | groq | none (default auto)."],
  ["GEMINI_MODEL", "optional", "Defaults to gemini-3.6-flash."],
  ["GROQ_MODEL", "optional", "Defaults to openai/gpt-oss-120b."],
  ["GROQ_FALLBACK_MODEL", "optional", "Defaults to openai/gpt-oss-20b."],
  ["GROQ_WHISPER_MODEL", "optional", "Defaults to whisper-large-v3-turbo."],
  ["AI_DAILY_CAP", "optional", "Daily cap on AI + transcription requests (default 500)."],
  ["NEXT_PUBLIC_SITE_URL", "optional", "Public URL for Open Graph / share cards (not a secret)."],
];

let missingRequired = 0;
for (const [name, level, effect] of vars) {
  const set = Boolean(process.env[name] && process.env[name].trim());
  if (!set && level === "required") missingRequired++;
  console.log(`${set ? "SET    " : "MISSING"}  ${name.padEnd(22)} (${level})${set ? "" : "  -> " + effect}`);
}
console.log(missingRequired ? `\n${missingRequired} required variable(s) missing; app will run in degraded mode.` : "\nAll required variables are set.");
