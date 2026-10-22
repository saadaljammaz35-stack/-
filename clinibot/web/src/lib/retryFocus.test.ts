import { describe, expect, it } from "vitest";
import { retryKeepingFocus } from "./retryFocus";

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
}

describe("retryKeepingFocus", () => {
  it("moves focus to the target when the retry removed the focused button", async () => {
    const button = document.createElement("button");
    const target = document.createElement("button");
    document.body.append(button, target);
    button.focus();
    await retryKeepingFocus(
      () => {
        button.remove();
        return Promise.resolve();
      },
      () => target,
    );
    await nextFrame();
    expect(document.activeElement).toBe(target);
    target.remove();
  });

  it("leaves focus alone when the button is still there", async () => {
    const button = document.createElement("button");
    const target = document.createElement("button");
    document.body.append(button, target);
    button.focus();
    await retryKeepingFocus(
      () => Promise.resolve(),
      () => target,
    );
    await nextFrame();
    expect(document.activeElement).toBe(button);
    button.remove();
    target.remove();
  });
});
