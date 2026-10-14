import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MemberRole, Org } from "@/org/context";
import { renderWithProviders } from "@/test/render";
import { setupChecklist } from "./setup";
import { SetupChecklist } from "./SetupChecklist";
import type { SetupItemsState } from "./useSetupItems";

const state: SetupItemsState = {
  items: setupChecklist({
    hasKnowledge: true,
    assistantTested: false,
    assistantEnabled: false,
    publicChatEnabled: true,
    whatsappConnected: null,
    hasTeammate: false,
  }),
  loading: false,
  failures: [],
  retry: () => {},
};

function renderAs(role: MemberRole) {
  const org: Org = { id: "o1", name: "Smile", slug: "smile", defaultLanguage: "ar", role };
  renderWithProviders(<SetupChecklist setup={state} />, {
    lang: "en",
    org: { current: org, orgs: [org], role },
  });
}

describe("SetupChecklist", () => {
  it("counts only checks that are really done, and links each open step to its page", () => {
    renderAs("owner");
    expect(screen.getByText("2 of 6 done")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByRole("link", { name: /Test the assistant/ })).toHaveAttribute(
      "href",
      "/app/assistant",
    );
    expect(screen.getByRole("link", { name: /Invite a member/ })).toHaveAttribute(
      "href",
      "/app/staff",
    );
    // WhatsApp could not be checked: never shown as done.
    expect(screen.getByText(/could not be checked right now/)).toBeInTheDocument();
    expect(screen.queryByText(/your role cannot change them/)).not.toBeInTheDocument();
  });

  it("tells a receptionist that the owner or an admin completes the steps", () => {
    renderAs("receptionist");
    expect(screen.getByText(/your role cannot change them/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Invite a member/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View: Add another team member/ })).toHaveAttribute(
      "href",
      "/app/staff",
    );
  });
});
