import { useRef, useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Lang } from "@/i18n";
import { renderWithProviders } from "@/test/render";
import { Composer } from "./Composer";

function Harness() {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  return (
    <Composer
      value={value}
      onChange={setValue}
      onSubmit={() => setValue("")}
      sending={false}
      pausedUntil={null}
      textareaRef={textareaRef}
    />
  );
}

function renderComposer(lang: Lang) {
  return renderWithProviders(<Harness />, { lang });
}

describe("Composer", () => {
  it("keeps the empty box in the page direction, then follows the typed text", async () => {
    const user = userEvent.setup();
    renderComposer("ar");
    // An empty dir="auto" control resolves to LTR, which would put the Arabic placeholder
    // and the caret on the left.
    const box = screen.getByRole("textbox", { name: "اكتب رسالتك" });
    expect(box).toHaveAttribute("dir", "rtl");

    await user.type(box, "What are your hours?");
    expect(box).toHaveAttribute("dir", "auto");

    await user.clear(box);
    expect(box).toHaveAttribute("dir", "rtl");
  });

  it("uses LTR while empty in the English UI", () => {
    renderComposer("en");
    expect(screen.getByRole("textbox", { name: "Type your message" })).toHaveAttribute(
      "dir",
      "ltr",
    );
  });
});
