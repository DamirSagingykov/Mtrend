import { describe, expect, it } from "vitest";
import { parseChartCsv, recommendSize, normalizeChartRows } from "@/lib/size-recommender";

const rows = normalizeChartRows([
  { size: "48", height: "176", chestMin: 94, chestMax: 97, waistMin: 80, waistMax: 83, heightMin: 170, heightMax: 178 },
  { size: "48", height: "182", chestMin: 94, chestMax: 97, waistMin: 80, waistMax: 83, heightMin: 179, heightMax: 185 },
  { size: "50", height: "176", chestMin: 98, chestMax: 101, waistMin: 84, waistMax: 87, heightMin: 170, heightMax: 178 },
  { size: "50", height: "182", chestMin: 98, chestMax: 101, waistMin: 84, waistMax: 87, heightMin: 179, heightMax: 185 },
  { size: "52", height: "182", chestMin: 102, chestMax: 105, waistMin: 88, waistMax: 91, heightMin: 179, heightMax: 185 },
]);

describe("recommendSize", () => {
  it("returns null without a chart", () => {
    expect(recommendSize([], { height: 180, chest: 100, preference: "regular" })).toBeNull();
  });
  it("matches size and height group", () => {
    const r = recommendSize(rows, { height: 181, chest: 99, waist: 85, preference: "regular" });
    expect(r?.size).toBe("50");
    expect(r?.height).toBe("182");
    expect(r?.confidence).toBe("high");
  });
  it("loose preference near upper bound picks next size", () => {
    const r = recommendSize(rows, { height: 181, chest: 101, waist: 87, preference: "loose" });
    expect(r?.size).toBe("52");
    expect(r?.alternative).toBe("50");
  });
  it("flags measurements out of range as low confidence", () => {
    const r = recommendSize(rows, { height: 200, chest: 130, waist: 120, preference: "regular" });
    expect(r?.confidence).toBe("low");
  });
});

describe("parseChartCsv", () => {
  it("parses semicolon CSV", () => {
    const { rows: r, errors } = parseChartCsv("size;chestMin;chestMax\n50;98;101\n52;102;105");
    expect(errors).toEqual([]);
    expect(r).toHaveLength(2);
    expect(r[1].chestMax).toBe(105);
  });
  it("reports unknown columns", () => {
    expect(parseChartCsv("size;foo\n50;1").errors[0]).toContain("foo");
  });
});
