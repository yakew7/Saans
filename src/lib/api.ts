import { z } from "zod";

export const latSchema = z.coerce.number().min(-90).max(90);
export const lonSchema = z.coerce.number().min(-180).max(180);
export const coordSchema = z.object({ lat: latSchema, lon: lonSchema });
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export function badRequest(err: z.ZodError) {
  return Response.json({ error: "Invalid request", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
}

/** Parse URLSearchParams against a schema; returns data or a ready 400 Response. */
export function parseQuery<T extends z.ZodTypeAny>(req: Request, schema: T): { data: z.infer<T> } | { response: Response } {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const r = schema.safeParse(params);
  return r.success ? { data: r.data } : { response: badRequest(r.error) };
}
