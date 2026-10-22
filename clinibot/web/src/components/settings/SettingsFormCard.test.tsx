import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { SettingsFormCard } from "./SettingsFormCard";

function Section({ saving }: { saving: boolean }) {
  const [name, setName] = useState("First");
  const [on, setOn] = useState(false);
  return (
    <SettingsFormCard
      title="Details"
      readOnly={false}
      dirty
      saving={saving}
      error={null}
      onSubmit={(event) => event.preventDefault()}
      onDiscard={() => undefined}
    >
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Open
        <input type="checkbox" checked={on} onChange={(event) => setOn(event.target.checked)} />
      </label>
    </SettingsFormCard>
  );
}

describe("SettingsFormCard", () => {
  it("keeps fields focusable but ignores edits while a save runs", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Section saving />);
    const name = screen.getByLabelText("Name");
    await user.click(name);
    await user.type(name, " Second");
    expect(name).toHaveFocus();
    expect(name).toHaveValue("First");
    const open = screen.getByLabelText("Open");
    await user.click(open);
    expect(open).not.toBeChecked();
  });

  it("accepts edits when no save is running", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Section saving={false} />);
    const name = screen.getByLabelText("Name");
    await user.type(name, " Second");
    expect(name).toHaveValue("First Second");
    await user.click(screen.getByLabelText("Open"));
    expect(screen.getByLabelText("Open")).toBeChecked();
  });
});
