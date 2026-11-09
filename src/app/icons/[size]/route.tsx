import { ImageResponse } from "next/og";

const SIZES: Record<string, { px: number; pad: number; radius: number }> = {
  "192": { px: 192, pad: 0, radius: 40 },
  "512": { px: 512, pad: 0, radius: 108 },
  maskable: { px: 512, pad: 80, radius: 0 }, // full-bleed with a safe zone for adaptive icon masks
};

/** App icons generated at request time (no binary assets in the repo). */
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const cfg = SIZES[size];
  if (!cfg) return new Response("Not found", { status: 404 });
  const { px, pad, radius } = cfg;
  const inner = px - pad * 2;
  const res = new ImageResponse(
    (
      <div style={{ width: px, height: px, display: "flex", alignItems: "center", justifyContent: "center", background: "#0b6b63", borderRadius: radius }}>
        <svg width={inner * 0.62} height={inner * 0.62} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
          <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
          <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
  res.headers.set("cache-control", "public, max-age=604800, immutable");
  return res;
}
