import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Switch } from "./Switch";

describe("Button while loading", () => {
  it("keeps focus and ignores clicks instead of becoming natively disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const view = render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    button.focus();

    view.rerender(
      <Button onClick={onClick} loading>
        Save
      </Button>,
    );
    // A focused control that becomes disabled drops focus to <body>.
    expect(button).toHaveFocus();
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not submit its form again (Enter in a field clicks the default button)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="Name" />
        <Button type="submit" loading>
          Save
        </Button>
      </form>,
    );
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Rana{Enter}");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("treats a passed aria-disabled the same way", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} aria-disabled>
        Assign
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Assign" });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Switch while busy", () => {
  function Toggle({ busy }: { busy: boolean }) {
    const [on, setOn] = useState(false);
    return <Switch checked={on} onCheckedChange={setOn} label="Active" busy={busy} />;
  }

  it("keeps focus on the switch and ignores presses", async () => {
    const user = userEvent.setup();
    const view = render(<Toggle busy={false} />);
    const toggle = screen.getByRole("switch", { name: "Active" });
    toggle.focus();
    view.rerender(<Toggle busy />);
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    await user.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-checked", "false");

    view.rerender(<Toggle busy={false} />);
    await user.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});
