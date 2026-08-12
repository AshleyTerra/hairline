import { describe, expect, it } from "vitest";
import {
  activeOnly,
  archive,
  archiveMany,
  inactiveItems,
  isArchived,
  parseMoney,
  parseStockImport,
  unarchive,
} from "./stockAdmin";

describe("reading money from a supplier sheet", () => {
  it("reads a plain number", () => {
    expect(parseMoney("123.45")).toBe(123.45);
  });

  it("reads South African formatting", () => {
    expect(parseMoney("R 1 234,56")).toBe(1234.56);
  });

  it("reads a thousands separator without decimals", () => {
    expect(parseMoney("1,234")).toBe(1234);
  });

  it("returns null for something that is not money", () => {
    expect(parseMoney("POA")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });
});

describe("importing stock", () => {
  it("reads a well-formed retail sheet", () => {
    const r = parseStockImport(
      "Item,Brand,Cost,Price,Reorder,Barcode\nSmooth Shampoo 300ml,Redken,114.86,225,3,884486"
    );
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({
      name: "Smooth Shampoo 300ml",
      brand: "Redken",
      cost: 114.86,
      price: 225,
      reorder: 3,
      barcode: "884486",
      shelf: "retail",
    });
  });

  it("accepts the header spellings a price list is likely to use", () => {
    const r = parseStockImport("Description,Vendor,Unit Cost,RSP\nTint 60g,Schwarzkopf,90,0", "backbar");
    expect(r.rows[0].name).toBe("Tint 60g");
    expect(r.rows[0].brand).toBe("Schwarzkopf");
    expect(r.rows[0].shelf).toBe("backbar");
  });

  it("recognises a back-bar line from its type column", () => {
    const r = parseStockImport("Item,Type,Cost\nBleach 500g,Salon stock,300");
    expect(r.rows[0].shelf).toBe("backbar");
  });

  it("reports a row with no item name instead of accepting it", () => {
    const r = parseStockImport("Item,Price\n,225");
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0]).toMatch(/row 2/i);
  });

  it("reports an unreadable price", () => {
    const r = parseStockImport("Item,Price\nShampoo,call us");
    expect(r.errors[0]).toMatch(/not a price/i);
  });

  it("insists a retail line has a selling price", () => {
    const r = parseStockImport("Item,Price\nShampoo,0");
    expect(r.errors[0]).toMatch(/selling price/i);
  });

  it("allows a back-bar line with no selling price", () => {
    const r = parseStockImport("Item,Type,Cost,Price\nTint 20g,back bar,90,0");
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
  });

  it("flags a duplicate item within the file", () => {
    const r = parseStockImport("Item,Price\nShampoo,100\nShampoo,120");
    expect(r.rows).toHaveLength(1);
    expect(r.errors[0]).toMatch(/already listed on row 2/i);
  });

  it("complains when there is no item column at all", () => {
    const r = parseStockImport("Price,Brand\n100,Redken");
    expect(r.rows).toEqual([]);
    expect(r.errors[0]).toMatch(/item column/i);
  });

  it("defaults the brand when the sheet omits it", () => {
    const r = parseStockImport("Item,Price\nShampoo,100");
    expect(r.rows[0].brand).toBe("Unknown");
  });
});

describe("archiving", () => {
  const items = [
    { id: 1, name: "Sells well", timesSold: 40, qty: 5 },
    { id: 2, name: "Never sold", timesSold: 0, qty: 2 },
    { id: 3, name: "Also never sold", timesSold: 0, qty: 0 },
  ];

  it("finds the items with no sales in the window", () => {
    expect(inactiveItems(items).map((i) => i.id)).toEqual([2, 3]);
  });

  it("archives an item", () => {
    expect(archive([], 2)).toEqual([2]);
    expect(isArchived(archive([], 2), 2)).toBe(true);
  });

  it("does not archive the same item twice", () => {
    expect(archive([2], 2)).toEqual([2]);
  });

  it("archives several at once", () => {
    expect(archiveMany([2], [2, 3]).sort()).toEqual([2, 3]);
  });

  it("restores an archived item", () => {
    expect(unarchive([2, 3], 2)).toEqual([3]);
  });

  it("hides archived items from the active list", () => {
    expect(activeOnly(items, [2, 3]).map((i) => i.id)).toEqual([1]);
  });

  it("leaves the original lists untouched", () => {
    const archived = [2];
    archive(archived, 3);
    expect(archived).toEqual([2]);
  });
});
