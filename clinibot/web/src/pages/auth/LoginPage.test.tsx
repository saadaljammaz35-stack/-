import { AuthApiError } from "@supabase/supabase-js";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";

const signInWithPassword = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args) as unknown,
      resend: vi.fn(),
    },
  },
}));

const { default: LoginPage } = await import("./LoginPage");

describe("LoginPage", () => {
  beforeEach(() => signInWithPassword.mockReset());

  it("shows Arabic validation errors and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: "/login" });

    expect(screen.getByRole("heading", { level: 1, name: "تسجيل الدخول" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "دخول" }));

    expect(await screen.findByText("أدخل بريداً إلكترونياً صحيحاً")).toBeInTheDocument();
    expect(screen.getByText("أدخل كلمة المرور")).toBeInTheDocument();
    expect(screen.getByLabelText(/البريد الإلكتروني/)).toHaveAttribute("aria-invalid", "true");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("signs in with trimmed credentials", async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<LoginPage />, { route: "/login", lang: "en" });

    await user.type(screen.getByLabelText(/Email/), "  owner@clinic.sa ");
    await user.type(screen.getByLabelText(/^Password/), "correct horse battery");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "owner@clinic.sa",
      password: "correct horse battery",
    });
  });

  it("shows a translated error for wrong credentials", async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({
      data: {},
      error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
    });
    renderWithProviders(<LoginPage />, { route: "/login", lang: "en" });

    await user.type(screen.getByLabelText(/Email/), "owner@clinic.sa");
    await user.type(screen.getByLabelText(/^Password/), "wrong password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The email or password is incorrect.",
    );
  });
});
