import { z } from "zod";
import { badRequest } from "@/lib/api";
import { getWaqiFeedByUid } from "@/lib/sources/waqi";

const schema = z.object({ uid: z.coerce.number().int().positive() });

export async function GET(_req: Request, ctx: { params: Promise<{ uid: string }> }) {
  const p = schema.safeParse(await ctx.params);
  if (!p.success) return badRequest(p.error);
  const r = await getWaqiFeedByUid(p.data.uid);
  if (!r.ok) return Response.json({ error: r.error, code: r.code, meta: r.meta }, { status: r.code === "no_key" ? 503 : r.code === "empty" ? 404 : 502 });
  return Response.json({ station: r.data, meta: r.meta });
}
