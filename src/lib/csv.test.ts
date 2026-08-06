import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";

describe("toCsv", () => {
  it("writes a header row and the values under it", () => {
    const csv = toCsv([{ name: "Karin", visits: 3 }], [
      { key: "name", label: "Name" },
      { key: "visits", label: "Visits" },
    ]);
    expect(csv).toBe("Name,Visits\r\nKarin,3");
  });

  it("quotes values containing a comma, quote or newline", () => {
    const csv = toCsv(
      [{ a: "Cut, ladies", b: 'She said "yes"', c: "line1\nline2" }],
      [{ key: "a", label: "A" }, { key: "b", label: "B" }, { key: "c", label: "C" }]
    );
    expect(csv).toBe('A,B,C\r\n"Cut, ladies","She said ""yes""","line1\nline2"');
  });

  it("writes an empty string for null and undefined", () => {
    const csv = toCsv([{ a: null, b: undefined }], [
      { key: "a", label: "A" },
      { key: "b", label: "B" },
    ]);
    expect(csv).toBe("A,B\r\n,");
  });

  it("keeps a leading zero on a phone number by quoting it", () => {
    const csv = toCsv([{ tel: "082 123 4567" }], [{ key: "tel", label: "Phone" }]);
    expect(csv).toContain('"082 123 4567"');
  });

  it("returns just the header when there are no rows", () => {
    expect(toCsv([], [{ key: "a", label: "A" }])).toBe("A");
  });
});

describe("parseCsv", () => {
  it("reads a simple file into objects keyed by header", () => {
    const rows = parseCsv("Name,Phone\nThandi,0821234567");
    expect(rows).toEqual([{ Name: "Thandi", Phone: "0821234567" }]);
  });

  it("handles quoted fields containing commas", () => {
    const rows = parseCsv('Name,Note\n"Nkosi, T","Prefers 20 vol, no more"');
    expect(rows[0].Name).toBe("Nkosi, T");
    expect(rows[0].Note).toBe("Prefers 20 vol, no more");
  });

  it("unescapes doubled quotes", () => {
    const rows = parseCsv('Note\n"She said ""yes"""');
    expect(rows[0].Note).toBe('She said "yes"');
  });

  it("accepts both CRLF and LF line endings", () => {
    expect(parseCsv("A,B\r\n1,2\r\n3,4")).toHaveLength(2);
    expect(parseCsv("A,B\n1,2\n3,4")).toHaveLength(2);
  });

  it("skips a trailing blank line", () => {
    expect(parseCsv("A\n1\n")).toHaveLength(1);
  });

  it("returns nothing for an empty file", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("   ")).toEqual([]);
  });

  it("trims whitespace around headers and values", () => {
    const rows = parseCsv(" Name , Phone \n Thandi , 082 ");
    expect(rows[0]).toEqual({ Name: "Thandi", Phone: "082" });
  });

  it("pads a short row rather than dropping it", () => {
    const rows = parseCsv("A,B,C\n1,2");
    expect(rows[0]).toEqual({ A: "1", B: "2", C: "" });
  });
});
