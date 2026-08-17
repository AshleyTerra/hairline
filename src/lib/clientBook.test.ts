import { describe, expect, it } from "vitest";
import {
  asClient,
  birthdayOf,
  clientBook,
  findClient,
  normaliseMobile,
  searchBook,
  validateClient,
  type ClientInput,
} from "./clientBook";
import type { Client, NewClient, PlayInvoice } from "./types";

const input = (over: Partial<ClientInput> = {}): ClientInput => ({
  name: "Thandi Nkosi",
  tel: "076 408 9755",
  email: "thandi@example.co.za",
  birthDay: "26",
  birthMonth: "8",
  notes: "",
  ...over,
});

const migrated = (over: Partial<Client> = {}): Client => ({
  id: 1,
  name: "Fatima Osman",
  firstName: "Fatima",
  surname: "Osman",
  tel: "082 265 2046",
  email: null,
  birthday: "2005-08-26",
  firstVisit: "2015-03-02",
  lastVisit: "2026-07-25",
  visitCount: 41,
  lifetimeSpend: 32400,
  avgTicket: 790,
  prefStylistId: 3,
  lapsed: false,
  vip: true,
  medical: null,
  notes: null,
  ...over,
});

const added = (over: Partial<NewClient> = {}): NewClient => ({
  id: -1,
  name: "Thandi Nkosi",
  tel: "076 408 9755",
  email: "thandi@example.co.za",
  birthday: "--08-26",
  notes: "",
  walkIn: false,
  ...over,
});

describe("mobile numbers", () => {
  it("keeps the salon's own spacing", () => {
    expect(normaliseMobile("0764089755")).toBe("076 408 9755");
  });

  it("accepts a number already spaced", () => {
    expect(normaliseMobile("076 408 9755")).toBe("076 408 9755");
  });

  it("accepts the international form and stores it locally", () => {
    expect(normaliseMobile("+27 76 408 9755")).toBe("076 408 9755");
    expect(normaliseMobile("2776 408 9755")).toBe("076 408 9755");
  });

  it("refuses a number that is too short", () => {
    expect(normaliseMobile("076 408")).toBeNull();
  });

  it("refuses a landline, because the salon needs somewhere to send a message", () => {
    expect(normaliseMobile("011 706 1322")).toBeNull();
  });

  it("refuses nonsense", () => {
    expect(normaliseMobile("not a number")).toBeNull();
    expect(normaliseMobile("")).toBeNull();
  });
});

describe("validating a service client", () => {
  it("accepts a complete record", () => {
    const result = validateClient(input(), "service");
    expect(result.ok).toBe(true);
  });

  it("insists on a name", () => {
    const result = validateClient(input({ name: "   " }), "service");
    expect(result).toMatchObject({ ok: false, field: "name" });
  });

  it("insists on a mobile number", () => {
    expect(validateClient(input({ tel: "" }), "service")).toMatchObject({
      ok: false,
      field: "tel",
    });
  });

  it("insists the mobile number is a real one", () => {
    expect(validateClient(input({ tel: "076" }), "service")).toMatchObject({
      ok: false,
      field: "tel",
    });
  });

  it("insists on an email address", () => {
    expect(validateClient(input({ email: "" }), "service")).toMatchObject({
      ok: false,
      field: "email",
    });
  });

  it("insists the email looks like an email", () => {
    expect(validateClient(input({ email: "thandi at example" }), "service")).toMatchObject({
      ok: false,
      field: "email",
    });
  });

  it("insists on a birthday", () => {
    expect(validateClient(input({ birthDay: "", birthMonth: "" }), "service")).toMatchObject({
      ok: false,
      field: "birthday",
    });
  });

  it("refuses a day that month never has", () => {
    expect(validateClient(input({ birthDay: "31", birthMonth: "2" }), "service")).toMatchObject({
      ok: false,
      field: "birthday",
    });
  });

  it("allows 29 February, because it comes round", () => {
    expect(validateClient(input({ birthDay: "29", birthMonth: "2" }), "service").ok).toBe(true);
  });

  it("stores the birthday as day and month only", () => {
    const result = validateClient(input({ birthDay: "8", birthMonth: "3" }), "service");
    expect(result.ok && result.client.birthday).toBe("--03-08");
  });

  it("tidies the number and trims the rest", () => {
    const result = validateClient(
      input({ name: "  Thandi Nkosi ", tel: "+27764089755", email: " T@Example.co.za " }),
      "service"
    );
    expect(result.ok && result.client).toMatchObject({
      name: "Thandi Nkosi",
      tel: "076 408 9755",
      email: "t@example.co.za",
    });
  });
});

describe("validating a walk-in", () => {
  it("needs only a name", () => {
    const result = validateClient(
      input({ tel: "", email: "", birthDay: "", birthMonth: "" }),
      "walkin"
    );
    expect(result.ok).toBe(true);
  });

  it("still insists on a name", () => {
    expect(validateClient(input({ name: "" }), "walkin")).toMatchObject({
      ok: false,
      field: "name",
    });
  });

  it("marks the record as a walk-in, so it is never mistaken for a full file", () => {
    const result = validateClient(input({ tel: "", email: "" }), "walkin");
    expect(result.ok && result.client.walkIn).toBe(true);
  });

  it("keeps a number when one is offered, but refuses a bad one", () => {
    expect(validateClient(input({ tel: "0764089755" }), "walkin")).toMatchObject({ ok: true });
    expect(validateClient(input({ tel: "12" }), "walkin")).toMatchObject({
      ok: false,
      field: "tel",
    });
  });
});

describe("turning a captured client into a file", () => {
  it("starts with no history rather than being left off the screen", () => {
    const c = asClient(added());
    expect(c).toMatchObject({
      id: -1,
      name: "Thandi Nkosi",
      firstName: "Thandi",
      surname: "Nkosi",
      visitCount: 0,
      lifetimeSpend: 0,
      avgTicket: 0,
      lapsed: false,
      vip: false,
    });
  });

  it("copes with a single name", () => {
    expect(asClient(added({ name: "Pinky" }))).toMatchObject({
      firstName: "Pinky",
      surname: "",
    });
  });

  it("carries the notes through, so a colour formula is not lost", () => {
    expect(asClient(added({ notes: "1/2 6.0 + 20vol" })).notes).toBe("1/2 6.0 + 20vol");
  });
});

describe("the client book", () => {
  it("holds the migrated file and anyone captured at the till", () => {
    const book = clientBook([migrated()], [added()]);
    expect(book).toHaveLength(2);
    expect(book.map((c) => c.name)).toContain("Thandi Nkosi");
    expect(book.map((c) => c.name)).toContain("Fatima Osman");
  });

  it("puts the newest capture first, where reception will look for it", () => {
    const book = clientBook([migrated()], [added({ id: -1 }), added({ id: -2, name: "Later" })]);
    expect(book[0].name).toBe("Later");
  });

  it("finds a client captured at the till by id", () => {
    const book = clientBook([migrated()], [added()]);
    expect(findClient(book, -1)?.name).toBe("Thandi Nkosi");
    expect(findClient(book, 1)?.name).toBe("Fatima Osman");
    expect(findClient(book, 999)).toBeUndefined();
  });

  it("searches both the migrated file and the new captures", () => {
    const book = clientBook([migrated()], [added()]);
    expect(searchBook(book, "thandi").map((c) => c.id)).toEqual([-1]);
    expect(searchBook(book, "osman").map((c) => c.id)).toEqual([1]);
  });

  it("searches by number as well as by name", () => {
    const book = clientBook([migrated()], [added()]);
    expect(searchBook(book, "0764089755").map((c) => c.id)).toEqual([-1]);
    expect(searchBook(book, "408").map((c) => c.id)).toEqual([-1]);
  });

  it("returns nothing for an empty query rather than the whole book", () => {
    expect(searchBook(clientBook([migrated()], [added()]), "  ")).toEqual([]);
  });
});

describe("reading a birthday", () => {
  it("reads the day-and-month form", () => {
    expect(birthdayOf("--08-26")).toEqual({ day: 26, month: 8 });
  });

  it("reads the migrated form, where the year is meaningless", () => {
    expect(birthdayOf("2005-08-26")).toEqual({ day: 26, month: 8 });
  });

  it("copes with nothing on file", () => {
    expect(birthdayOf(null)).toBeNull();
    expect(birthdayOf("")).toBeNull();
  });
});

// ------------- a sale rung up here must show on the client's own record

const playInvoice = (over: Partial<PlayInvoice> = {}): PlayInvoice => ({
  id: 1,
  clientId: -1,
  clientName: "Thandi Nkosi",
  date: "2026-07-25T10:15:00",
  total: 600,
  lines: [
    { key: "l1", descr: "Cut - ladies", price: 600, qty: 1, disc: 0, stylistId: 4, kind: "service" },
  ],
  payments: [{ method: "card", amount: 600 }],
  tips: [],
  seconds: 24,
  ...over,
});

describe("what a sale does to the client's record", () => {
  it("counts the visit", () => {
    const book = clientBook([migrated()], [added()], [playInvoice()]);
    expect(findClient(book, -1)?.visitCount).toBe(1);
  });

  it("adds it to their lifetime spend", () => {
    const book = clientBook([migrated()], [added()], [playInvoice()]);
    expect(findClient(book, -1)?.lifetimeSpend).toBe(600);
  });

  it("sets the last visit to the day of the sale", () => {
    const book = clientBook([migrated()], [added()], [playInvoice()]);
    expect(findClient(book, -1)?.lastVisit).toBe("2026-07-25");
  });

  it("sets the first visit too, when there was none", () => {
    const book = clientBook([migrated()], [added()], [playInvoice()]);
    expect(findClient(book, -1)?.firstVisit).toBe("2026-07-25");
  });

  it("names the stylist who did the work as their usual one", () => {
    const book = clientBook([migrated()], [added()], [playInvoice()]);
    expect(findClient(book, -1)?.prefStylistId).toBe(4);
  });

  it("works out the average visit", () => {
    const book = clientBook([migrated()], [added()], [playInvoice()]);
    expect(findClient(book, -1)?.avgTicket).toBe(600);
  });

  it("adds to a migrated client's existing history rather than replacing it", () => {
    const book = clientBook([migrated()], [], [playInvoice({ clientId: 1, clientName: "Fatima Osman" })]);
    const fatima = findClient(book, 1);
    expect(fatima?.visitCount).toBe(42);
    expect(fatima?.lifetimeSpend).toBe(33000);
  });

  it("leaves a migrated client's earlier last-visit date alone when the sale is older", () => {
    const older = playInvoice({ clientId: 1, date: "2020-01-05T09:00:00" });
    expect(findClient(clientBook([migrated()], [], [older]), 1)?.lastVisit).toBe("2026-07-25");
  });

  it("keeps their existing usual stylist rather than overwriting it", () => {
    const book = clientBook([migrated()], [], [playInvoice({ clientId: 1 })]);
    expect(findClient(book, 1)?.prefStylistId).toBe(3);
  });

  it("counts several sales", () => {
    const book = clientBook([migrated()], [added()], [
      playInvoice({ id: 1 }),
      playInvoice({ id: 2, total: 400, date: "2026-07-26T11:00:00" }),
    ]);
    const c = findClient(book, -1);
    expect(c?.visitCount).toBe(2);
    expect(c?.lifetimeSpend).toBe(1000);
    expect(c?.lastVisit).toBe("2026-07-26");
    expect(c?.avgTicket).toBe(500);
  });

  it("ignores a walk-in sale with nobody attached", () => {
    const book = clientBook([migrated()], [added()], [playInvoice({ clientId: null })]);
    expect(findClient(book, -1)?.visitCount).toBe(0);
  });

  it("takes the stylist from the service line, not a voucher on the same sale", () => {
    const withVoucher = playInvoice({
      lines: [
        { key: "v", descr: "Gift voucher", price: 500, qty: 1, disc: 0, stylistId: null, kind: "stock" },
        { key: "s", descr: "Blow-dry", price: 250, qty: 1, disc: 0, stylistId: 6, kind: "service" },
      ],
    });
    expect(findClient(clientBook([migrated()], [added()], [withVoucher]), -1)?.prefStylistId).toBe(6);
  });

  it("no longer reads as never visited", () => {
    const book = clientBook([migrated()], [added()], [playInvoice()]);
    expect(findClient(book, -1)?.lastVisit).not.toBeNull();
  });

  it("copes with no sales at all", () => {
    expect(findClient(clientBook([migrated()], [added()], []), -1)?.visitCount).toBe(0);
  });
});
