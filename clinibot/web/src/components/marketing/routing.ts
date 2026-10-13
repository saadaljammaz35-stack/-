import type { MessageKey } from "@/i18n";

/**
 * The fixed illustration behind "See how the assistant responds". It mirrors
 * the assistant's routing rules (supabase/functions/_shared/assistant):
 * emergencies are caught first and answered without the model, medical
 * questions are handed to staff, appointment wishes become requests the
 * clinic confirms, and everything else is answered from approved
 * information only. It is NOT a live AI call.
 */

export type RouteId = "answer" | "booking" | "handoff" | "emergency";
export type ScenarioId = "price" | "booking" | "medical" | "emergency";

/** Destinations in the order they are drawn. */
export const ROUTES: ReadonlyArray<{ id: RouteId; label: MessageKey; result: MessageKey }> = [
  { id: "answer", label: "marketing.routeAnswer", result: "marketing.resultAnswer" },
  { id: "booking", label: "marketing.routeBooking", result: "marketing.resultBooking" },
  { id: "handoff", label: "marketing.routeHandoff", result: "marketing.resultHandoff" },
  { id: "emergency", label: "marketing.routeEmergency", result: "marketing.resultEmergency" },
];

export const SCENARIOS: ReadonlyArray<{ id: ScenarioId; message: MessageKey; route: RouteId }> = [
  { id: "price", message: "marketing.demoMsgPrice", route: "answer" },
  { id: "booking", message: "marketing.demoMsgBooking", route: "booking" },
  { id: "medical", message: "marketing.demoMsgMedical", route: "handoff" },
  { id: "emergency", message: "marketing.demoMsgEmergency", route: "emergency" },
];

/** Rule precedence, highest first (an emergency outranks everything). */
export const RULE_PRECEDENCE: readonly RouteId[] = ["emergency", "handoff", "booking", "answer"];

export function routeFor(scenario: ScenarioId): RouteId {
  const found = SCENARIOS.find((item) => item.id === scenario);
  if (!found) throw new Error(`Unknown scenario: ${scenario}`);
  return found.route;
}

export function routeIndex(route: RouteId): number {
  return ROUTES.findIndex((item) => item.id === route);
}

export function routeInfo(route: RouteId) {
  const info = ROUTES.find((item) => item.id === route);
  if (!info) throw new Error(`Unknown route: ${route}`);
  return info;
}

/**
 * Animation stages after a message is picked:
 * 0 nothing chosen · 1 the message appears · 2 CliniBot reads it · 3 the path,
 * the destination and the explanation are shown.
 */
export type Stage = 0 | 1 | 2 | 3;
export const FINAL_STAGE: Stage = 3;

/** When each stage starts (ms after the pick). Reduced motion jumps to the end. */
export function stageTimeline(reduced: boolean): ReadonlyArray<{ stage: Stage; at: number }> {
  if (reduced) return [{ stage: FINAL_STAGE, at: 0 }];
  return [
    { stage: 1, at: 0 },
    { stage: 2, at: 380 },
    { stage: 3, at: 820 },
  ];
}

/**
 * How far the trunk's lit fill runs through each destination row: rows above
 * the chosen one are passed completely, the chosen row to its middle (where
 * its branch leaves), rows below not at all. The last row's track already
 * stops at its middle, so it fills completely when chosen.
 */
export function trunkFill(rowIndex: number, chosenIndex: number, rowCount: number): number {
  if (chosenIndex < 0 || rowIndex > chosenIndex) return 0;
  if (rowIndex < chosenIndex) return 1;
  return rowIndex === rowCount - 1 ? 1 : 0.5;
}

/** Stagger for the trunk fill so the path travels row by row (ms). */
export function trunkDelay(rowIndex: number): number {
  return rowIndex * 110;
}
