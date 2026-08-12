import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESIGNATIONS,
  activeStaff,
  addDesignation,
  addStaff,
  editStaff,
  removeDesignation,
  renameDesignation,
  setActive,
  validateEmail,
  validateTel,
  type StaffRecord,
} from "./staffAdmin";

const STAFF: StaffRecord[] = [
  { id: 1, name: "Karin M.", designation: "Senior stylist", email: "", tel: "", active: true },
  { id: 11, name: "Cynthia Z.", designation: "Assistant", email: "", tel: "", active: true },
];

describe("contact details", () => {
  it("accepts a sensible email and rejects nonsense", () => {
    expect(validateEmail("karin@example.co.za")).toBe(true);
    expect(validateEmail("karin@")).toBe(false);
  });

  it("treats a blank email as fine, since it is optional", () => {
    expect(validateEmail("")).toBe(true);
  });

  it("accepts South African numbers in the usual shapes", () => {
    expect(validateTel("082 123 4567")).toBe(true);
    expect(validateTel("0821234567")).toBe(true);
    expect(validateTel("+27821234567")).toBe(true);
  });

  it("rejects a number that is too short", () => {
    expect(validateTel("0821234")).toBe(false);
  });
});

describe("adding a staff member", () => {
  const input = {
    name: "Nomsa Dlamini",
    designation: "Stylist",
    email: "nomsa@example.co.za",
    tel: "082 555 1234",
  };

  it("adds them with the next number", () => {
    const r = addStaff(STAFF, input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const added = r.staff.at(-1)!;
      expect(added.id).toBe(12); // highest was 11
      expect(added.name).toBe("Nomsa Dlamini");
      expect(added.active).toBe(true);
    }
  });

  it("never reuses a number past sales point at", () => {
    const withHighId: StaffRecord[] = [
      ...STAFF,
      { id: 81, name: "Shakira S.", designation: "Stylist", email: "", tel: "", active: true },
    ];
    const r = addStaff(withHighId, input);
    expect(r.ok && r.staff.at(-1)!.id).toBe(82);
  });

  it("refuses a blank name", () => {
    expect(addStaff(STAFF, { ...input, name: "  " }).ok).toBe(false);
  });

  it("refuses someone already on the books", () => {
    const r = addStaff(STAFF, { ...input, name: "karin m." });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/already on the books/i);
  });

  it("refuses a missing designation", () => {
    expect(addStaff(STAFF, { ...input, designation: "" }).ok).toBe(false);
  });

  it("refuses bad contact details", () => {
    expect(addStaff(STAFF, { ...input, email: "nope" }).ok).toBe(false);
    expect(addStaff(STAFF, { ...input, tel: "123" }).ok).toBe(false);
  });

  it("allows blank contact details, which are optional", () => {
    expect(addStaff(STAFF, { ...input, email: "", tel: "" }).ok).toBe(true);
  });

  it("does not mutate the list it was given", () => {
    addStaff(STAFF, input);
    expect(STAFF).toHaveLength(2);
  });
});

describe("editing a staff member", () => {
  it("changes the name", () => {
    const r = editStaff(STAFF, 1, { name: "Karin McGorian" });
    expect(r.ok && r.staff.find((s) => s.id === 1)?.name).toBe("Karin McGorian");
  });

  it("changes the designation", () => {
    const r = editStaff(STAFF, 11, { designation: "Apprentice" });
    expect(r.ok && r.staff.find((s) => s.id === 11)?.designation).toBe("Apprentice");
  });

  it("stores email and telephone", () => {
    const r = editStaff(STAFF, 1, { email: "karin@example.co.za", tel: "082 123 4567" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.staff[0].email).toBe("karin@example.co.za");
      expect(r.staff[0].tel).toBe("082 123 4567");
    }
  });

  it("refuses a blank name", () => {
    const r = editStaff(STAFF, 1, { name: "  " });
    expect(r.ok).toBe(false);
  });

  it("refuses a malformed email", () => {
    const r = editStaff(STAFF, 1, { email: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/email/i);
  });

  it("refuses a malformed phone number", () => {
    const r = editStaff(STAFF, 1, { tel: "123" });
    expect(r.ok).toBe(false);
  });

  it("refuses an unknown staff member", () => {
    expect(editStaff(STAFF, 999, { name: "X" }).ok).toBe(false);
  });

  it("does not mutate the list it was given", () => {
    editStaff(STAFF, 1, { name: "Changed" });
    expect(STAFF[0].name).toBe("Karin M.");
  });
});

describe("designations", () => {
  it("starts with operator and apprentice available", () => {
    expect(DEFAULT_DESIGNATIONS).toContain("Operator");
    expect(DEFAULT_DESIGNATIONS).toContain("Apprentice");
  });

  it("adds a new designation", () => {
    const r = addDesignation(["Stylist"], STAFF, "Colour technician");
    expect(r.ok && r.designations).toContain("Colour technician");
  });

  it("refuses a duplicate, whatever the casing", () => {
    const r = addDesignation(["Stylist"], STAFF, "stylist");
    expect(r.ok).toBe(false);
  });

  it("refuses a blank designation", () => {
    expect(addDesignation(["Stylist"], STAFF, "  ").ok).toBe(false);
  });

  it("renames a designation and moves everyone on it", () => {
    const r = renameDesignation(["Assistant"], STAFF, "Assistant", "Apprentice");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.designations).toEqual(["Apprentice"]);
      expect(r.staff.find((s) => s.id === 11)?.designation).toBe("Apprentice");
    }
  });

  it("leaves other staff alone when renaming", () => {
    const r = renameDesignation(["Assistant"], STAFF, "Assistant", "Apprentice");
    expect(r.ok && r.staff.find((s) => s.id === 1)?.designation).toBe("Senior stylist");
  });

  it("refuses to remove a designation still in use", () => {
    const r = removeDesignation(["Assistant"], STAFF, "Assistant");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/still on/i);
  });

  it("removes an unused designation", () => {
    const r = removeDesignation(["Assistant", "Spare"], STAFF, "Spare");
    expect(r.ok && r.designations).toEqual(["Assistant"]);
  });
});

describe("active status", () => {
  it("turns a staff member off without deleting them", () => {
    const r = setActive(STAFF, 11, false);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.staff).toHaveLength(2);
      expect(r.staff.find((s) => s.id === 11)?.active).toBe(false);
    }
  });

  it("turns one back on", () => {
    const off = setActive(STAFF, 11, false);
    if (!off.ok) throw new Error("setup failed");
    const on = setActive(off.staff, 11, true);
    expect(on.ok && on.staff.find((s) => s.id === 11)?.active).toBe(true);
  });

  it("refuses to deactivate the last active staff member", () => {
    const one: StaffRecord[] = [{ ...STAFF[0] }];
    expect(setActive(one, 1, false).ok).toBe(false);
  });

  it("lists only active staff", () => {
    const off = setActive(STAFF, 11, false);
    expect(off.ok && activeStaff(off.staff).map((s) => s.id)).toEqual([1]);
  });
});
