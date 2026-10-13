import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import PrivacyPage from "./PrivacyPage";
import TermsPage from "./TermsPage";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PrivacyPage", () => {
  it("renders the Arabic policy with its date, contents and specific storage facts", () => {
    vi.stubEnv("VITE_CONTACT_EMAIL", "");
    renderWithProviders(<PrivacyPage />, { lang: "ar", route: "/privacy" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("سياسة الخصوصية");
    const date = screen.getByText("12 أكتوبر 2026");
    expect(date).toHaveAttribute("datetime", "2026-10-12");
    expect(date.closest("p")).toHaveTextContent("آخر تحديث: 12 أكتوبر 2026");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");

    const toc = screen.getByRole("navigation", { name: "المحتويات" });
    const links = within(toc).getAllByRole("link");
    expect(links).toHaveLength(11);
    for (const link of links) {
      const id = link.getAttribute("href")!.slice(1);
      expect(document.getElementById(id)).not.toBeNull();
    }

    expect(screen.getByText(/فرانكفورت بألمانيا/)).toBeInTheDocument();
    expect(screen.getByText(/شركة Anthropic/)).toBeInTheDocument();
    expect(screen.getByText("الرسائل: 180 يوماً.")).toBeInTheDocument();
    expect(screen.getByText("طلبات المواعيد: 365 يوماً.")).toBeInTheDocument();
    expect(screen.getByText(/«حذف بياناتي» أو DELETE MY DATA/)).toBeInTheDocument();

    // No contact email configured: point to the contact form instead.
    expect(screen.getByRole("link", { name: "نموذج التواصل" })).toHaveAttribute(
      "href",
      "/#contact",
    );
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it("uses the configured contact email", () => {
    vi.stubEnv("VITE_CONTACT_EMAIL", "privacy@clinibot.example");
    renderWithProviders(<PrivacyPage />, { lang: "en", route: "/privacy" });
    expect(screen.getByRole("link", { name: "privacy@clinibot.example" })).toHaveAttribute(
      "href",
      "mailto:privacy@clinibot.example",
    );
  });
});

describe("TermsPage", () => {
  it("renders the English terms with governing law and the link to the privacy policy", () => {
    renderWithProviders(<TermsPage />, { lang: "en", route: "/terms" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Terms of Service");
    expect(screen.getByText("12 October 2026").closest("p")).toHaveTextContent(
      "Last updated: 12 October 2026",
    );
    expect(screen.getByRole("heading", { level: 2, name: /Governing law/ })).toBeInTheDocument();
    expect(screen.getByText(/laws of the Kingdom of Saudi Arabia/)).toBeInTheDocument();
    expect(screen.getByText(/exclude 15% VAT/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Privacy Policy" })[0]).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
