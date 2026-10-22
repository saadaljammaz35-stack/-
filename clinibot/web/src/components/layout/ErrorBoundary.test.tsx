import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { ErrorBoundary } from "./ErrorBoundary";

function Thrower({ error }: { error: Error | null }) {
  if (error) throw error;
  return <p>Page content</p>;
}

/** Throws until "fixed", like a page whose render error went away. */
function Flaky({ message }: { message: string }) {
  const [broken, setBroken] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setBroken(false)}>
        Fix it
      </button>
      <ErrorBoundary>
        <Thrower error={broken ? new Error(message) : null} />
      </ErrorBoundary>
    </>
  );
}

function renderBoundary(error: Error) {
  return render(
    <I18nProvider initialLang="en">
      <ErrorBoundary>
        <Thrower error={error} />
      </ErrorBoundary>
    </I18nProvider>,
  );
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // React logs caught render errors; the boundary logs them too.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("offers Try again for an ordinary render error, and it recovers", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider initialLang="en">
        <Flaky message="boom" />
      </I18nProvider>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    await user.click(screen.getByRole("button", { name: "Fix it" }));
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it.each([
    "Failed to fetch dynamically imported module: https://clinic.example/assets/Page-abc123.js",
    "error loading dynamically imported module",
    "Importing a module script failed.",
    "Unable to preload CSS for /assets/Page-abc123.css",
  ])("offers only a page reload when a page's file failed to load (%s)", (message) => {
    renderBoundary(new Error(message));
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
    // Rendering the same lazy page again would only fail again.
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("clears the error when the reset key changes (another page)", () => {
    const view = render(
      <I18nProvider initialLang="en">
        <ErrorBoundary resetKey="/a">
          <Thrower error={new Error("boom")} />
        </ErrorBoundary>
      </I18nProvider>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    view.rerender(
      <I18nProvider initialLang="en">
        <ErrorBoundary resetKey="/b">
          <Thrower error={null} />
        </ErrorBoundary>
      </I18nProvider>,
    );
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });
});
