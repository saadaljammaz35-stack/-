// WhatsApp's customer service window: a business may send free-form messages
// only within 24 hours of the customer's last message. Outside it only an
// approved template can be sent; Meta would reject anything else with 131047.

export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function withinServiceWindow(lastInboundAt: string | Date | null, now: Date = new Date()): boolean {
  if (lastInboundAt === null) return false;
  const at = lastInboundAt instanceof Date ? lastInboundAt.getTime() : Date.parse(lastInboundAt);
  if (!Number.isFinite(at)) return false;
  // A timestamp slightly ahead of this clock (database vs. function clock skew) is still a fresh message.
  return now.getTime() - at < SERVICE_WINDOW_MS;
}
