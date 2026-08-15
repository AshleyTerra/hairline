import { describe, expect, it } from "vitest";
import {
  applyEdit,
  asProduct,
  nextStockId,
  stockBook,
  validateStockEdit,
  type StockEdit,
} from "./stockBook";
import type { StockDraft } from "./stockAdmin";
import type { Product } from "./types";

const product = (over: Partial<Product> = {}): Product => ({
  id: 4101,
  name: "Smooth Down Shampoo 300ml",
  brand: "Redken",
  dept: "Redken Retail",
  cost: 114.86,
  price: 225,
  margin: 49,
  qty: 6,
  reorder: 2,
  barcode: "884486063274",
  needsCount: false,
  lowStock: false,
  timesSold: 31,
  ...over,
});

const draft = (over: Partial<StockDraft> = {}): StockDraft => ({
  name: "New Repair Mask 200ml",
  brand: "Redken",
  shelf: "retail",
  cost: 90,
  price: 210,
  reorder: 2,
  barcode: "600123456789",
  ...over,
});

describe("editing a stock line", () => {
  it("changes the brand", () => {
    const edited = applyEdit(product(), { id: 4101, brand: "Redken Professional" });
    expect(edited.brand).toBe("Redken Professional");
  });

  it("changes the barcode, because the same product arrives with a new one", () => {
    const edited = applyEdit(product(), { id: 4101, barcode: "600999888777" });
    expect(edited.barcode).toBe("600999888777");
  });

  it("takes a manual code for a product the supplier never barcoded", () => {
    const edited = applyEdit(product({ barcode: null }), { id: 4101, barcode: "HL-0042" });
    expect(edited.barcode).toBe("HL-0042");
  });

  it("changes cost and price, and works the margin out again", () => {
    const edited = applyEdit(product(), { id: 4101, cost: 100, price: 250 });
    expect(edited.cost).toBe(100);
    expect(edited.price).toBe(250);
    expect(edited.margin).toBe(60);
  });

  it("leaves the margin empty when there is no cost to work it from", () => {
    expect(applyEdit(product(), { id: 4101, cost: 0 }).margin).toBeNull();
  });

  it("leaves anything the edit does not mention alone", () => {
    const edited = applyEdit(product(), { id: 4101, brand: "Redken Professional" });
    expect(edited.price).toBe(225);
    expect(edited.qty).toBe(6);
    expect(edited.timesSold).toBe(31);
  });

  it("never mutates the product it was given", () => {
    const original = product();
    applyEdit(original, { id: 4101, price: 999 });
    expect(original.price).toBe(225);
  });
});

describe("checking an edit before it is saved", () => {
  it("accepts a sensible one", () => {
    expect(validateStockEdit({ name: "Mask", brand: "Redken", cost: "90", price: "210", reorder: "2", barcode: "X1" }).ok).toBe(true);
  });

  it("insists on a name", () => {
    expect(validateStockEdit({ name: "  ", brand: "R", cost: "1", price: "2", reorder: "0", barcode: "" })).toMatchObject({ ok: false, field: "name" });
  });

  it("refuses a price that is not a number", () => {
    expect(validateStockEdit({ name: "Mask", brand: "R", cost: "90", price: "two hundred", reorder: "0", barcode: "" })).toMatchObject({ ok: false, field: "price" });
  });

  it("refuses a negative price", () => {
    expect(validateStockEdit({ name: "Mask", brand: "R", cost: "90", price: "-5", reorder: "0", barcode: "" })).toMatchObject({ ok: false, field: "price" });
  });

  it("refuses a negative cost", () => {
    expect(validateStockEdit({ name: "Mask", brand: "R", cost: "-1", price: "210", reorder: "0", barcode: "" })).toMatchObject({ ok: false, field: "cost" });
  });

  it("allows a zero cost, because not everything has one on file", () => {
    expect(validateStockEdit({ name: "Mask", brand: "R", cost: "", price: "210", reorder: "0", barcode: "" }).ok).toBe(true);
  });

  it("reads South African money the way the salon writes it", () => {
    const r = validateStockEdit({ name: "Mask", brand: "R", cost: "R 1 234,56", price: "R 2 000,00", reorder: "0", barcode: "" });
    expect(r.ok && r.patch.cost).toBe(1234.56);
    expect(r.ok && r.patch.price).toBe(2000);
  });

  it("trims the barcode and keeps manual codes as typed", () => {
    const r = validateStockEdit({ name: "Mask", brand: "R", cost: "1", price: "2", reorder: "0", barcode: "  HL-0042 " });
    expect(r.ok && r.patch.barcode).toBe("HL-0042");
  });
});

describe("a draft added at the counter", () => {
  it("becomes a product with no history yet", () => {
    const p = asProduct(draft(), -1);
    expect(p).toMatchObject({
      id: -1,
      name: "New Repair Mask 200ml",
      brand: "Redken",
      price: 210,
      cost: 90,
      qty: 0,
      timesSold: 0,
    });
  });

  it("is flagged as never counted, because it has not been", () => {
    expect(asProduct(draft(), -1).needsCount).toBe(true);
  });

  it("gives each new line its own number, clear of the migrated file", () => {
    expect(nextStockId([])).toBe(-1);
    expect(nextStockId([{ id: -1 }, { id: -2 }])).toBe(-3);
  });
});

describe("the stock book", () => {
  const migrated = [product(), product({ id: 4102, name: "Extreme Conditioner", barcode: "884486042163" })];

  it("holds the migrated file", () => {
    expect(stockBook(migrated, [], [], []).map((p) => p.id)).toEqual([4101, 4102]);
  });

  it("adds anything created since, newest first", () => {
    const book = stockBook(migrated, [draft()], [], []);
    expect(book[0].name).toBe("New Repair Mask 200ml");
    expect(book).toHaveLength(3);
  });

  it("applies an edit to the migrated line", () => {
    const edits: StockEdit[] = [{ id: 4101, brand: "Redken Professional", price: 260 }];
    const book = stockBook(migrated, [], edits, []);
    const line = book.find((p) => p.id === 4101);
    expect(line?.brand).toBe("Redken Professional");
    expect(line?.price).toBe(260);
  });

  it("applies an edit to a line added at the counter", () => {
    const book = stockBook(migrated, [draft()], [{ id: -1, price: 240 }], []);
    expect(book.find((p) => p.id === -1)?.price).toBe(240);
  });

  it("leaves an archived line out of the book", () => {
    expect(stockBook(migrated, [], [], [4102]).map((p) => p.id)).toEqual([4101]);
  });

  it("ignores an edit that points at nothing", () => {
    expect(() => stockBook(migrated, [], [{ id: 999999, price: 1 }], [])).not.toThrow();
    expect(stockBook(migrated, [], [{ id: 999999, price: 1 }], [])).toHaveLength(2);
  });

  it("numbers new lines across both shelves, so no two share an id", () => {
    /* Filtering by shelf before numbering would give the first retail line and
       the first back-bar line the same id, and one edit would hit both. */
    const added = [draft({ name: "Retail one" }), draft({ name: "Backbar one", shelf: "backbar" })];
    const shelved = stockBook(migrated, added, [], [], "retail");
    const behind = stockBook(migrated, added, [], [], "backbar");
    expect(shelved.find((p) => p.name === "Retail one")?.id).toBe(-1);
    expect(behind.find((p) => p.name === "Backbar one")?.id).toBe(-2);
  });

  it("edits the line it was aimed at, not its opposite number on the other shelf", () => {
    const added = [draft({ name: "Retail one" }), draft({ name: "Backbar one", shelf: "backbar" })];
    const edits: StockEdit[] = [{ id: -2, price: 777 }];
    expect(stockBook(migrated, added, edits, [], "retail").find((p) => p.name === "Retail one")?.price).toBe(210);
    expect(stockBook(migrated, added, edits, [], "backbar").find((p) => p.name === "Backbar one")?.price).toBe(777);
  });

  it("shows every shelf when none is named", () => {
    const added = [draft({ name: "Retail one" }), draft({ name: "Backbar one", shelf: "backbar" })];
    expect(stockBook(migrated, added, [], []).filter((p) => p.id < 0)).toHaveLength(2);
  });

  it("lets a later edit win over an earlier one", () => {
    const book = stockBook(migrated, [], [{ id: 4101, price: 240 }, { id: 4101, price: 999 }], []);
    expect(book.find((p) => p.id === 4101)?.price).toBe(999);
  });
});
