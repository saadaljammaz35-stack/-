import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { ApiError } from "@/lib/apiError";
import { renderWithProviders } from "@/test/render";
import { QueryError } from "./QueryError";

const unauthorized = new ApiError({ status: 401, code: "unauthorized", message: "Unauthorized" });

describe("QueryError", () => {
  it("offers to sign in again next to Retry when a request was refused as signed out", async () => {
    const user = userEvent.setup();
    const signOut = vi.fn(() => Promise.resolve());
    const onRetry = vi.fn();
    renderWithProviders(<QueryError error={unauthorized} onRetry={onRetry} />, {
      lang: "en",
      auth: { signOut },
    });
    expect(screen.getByText("Your session has ended. Please sign in again.")).toBeInTheDocument();
    // The function may have refused a valid session (e.g. Auth was briefly down), so Retry stays.
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("keeps Retry for other errors, and on public pages without a session", () => {
    const { unmount } = renderWithProviders(
      <QueryError
        error={new ApiError({ status: 403, code: "forbidden", message: "" })}
        onRetry={() => {}}
      />,
      { lang: "en" },
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    unmount();

    render(
      <I18nProvider initialLang="en">
        <QueryError error={unauthorized} onRetry={() => {}} />
      </I18nProvider>,
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in again" })).not.toBeInTheDocument();
  });
});
