import { getCreditDisplay } from "./credit-presentation";

describe("getCreditDisplay", () => {
  it("shows a settled charge as a negative debit even when balance_delta is zero", () => {
    expect(getCreditDisplay({ event_type: "settle", amount: 5, balance_delta: 0 }))
      .toEqual({ kind: "debit", amount: 5 });
  });

  it("shows a reservation as reserved, not as zero consumption", () => {
    expect(getCreditDisplay({ event_type: "reserve", amount: 5, balance_delta: 0 }))
      .toEqual({ kind: "reserved", amount: 5 });
  });

  it("shows wallet additions as positive credits", () => {
    expect(getCreditDisplay({ event_type: "daily_grant", amount: 10, balance_delta: 10 }))
      .toEqual({ kind: "credit", amount: 10 });
  });

  it("shows wallet deductions as negative debits", () => {
    expect(getCreditDisplay({ event_type: "admin_adjust", amount: 3, balance_delta: -3 }))
      .toEqual({ kind: "debit", amount: 3 });
  });
});
