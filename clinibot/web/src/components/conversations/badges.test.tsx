import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { CustomerName } from "./badges";

describe("CustomerName", () => {
  it("isolates a masked number as LTR without changing the row's alignment", () => {
    renderWithProviders(
      <CustomerName
        className="block truncate"
        conversation={{ customer_name: null, customer_wa_id: "966551234567", channel: "whatsapp" }}
      />,
      { lang: "ar" },
    );
    const number = screen.getByText(/^\+966/);
    expect(number.tagName).toBe("BDI");
    expect(number).toHaveAttribute("dir", "ltr");
    // The outer element keeps the page direction, so it lines up with named rows.
    const outer = number.parentElement;
    expect(outer).toHaveClass("block", "truncate");
    expect(outer).not.toHaveAttribute("dir");
  });

  it("shows a name as plain text", () => {
    renderWithProviders(
      <CustomerName
        conversation={{
          customer_name: "سارة",
          customer_wa_id: "966551234567",
          channel: "whatsapp",
        }}
      />,
      { lang: "ar" },
    );
    const name = screen.getByText("سارة");
    expect(name.tagName).toBe("SPAN");
    expect(name).not.toHaveAttribute("dir");
  });
});
