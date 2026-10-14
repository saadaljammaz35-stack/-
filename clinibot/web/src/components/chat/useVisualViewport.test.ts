import { describe, expect, it } from "vitest";
import { viewportBox } from "./useVisualViewport";

describe("viewportBox", () => {
  it("follows the visible area and detects the on-screen keyboard", () => {
    expect(viewportBox({ height: 812, offsetTop: 0, scale: 1 }, 812)).toEqual({
      height: 812,
      offsetTop: 0,
      keyboardOpen: false,
    });
    expect(viewportBox({ height: 470.4, offsetTop: 120.2, scale: 1 }, 812)).toEqual({
      height: 470,
      offsetTop: 120,
      keyboardOpen: true,
    });
  });

  it("ignores pinch-zoom", () => {
    expect(viewportBox({ height: 400, offsetTop: 50, scale: 2 }, 812)).toBeNull();
  });
});
