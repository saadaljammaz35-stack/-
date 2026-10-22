import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { LinkConflict } from "./LinkConflict";

describe("LinkConflict", () => {
  it("warns that staying signed in ends a staff invitation", () => {
    renderWithProviders(<LinkConflict email="owner@clinic.sa" usedInvite onResolved={() => {}} />, {
      lang: "en",
    });
    expect(screen.getByText(/This is a clinic team invitation/)).toBeInTheDocument();
    expect(screen.getByText(/Forgot password/)).toBeInTheDocument();
  });

  it("says nothing about invitations for other links", () => {
    renderWithProviders(<LinkConflict email="owner@clinic.sa" onResolved={() => {}} />, {
      lang: "en",
    });
    expect(screen.queryByText(/This is a clinic team invitation/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out and continue" })).toBeInTheDocument();
  });
});
