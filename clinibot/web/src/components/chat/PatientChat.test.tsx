import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApiModule from "@/lib/api";
import { ApiError } from "@/lib/apiError";
import PatientChatPage from "@/pages/chat/PatientChatPage";
import { renderWithProviders } from "@/test/render";
import type { Lang } from "@/i18n";

type CallBody = Record<string, unknown>;

// Plain functions, not vi.fn(): a returned rejected promise must not count as a test failure.
interface FakeApi {
  calls: CallBody[];
  handlers: Record<string, (body: CallBody) => Promise<unknown>>;
}
const api = vi.hoisted((): FakeApi => ({ calls: [], handlers: {} }));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
  isSupabaseConfigured: true,
  initialHref: "",
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  callFunction: (_name: string, body: CallBody) => {
    api.calls.push(body);
    const handler = api.handlers[String(body.action)];
    // Unhandled actions (usually "poll") simply stay in flight.
    return handler ? handler(body) : new Promise(() => {});
  },
}));

const SLUG = "smile-clinic";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";
const STORAGE_KEY = `clinibot.chat.${SLUG}`;

const clinic = {
  name: "Smile Dental",
  slug: SLUG,
  assistant_name: "Sara",
  welcome_message: { ar: "أهلاً بك في عيادة الابتسامة", en: "Welcome to Smile Dental!" },
  privacy_notice: { ar: "نحتفظ بالمحادثة 90 يوماً.", en: "We keep this chat for 90 days." },
  reception_phone: "+966112345678",
  emergency_number: "997",
  default_language: "en",
  assistant_available: true,
};

const welcome = {
  id: "w1",
  direction: "outbound",
  sender: "system",
  body: "Welcome to Smile Dental!",
  created_at: "2026-10-12T10:00:00.000100+00:00",
};

function reject(init: ConstructorParameters<typeof ApiError>[0]): Promise<never> {
  return Promise.reject(new ApiError(init));
}

function callsOf(action: string): CallBody[] {
  return api.calls.filter((body) => body.action === action);
}

function renderChat(lang: Lang = "en") {
  return renderWithProviders(
    <Routes>
      <Route path="/c/:slug" element={<PatientChatPage />} />
    </Routes>,
    { route: `/c/${SLUG}`, lang },
  );
}

async function startChat(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Start the chat" }));
  return screen.findByRole("textbox", { name: "Type your message" });
}

beforeEach(() => {
  api.calls = [];
  api.handlers = {
    profile: () => Promise.resolve({ clinic }),
    start: () => Promise.resolve({ session_token: TOKEN, messages: [welcome] }),
  };
  window.localStorage.setItem("clinibot.lang", "en");
});

describe("PatientChatPage", () => {
  it("explains when the clinic does not exist or has no web chat", async () => {
    api.handlers.profile = () => reject({ status: 404, code: "not_found", message: "nope" });
    renderChat();
    expect(await screen.findByText("This chat isn't available")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /In an emergency, call 997/ })).toHaveAttribute(
      "href",
      "tel:997",
    );
  });

  it("shows the clinic header, emergency line and privacy notice", async () => {
    renderChat();
    expect(await screen.findByRole("heading", { name: "Smile Dental" })).toBeInTheDocument();
    expect(screen.getByText("We keep this chat for 90 days.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call reception at +966112345678" })).toHaveAttribute(
      "href",
      "tel:+966112345678",
    );
    expect(screen.getByRole("link", { name: /In an emergency, call 997/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /CliniBot privacy policy/ })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(callsOf("profile")[0]).toEqual({ action: "profile", slug: SLUG });
  });

  it("uses the clinic's default language until the visitor chooses one", async () => {
    window.localStorage.removeItem("clinibot.lang");
    renderChat("ar");
    expect(await screen.findByRole("button", { name: "Start the chat" })).toBeInTheDocument();
    expect(window.localStorage.getItem("clinibot.lang")).toBeNull();
  });

  it("keeps the visitor's own language choice", async () => {
    window.localStorage.setItem("clinibot.lang", "ar");
    renderChat("ar");
    expect(await screen.findByRole("button", { name: "ابدأ المحادثة" })).toBeInTheDocument();
  });

  it("requires consent, then starts the chat and stores the session", async () => {
    const user = userEvent.setup();
    renderChat();
    await user.click(await screen.findByRole("button", { name: "Start the chat" }));
    expect(
      await screen.findByText("Please accept the privacy notice to start the chat."),
    ).toBeInTheDocument();
    expect(callsOf("start")).toHaveLength(0);

    const composer = await startChat(user);
    expect(callsOf("start")[0]).toEqual({
      action: "start",
      slug: SLUG,
      consent: true,
      language: "en",
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(TOKEN);
    expect(screen.getByText("Welcome to Smile Dental!")).toBeInTheDocument();
    await waitFor(() => expect(composer).toHaveFocus());
  });

  it("shows the visitor's message at once and appends the reply", async () => {
    const user = userEvent.setup();
    let answer: (value: unknown) => void = () => {};
    api.handlers.send = () =>
      new Promise((resolve) => {
        answer = resolve;
      });
    renderChat();
    const composer = await startChat(user);

    await user.type(composer, "How much is cleaning?");
    expect(screen.getByText("21/1000")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(callsOf("send")[0]).toEqual({
      action: "send",
      session_token: TOKEN,
      message: "How much is cleaning?",
    });
    expect(composer).toHaveValue("");
    expect(screen.getByText("How much is cleaning?")).toBeInTheDocument();
    expect(screen.getByText("Sara is writing a reply…")).toBeInTheDocument();

    answer({
      messages: [
        {
          id: "r1",
          direction: "outbound",
          sender: "assistant",
          body: "Cleaning costs 200 SAR.",
          created_at: "2026-10-12T10:00:05+00:00",
        },
      ],
      status: "open",
      ai_paused: false,
    });
    expect(await screen.findByText("Cleaning costs 200 SAR.")).toBeInTheDocument();
    expect(screen.queryByText("Sara is writing a reply…")).not.toBeInTheDocument();
    expect(screen.getByText("New message from Sara: Cleaning costs 200 SAR.")).toBeInTheDocument();
  });

  it("keeps the draft and offers to send again after a network error", async () => {
    const user = userEvent.setup();
    api.handlers.send = () => reject({ status: 0, code: "network_error", message: "offline" });
    renderChat();
    const composer = await startChat(user);

    await user.type(composer, "Are you open today?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Your message wasn't sent")).toBeInTheDocument();
    expect(composer).toHaveValue("Are you open today?");
    expect(screen.queryByText("Are you open today?", { selector: "span" })).not.toBeInTheDocument();

    api.handlers.send = () => Promise.resolve({ messages: [], status: "open", ai_paused: false });
    await user.click(screen.getByRole("button", { name: "Send again" }));
    await waitFor(() => expect(callsOf("send")).toHaveLength(2));
    await waitFor(() =>
      expect(screen.queryByText("Your message wasn't sent")).not.toBeInTheDocument(),
    );
    expect(composer).toHaveValue("");
  });

  it("asks the visitor to wait after too many messages", async () => {
    const user = userEvent.setup();
    api.handlers.send = () =>
      reject({
        status: 429,
        code: "rate_limited",
        message: "slow down",
        details: { retry_after_seconds: 30 },
        requestId: "req-123",
      });
    renderChat();
    const composer = await startChat(user);
    await user.type(composer, "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(/Try again in 30 seconds/)).toBeInTheDocument();
    expect(screen.getByText("req-123")).toBeInTheDocument();
    expect(screen.getByText("Please wait a moment before sending again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(composer).toHaveValue("hello");
  });

  it("says a person will follow up when the clinic takes over", async () => {
    const user = userEvent.setup();
    api.handlers.send = () =>
      Promise.resolve({ messages: [], status: "awaiting_human", ai_paused: true });
    renderChat();
    const composer = await startChat(user);
    await user.type(composer, "I need a doctor");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByText("A member of the clinic team will follow up with you"),
    ).toBeInTheDocument();
  });

  it("says messages still reach reception when the assistant is unavailable", async () => {
    const user = userEvent.setup();
    api.handlers.profile = () =>
      Promise.resolve({ clinic: { ...clinic, assistant_available: false } });
    renderChat();
    await startChat(user);
    expect(
      screen.getByText("The automated assistant isn't available right now"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your messages still reach the clinic's reception team."),
    ).toBeInTheDocument();
  });

  it("continues a stored conversation and merges new messages by id", async () => {
    window.localStorage.setItem(STORAGE_KEY, TOKEN);
    const staff = {
      id: "s1",
      direction: "outbound",
      sender: "staff",
      body: "Hi, this is reception.",
      created_at: "2026-10-12T10:02:00+00:00",
    };
    api.handlers.poll = () =>
      Promise.resolve({ messages: [welcome, staff], status: "open", ai_paused: true });
    renderChat();

    expect(await screen.findByText("Hi, this is reception.")).toBeInTheDocument();
    expect(screen.getByText("Clinic team")).toBeInTheDocument();
    expect(callsOf("poll")[0]).toEqual({ action: "poll", session_token: TOKEN });
    expect(callsOf("start")).toHaveLength(0);
    // History is shown, not read out.
    expect(screen.queryByText(/New message from/)).not.toBeInTheDocument();
  });

  it("goes back to the consent screen when the stored conversation is gone", async () => {
    window.localStorage.setItem(STORAGE_KEY, TOKEN);
    api.handlers.poll = () => reject({ status: 404, code: "not_found", message: "gone" });
    renderChat();
    expect(
      await screen.findByText(/Your previous conversation has ended or was deleted/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start the chat" })).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("deletes the conversation after confirmation", async () => {
    const user = userEvent.setup();
    api.handlers.delete = () => Promise.resolve({ deleted: true });
    renderChat();
    await startChat(user);

    await user.click(screen.getByRole("button", { name: "Chat options" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete my conversation" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete your conversation?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete conversation" }));

    expect(
      await screen.findByText(/Your conversation and all its messages were deleted/),
    ).toBeInTheDocument();
    expect(callsOf("delete")[0]).toEqual({ action: "delete", session_token: TOKEN });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Before we start" })).toHaveFocus(),
    );
  });

  it("starts a new chat without deleting the old one", async () => {
    const user = userEvent.setup();
    renderChat();
    await startChat(user);
    await user.click(screen.getByRole("button", { name: "Chat options" }));
    await user.click(screen.getByRole("menuitem", { name: "Start a new chat" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Start a new chat?" });
    await user.click(within(dialog).getByRole("button", { name: "Start new chat" }));

    expect(await screen.findByText(/Your previous conversation is still kept/)).toBeInTheDocument();
    expect(callsOf("delete")).toHaveLength(0);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("sends with Enter on a desktop keyboard and adds a line with Shift+Enter", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: true,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    const user = userEvent.setup();
    api.handlers.send = () => Promise.resolve({ messages: [], status: "open", ai_paused: false });
    renderChat();
    const composer = await startChat(user);
    await user.type(composer, "line one{Shift>}{Enter}{/Shift}line two");
    expect(composer).toHaveValue("line one\nline two");
    await user.type(composer, "{Enter}");
    await waitFor(() => expect(callsOf("send")).toHaveLength(1));
    expect(callsOf("send")[0]?.message).toBe("line one\nline two");
  });

  it("blocks messages over 1000 characters", async () => {
    const user = userEvent.setup();
    renderChat();
    const composer = await startChat(user);
    await user.click(composer);
    await user.paste("x".repeat(1001));
    expect(
      screen.getByText("Your message is longer than 1,000 characters. Please shorten it."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});
