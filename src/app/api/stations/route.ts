import { z } from "zod";
import { latSchema, lonSchema, parseQuery } from "@/lib/api";
import { getWaqiBounds } from "@/lib/sources/waqi";

const schema = z
  .object({ south: latSchema, west: lonSchema, north: latSchema, east: lonSchema })
  .refine((v) => v.north > v.south && v.east > v.west, "north/east must exceed south/west")
  .refine((v) => v.north - v.south <= 30 && v.east - v.west <= 40, "Area too large: zoom in to see stations");

/** Snap the box outward to a 0.1° grid so nearby pans share one cached WAQI upstream call. */
const floor1 = (n: number) => Math.floor(n * 10) / 10;
const ceil1 = (n: number) => Math.ceil(n * 10) / 10;

export async function GET(req: Request) {
  const q = parseQuery(req, schema);
  if ("response" in q) return q.response;
  const { south, west, north, east } = q.data;
  const r = await getWaqiBounds(floor1(south), floor1(west), ceil1(north), ceil1(east));
  if (!r.ok) return Response.json({ error: r.error, code: r.code, meta: r.meta }, { status: r.code === "no_key" ? 503 : 502 });
  return Response.json({ stations: r.data, meta: r.meta });
}
