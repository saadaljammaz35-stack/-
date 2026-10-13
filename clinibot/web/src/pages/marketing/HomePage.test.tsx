import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiError";
import { renderWithProviders } from "@/test/render";
import HomePage from "./HomePage";

const mocks = vi.hoisted(() => {
  const order = vi.fn();
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));
  return { order, select, from, callFunction: vi.fn() };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { from: mocks.from },
  isSupabaseConfigured: true,
  initialHref: "",
}));

vi.mock("@/lib/api", () => ({ callFunction: mocks.callFunction }));

const PLAN_ROWS = [
  {
    plan: "growth",
    name_ar: "النمو",
    name_en: "Growth",
    monthly_price_sar: 699,
    ai_replies_per_month: 5000,
    seats: 6,
    sort_order: 2,
  },
  {
    plan: "starter",
    name_ar: "الأساسية",
    name_en: "Starter",
    monthly_price_sar: 299,
    ai_replies_per_month: 1000,
    seats: 3,
    sort_order: 1,
  },
];

function mockReducedMotion(reduced: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: reduced && query.includes("reduce"),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

beforeEach(() => {
  mocks.from.mockImplementation(() => ({ select: mocks.select }));
  mocks.select.mockImplementation(() => ({ order: mocks.order }));
  mocks.order.mockResolvedValue({ data: PLAN_ROWS, error: null });
  mocks.callFunction.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  const form = screen.getByRole("form", { name: "Request details" });
  await user.type(within(form).getByLabelText(/Clinic name/), "Smile Dental");
  await user.type(within(form).getByLabelText(/Your name/), "Sara");
  await user.type(within(form).getByLabelText(/Mobile number/), "055 123 4567");
  await user.click(within(form).getByRole("checkbox"));
  return form;
}

describe("HomePage", () => {
  it("renders the Arabic landing page with its landmarks and sections", async () => {
    renderWithProviders(<HomePage />, { lang: "ar" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("موظف استقبال ذكي لعيادتك");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent("CliniBot لا يقدم استشارات طبية.");
    expect(screen.getByRole("link", { name: "انتقل إلى المحتوى" })).toHaveAttribute(
      "href",
      "#main",
    );

    const nav = screen.getByRole("navigation", { name: "أقسام الصفحة" });
    const expected: Array<[string, string]> = [
      ["الرئيسية", "#home"],
      ["المميزات", "#features"],
      ["كيف يعمل", "#how-it-works"],
      ["الأسعار", "#pricing"],
      ["الأسئلة الشائعة", "#faq"],
      ["تواصل معنا", "#contact"],
    ];
    for (const [name, href] of expected) {
      expect(within(nav).getByRole("link", { name })).toHaveAttribute("href", href);
      expect(document.getElementById(href.slice(1))).not.toBeNull();
    }

    expect(screen.getByRole("banner")).toContainElement(
      screen.getAllByRole("link", { name: "ابدأ الآن" })[0]!,
    );
    for (const link of screen.getAllByRole("link", { name: "ابدأ الآن" })) {
      expect(link).toHaveAttribute("href", "/register");
    }
    expect(screen.getAllByRole("link", { name: "تسجيل الدخول" })[0]).toHaveAttribute(
      "href",
      "/login",
    );

    // The phone shows a clearly labelled example.
    expect(screen.getByText("مثال توضيحي")).toBeInTheDocument();
    expect(
      screen.getByRole("figure", { name: "مثال توضيحي لمحادثة بين مريض ومساعد العيادة" }),
    ).toBeInTheDocument();

    // Plans come from the database, sorted, priced in SAR.
    expect(await screen.findByText("299 ر.س")).toBeInTheDocument();
    expect(screen.getByText("699 ر.س")).toBeInTheDocument();
    const planNames = screen.getAllByRole("heading", { level: 3, name: /الأساسية|النمو/ });
    expect(planNames.map((heading) => heading.textContent)).toEqual(["الأساسية", "النمو"]);
    expect(screen.getAllByText("غير شامل ضريبة القيمة المضافة")).toHaveLength(2);
    expect(mocks.from).toHaveBeenCalledWith("plan_limits");
    expect(mocks.select).toHaveBeenCalledWith(
      "plan,name_ar,name_en,monthly_price_sar,ai_replies_per_month,seats,sort_order",
    );
    expect(mocks.order).toHaveBeenCalledWith("sort_order");
  });

  it("shows an error with a retry when plans cannot load, and no made-up prices", async () => {
    mocks.order.mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501", details: null, hint: null },
    });
    renderWithProviders(<HomePage />, { lang: "en" });
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText(/SAR \d/)).toBeNull();
  });

  it("says so when no plans are published", async () => {
    mocks.order.mockResolvedValue({ data: [], error: null });
    renderWithProviders(<HomePage />, { lang: "en" });
    expect(
      await screen.findByText("No plans are published right now. Contact us for pricing."),
    ).toBeInTheDocument();
  });

  it("opens the mobile menu as a dialog with the section links", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />, { lang: "en" });
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(within(dialog).getByRole("link", { name: "Pricing" })).toHaveAttribute(
      "href",
      "#pricing",
    );
    await user.click(within(dialog).getByRole("link", { name: "FAQ" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  describe("routing illustration", () => {
    it("shows the emergency path at once with reduced motion", async () => {
      mockReducedMotion(true);
      const user = userEvent.setup();
      renderWithProviders(<HomePage />, { lang: "en" });
      expect(
        screen.getByText("A fixed illustration of the routing rules, not a live AI conversation."),
      ).toBeInTheDocument();
      const button = screen.getByRole("button", { name: "Severe chest pain" });
      await user.click(button);
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText(/A fixed message goes out right away/)).toBeInTheDocument();
      expect(screen.getByText("Chosen path: Emergency guidance: call 997")).toBeInTheDocument();
    });

    it("animates to the medical handoff path", async () => {
      mockReducedMotion(false);
      const user = userEvent.setup();
      renderWithProviders(<HomePage />, { lang: "en" });
      await user.click(screen.getByRole("button", { name: "My tooth hurts, what should I take?" }));
      expect(
        await screen.findByText(/It suggests no medicine and makes no diagnosis/, undefined, {
          timeout: 3000,
        }),
      ).toBeInTheDocument();
    });
  });

  describe("demo request form", () => {
    it("validates before sending anything", async () => {
      const user = userEvent.setup();
      renderWithProviders(<HomePage />, { lang: "en" });
      const form = screen.getByRole("form", { name: "Request details" });
      await user.click(within(form).getByRole("button", { name: "Send request" }));
      expect(
        within(form).getByText("Enter the clinic's name (at least 2 characters)."),
      ).toBeInTheDocument();
      expect(within(form).getByText("Enter a mobile number.")).toBeInTheDocument();
      expect(
        within(form).getByText("We need your agreement before we can contact you."),
      ).toBeInTheDocument();
      expect(mocks.callFunction).not.toHaveBeenCalled();
    });

    it("hides the honeypot from people and assistive technology", () => {
      renderWithProviders(<HomePage />, { lang: "en" });
      const honeypot = document.querySelector<HTMLInputElement>('input[name="website"]')!;
      expect(honeypot).toHaveAttribute("tabindex", "-1");
      expect(honeypot).toHaveAttribute("autocomplete", "off");
      expect(honeypot).toHaveAttribute("aria-hidden", "true");
      expect(honeypot.closest(".sr-only")).not.toBeNull();
    });

    it("shows success only after the server confirms the stored request", async () => {
      let resolve: (value: unknown) => void = () => {};
      mocks.callFunction.mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      const user = userEvent.setup();
      renderWithProviders(<HomePage />, { lang: "en" });
      const form = await fillRequiredFields(user);
      await user.click(within(form).getByRole("button", { name: "Send request" }));

      await waitFor(() =>
        expect(mocks.callFunction).toHaveBeenCalledWith("demo-request", {
          clinic_name: "Smile Dental",
          contact_name: "Sara",
          phone: "+966551234567",
          email: "",
          city: "",
          clinic_type: "",
          message: "",
          locale: "en",
          consent: true,
          website: "",
        }),
      );
      expect(within(form).getByRole("button", { name: "Sending…" })).toBeDisabled();
      expect(screen.queryByText("We've received your request")).toBeNull();

      await act(async () => {
        resolve({ ok: true, id: "5b1d" });
        await Promise.resolve();
      });
      const heading = await screen.findByRole("heading", { name: "We've received your request" });
      await waitFor(() => expect(heading).toHaveFocus());
    });

    it("does not report success for an unexpected response", async () => {
      mocks.callFunction.mockResolvedValue({ ok: false });
      const user = userEvent.setup();
      renderWithProviders(<HomePage />, { lang: "en" });
      const form = await fillRequiredFields(user);
      await user.click(within(form).getByRole("button", { name: "Send request" }));
      expect(
        await within(form).findByText("Something unexpected went wrong. Please try again shortly."),
      ).toBeInTheDocument();
      expect(screen.queryByText("We've received your request")).toBeNull();
    });

    it("puts the server's field errors on the fields", async () => {
      mocks.callFunction.mockRejectedValue(
        new ApiError({
          status: 400,
          code: "invalid_request",
          message: "Some fields are missing or invalid",
          details: [{ path: "phone", message: "Enter a valid mobile number" }],
        }),
      );
      const user = userEvent.setup();
      renderWithProviders(<HomePage />, { lang: "en" });
      const form = await fillRequiredFields(user);
      await user.click(within(form).getByRole("button", { name: "Send request" }));
      expect(
        await within(form).findByText("Check the highlighted fields, then send the request again."),
      ).toBeInTheDocument();
      expect(within(form).getByLabelText(/Mobile number/)).toHaveAttribute("aria-invalid", "true");
      expect(screen.queryByText("We've received your request")).toBeNull();
    });

    it.each([
      [
        new ApiError({
          status: 429,
          code: "rate_limited",
          message: "Too many",
          details: { retry_after_seconds: 3600 },
        }),
        "We've received many requests from this connection in the last hour. Wait a while, then try again.",
      ],
      [
        new ApiError({ status: 0, code: "network_error", message: "Failed to fetch" }),
        "We couldn't send your request because the connection failed. Check your connection and try again; your details are still in the form.",
      ],
    ])("explains %s plainly", async (error, message) => {
      mocks.callFunction.mockRejectedValue(error);
      const user = userEvent.setup();
      renderWithProviders(<HomePage />, { lang: "en" });
      const form = await fillRequiredFields(user);
      await user.click(within(form).getByRole("button", { name: "Send request" }));
      expect(await within(form).findByText(message)).toBeInTheDocument();
      // The details stay in the form for another try.
      expect(within(form).getByLabelText(/Clinic name/)).toHaveValue("Smile Dental");
    });

    it("shows the support reference for server errors", async () => {
      mocks.callFunction.mockRejectedValue(
        new ApiError({ status: 500, code: "internal_error", message: "x", requestId: "req-77" }),
      );
      const user = userEvent.setup();
      renderWithProviders(<HomePage />, { lang: "en" });
      const form = await fillRequiredFields(user);
      await user.click(within(form).getByRole("button", { name: "Send request" }));
      expect(await within(form).findByText("req-77")).toBeInTheDocument();
    });
  });

  describe("contact email", () => {
    it("is not shown when none is configured", () => {
      vi.stubEnv("VITE_CONTACT_EMAIL", "");
      renderWithProviders(<HomePage />, { lang: "en" });
      expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
    });

    it("is shown when VITE_CONTACT_EMAIL is set", () => {
      vi.stubEnv("VITE_CONTACT_EMAIL", "hello@clinibot.example");
      renderWithProviders(<HomePage />, { lang: "en" });
      expect(screen.getByRole("link", { name: "hello@clinibot.example" })).toHaveAttribute(
        "href",
        "mailto:hello@clinibot.example",
      );
    });
  });
});
