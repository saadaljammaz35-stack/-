import { describe, expect, it } from "vitest";
import { arabicDayCount } from "./arabic";

describe("arabicDayCount", () => {
  it("matches the server's wording", () => {
    expect(arabicDayCount(7)).toBe("7 أيام");
    expect(arabicDayCount(10)).toBe("10 أيام");
    expect(arabicDayCount(11)).toBe("11 يومًا");
    expect(arabicDayCount(100)).toBe("100 يوم");
    expect(arabicDayCount(101)).toBe("101 يوم");
    expect(arabicDayCount(103)).toBe("103 أيام");
    expect(arabicDayCount(180)).toBe("180 يومًا");
    expect(arabicDayCount(1825)).toBe("1825 يومًا");
  });
});
