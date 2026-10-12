import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { SERVICE_WINDOW_MS, withinServiceWindow } from "./window.ts";

const NOW = new Date("2026-10-12T12:00:00.000Z");

Deno.test("a message received just now is inside the window", () => {
  assert(withinServiceWindow(new Date(NOW.getTime() - 1000), NOW));
});

Deno.test("one millisecond before 24 hours is inside; exactly 24 hours is outside", () => {
  assert(withinServiceWindow(new Date(NOW.getTime() - SERVICE_WINDOW_MS + 1), NOW));
  assertEquals(withinServiceWindow(new Date(NOW.getTime() - SERVICE_WINDOW_MS), NOW), false);
  assertEquals(withinServiceWindow(new Date(NOW.getTime() - SERVICE_WINDOW_MS - 1), NOW), false);
});

Deno.test("ISO strings from the database are accepted", () => {
  assert(withinServiceWindow("2026-10-11T12:00:00.001+00:00", NOW));
  assertEquals(withinServiceWindow("2026-10-11T12:00:00+00:00", NOW), false);
});

Deno.test("no inbound message, or an unreadable timestamp, means the window is closed", () => {
  assertEquals(withinServiceWindow(null, NOW), false);
  assertEquals(withinServiceWindow("not a date", NOW), false);
  assertEquals(withinServiceWindow(new Date(Number.NaN), NOW), false);
});

Deno.test("a timestamp slightly ahead of this clock counts as fresh", () => {
  assert(withinServiceWindow(new Date(NOW.getTime() + 2000), NOW));
});
