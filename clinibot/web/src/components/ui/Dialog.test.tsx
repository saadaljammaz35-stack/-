import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ConfirmDialog } from "./ConfirmDialog";
import { Dialog } from "./Dialog";

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Edit service">
        <input aria-label="name" />
        <button type="button">inside</button>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("moves focus inside, closes on Escape and returns focus to the opener", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DialogHarness />);
    const opener = screen.getByRole("button", { name: "open" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Edit service" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("keeps Tab inside the dialog", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DialogHarness />);
    await user.click(screen.getByRole("button", { name: "open" }));
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });
});

describe("ConfirmDialog", () => {
  it("requires the exact typed confirmation before confirming", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithProviders(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Delete clinic"
        confirmLabel="Delete"
        confirmText="smile-dental"
      />,
      { lang: "en" },
    );
    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(confirm).toBeDisabled();

    const input = screen.getByRole("textbox");
    expect(input).toHaveFocus();
    await user.type(input, "smile-denta");
    expect(confirm).toBeDisabled();
    await user.type(input, "l");
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
