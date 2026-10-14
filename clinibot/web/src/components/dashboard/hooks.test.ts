import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchDraft } from "./hooks";

describe("useSearchDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(initial: string) {
    const commit = vi.fn();
    const hook = renderHook(({ value }) => useSearchDraft(value, commit), {
      initialProps: { value: initial },
    });
    return { commit, hook };
  }

  it("commits the trimmed text once typing pauses", () => {
    const { commit, hook } = setup("");
    act(() => hook.result.current[1]("سار"));
    act(() => hook.result.current[1]("سارة "));
    act(() => {
      vi.advanceTimersByTime(349);
    });
    expect(commit).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith("سارة");
  });

  it("keeps a trailing space the user is still typing after the commit", () => {
    const { hook } = setup("");
    act(() => hook.result.current[1]("Sara "));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    hook.rerender({ value: "Sara" });
    expect(hook.result.current[0]).toBe("Sara ");
  });

  it("follows the address when it changes elsewhere instead of writing the old text back", () => {
    const { commit, hook } = setup("Sara");
    expect(hook.result.current[0]).toBe("Sara");
    hook.rerender({ value: "" });
    expect(hook.result.current[0]).toBe("");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(commit).not.toHaveBeenCalled();
  });
});
