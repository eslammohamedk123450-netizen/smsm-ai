export type CreditDisplayKind = "credit" | "debit" | "reserved" | "neutral";

export type CreditDisplay = {
  kind: CreditDisplayKind;
  amount: number;
};

/**
 * Wallet balance_delta and task charge are different ledger facts:
 * reserve changes reserved_balance, while settle records the actual charge.
 * Present the user's real charge instead of a zero wallet delta.
 */
export function getCreditDisplay(entry: {
  event_type: string;
  amount: number;
  balance_delta: number;
}): CreditDisplay {
  const amount = Number.isFinite(Number(entry.amount)) ? Math.abs(Number(entry.amount)) : 0;
  if (entry.event_type === "settle") return { kind: amount > 0 ? "debit" : "neutral", amount };
  if (entry.event_type === "reserve") return { kind: amount > 0 ? "reserved" : "neutral", amount };
  const delta = Number.isFinite(Number(entry.balance_delta)) ? Number(entry.balance_delta) : 0;
  if (delta > 0) return { kind: "credit", amount: delta };
  if (delta < 0) return { kind: "debit", amount: Math.abs(delta) };
  return { kind: "neutral", amount: 0 };
}
