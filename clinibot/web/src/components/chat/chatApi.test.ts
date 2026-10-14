import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/apiError";
import { parseMessage, parseMessages, parseProfile, parseStart, parseTurn } from "./chatApi";

const message = {
  id: "m1",
  direction: "outbound",
  sender: "assistant",
  body: "أهلاً",
  created_at: "2026-10-12T10:00:00.123456+00:00",
};

describe("parseMessage(s)", () => {
  it("accepts the documented shape", () => {
    expect(parseMessage(message)).toEqual(message);
  });

  it("skips malformed messages instead of failing the whole list", () => {
    expect(
      parseMessages([
        message,
        { ...message, id: "" },
        { ...message, id: "m2", sender: "robot" },
        { ...message, id: "m3", created_at: "soon" },
        { ...message, id: "m4", body: 5 },
        null,
        "text",
      ]),
    ).toEqual([message]);
    expect(parseMessages(undefined)).toEqual([]);
  });
});

describe("parseProfile", () => {
  const clinic = {
    name: "عيادة الابتسامة",
    slug: "smile",
    assistant_name: "سارة",
    welcome_message: { ar: "مرحباً", en: "Hello" },
    privacy_notice: { ar: "إشعار", en: "Notice" },
    reception_phone: "+966551234567",
    emergency_number: "997",
    default_language: "en",
    assistant_available: true,
  };

  it("reads the clinic profile", () => {
    expect(parseProfile({ clinic })).toEqual(clinic);
  });

  it("fills safe defaults for missing optional fields", () => {
    const profile = parseProfile({
      clinic: { name: "X", slug: "x-1", reception_phone: null, emergency_number: "abc" },
    });
    expect(profile).toMatchObject({
      assistant_name: "CliniBot",
      welcome_message: { ar: "", en: "" },
      privacy_notice: { ar: "", en: "" },
      reception_phone: null,
      emergency_number: "997",
      default_language: "ar",
      assistant_available: false,
    });
  });

  it("rejects a response without a clinic", () => {
    expect(() => parseProfile({})).toThrow(ApiError);
    expect(() => parseProfile({ clinic: { slug: "x" } })).toThrow(ApiError);
  });
});

describe("parseTurn / parseStart", () => {
  it("reads messages and conversation state", () => {
    expect(parseTurn({ messages: [message], status: "awaiting_human", ai_paused: true })).toEqual({
      messages: [message],
      status: "awaiting_human",
      ai_paused: true,
    });
    expect(parseTurn({ messages: [], status: "weird" })).toEqual({
      messages: [],
      status: "open",
      ai_paused: false,
    });
    expect(() => parseTurn(null)).toThrow(ApiError);
  });

  it("requires a session token on start", () => {
    expect(parseStart({ session_token: "tok", messages: [message] })).toEqual({
      session_token: "tok",
      messages: [message],
    });
    expect(() => parseStart({ messages: [] })).toThrow(ApiError);
  });
});
