import { NextResponse, type NextRequest } from "next/server";
import { getPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/availability?serviceId=…&date=YYYY-MM-DD → { slots: string[], reason: string | null } */
export async function GET(request: NextRequest) {
  const serviceId = request.nextUrl.searchParams.get("serviceId") ?? "";
  const date = request.nextUrl.searchParams.get("date") ?? "";
  const headers = { "Cache-Control": "no-store" };

  if (!UUID.test(serviceId) || !DATE.test(date)) {
    return NextResponse.json({ slots: [], reason: "INVALID_DATE" }, { status: 400, headers });
  }
  const supabase = getPublicClient();
  if (!supabase) {
    return NextResponse.json({ slots: [], reason: "NOT_CONFIGURED" }, { status: 503, headers });
  }
  const { data, error } = await supabase.rpc("get_available_slots", { p_service_id: serviceId, p_date: date });
  if (error) {
    console.error("[availability]", error);
    return NextResponse.json({ slots: [], reason: "ERROR" }, { status: 500, headers });
  }
  return NextResponse.json(data, { headers });
}
