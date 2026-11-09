import { describe, expect, it } from "vitest";
import { evaluateRule, HYSTERESIS, newRule, REMINDER_MS } from "./alerts";

const base = () => newRule({ name: "Delhi", lat: 1, lon: 2 }, 150);

describe("evaluateRule", () => {
  it("fires once when AQI crosses the threshold, then stays quiet", () => {
    let r = base();
    let e = evaluateRule(r, 120, 1000);
    expect(e.fire).toBe(false);
    e = evaluateRule(r, 160, 2000);
    expect(e.fire).toBe(true);
    r = e.next;
    expect(r.armed).toBe(false);
    expect(evaluateRule(r, 170, 3000).fire).toBe(false);
  });
  it("re-arms only after dropping below threshold minus hysteresis, then fires again", () => {
    let r = evaluateRule(base(), 160, 1).next;
    r = evaluateRule(r, 150 - HYSTERESIS + 1, 2).next; // not low enough
    expect(r.armed).toBe(false);
    r = evaluateRule(r, 150 - HYSTERESIS, 3).next;
    expect(r.armed).toBe(true);
    expect(evaluateRule(r, 155, 4).fire).toBe(true);
  });
  it("sends a reminder after 6 hours while still above", () => {
    const r = evaluateRule(base(), 200, 0).next;
    expect(evaluateRule(r, 200, REMINDER_MS - 1).fire).toBe(false);
    expect(evaluateRule(r, 200, REMINDER_MS).fire).toBe(true);
  });
  it("never fires when disabled", () => {
    expect(evaluateRule({ ...base(), enabled: false }, 400, 0).fire).toBe(false);
  });
});
