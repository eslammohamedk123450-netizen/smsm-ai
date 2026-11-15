export type MediaPriceForCost = {
  price_credits: number;
  estimated_provider_cost_usd: number;
  target_margin: number;
  credit_value_egp: number;
  usd_to_egp: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/**
 * Only explicitly USD-denominated fields are authoritative USD costs.
 * Generic "cost" fields are ignored unless the provider labels their currency as USD;
 * some OpenAI-compatible gateways report those values in EGP.
 */
export function actualCostUsd(
  payload: Record<string, unknown>,
  fallback: number,
): { value: number; confirmed: boolean } {
  const usage = asRecord(payload.usage);
  const currency = String(
    usage.cost_currency ?? usage.currency ??
    payload.cost_currency ?? payload.currency ?? "",
  ).trim().toUpperCase();

  const candidates = [
    usage.cost_usd,
    usage.provider_cost_usd,
    payload.cost_usd,
    payload.provider_cost_usd,
    ...(currency === "USD" || currency === "US$" ? [usage.cost, payload.cost] : []),
  ];

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === "") continue;
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0 && value <= 100000) {
      return { value, confirmed: true };
    }
  }

  return { value: fallback, confirmed: false };
}

export function validateEnabledMediaPrice(
  price: MediaPriceForCost,
): { valid: true; minimumCredits: number } | { valid: false; reason: string } {
  if (!Number.isSafeInteger(price.price_credits) || price.price_credits < 1) {
    return { valid: false, reason: "price_credits must be a positive integer" };
  }
  if (!Number.isFinite(price.estimated_provider_cost_usd) || price.estimated_provider_cost_usd <= 0) {
    return { valid: false, reason: "estimated_provider_cost_usd must be greater than zero" };
  }
  if (!Number.isFinite(price.credit_value_egp) || price.credit_value_egp <= 0) {
    return { valid: false, reason: "credit_value_egp must be greater than zero" };
  }
  if (!Number.isFinite(price.usd_to_egp) || price.usd_to_egp <= 0) {
    return { valid: false, reason: "usd_to_egp must be greater than zero" };
  }
  if (!Number.isFinite(price.target_margin) || price.target_margin < 0 || price.target_margin >= 1) {
    return { valid: false, reason: "target_margin must be between zero and one (exclusive)" };
  }

  const minimumCredits = Math.ceil(
    (price.estimated_provider_cost_usd * price.usd_to_egp) /
    ((1 - price.target_margin) * price.credit_value_egp),
  );
  if (!Number.isSafeInteger(minimumCredits) || minimumCredits < 1) {
    return { valid: false, reason: "computed minimum credits are invalid" };
  }
  if (price.price_credits < minimumCredits) {
    return { valid: false, reason: `price_credits must be at least ${minimumCredits} for the configured cost and margin` };
  }
  return { valid: true, minimumCredits };
}

export function actualChargeCredits(
  costUsd: number,
  price: MediaPriceForCost,
  costConfirmed: boolean,
): number {
  if (!costConfirmed) return price.price_credits;
  if (
    !Number.isFinite(costUsd) || costUsd < 0 ||
    !Number.isFinite(price.credit_value_egp) || price.credit_value_egp <= 0 ||
    !Number.isFinite(price.usd_to_egp) || price.usd_to_egp <= 0 ||
    !Number.isFinite(price.target_margin) || price.target_margin < 0 || price.target_margin >= 1
  ) return price.price_credits;

  const revenueEgp = (costUsd * price.usd_to_egp) / (1 - price.target_margin);
  const computed = Math.ceil(revenueEgp / price.credit_value_egp);
  if (Number.isSafeInteger(computed) && computed >= 0) return Math.min(1000000000, computed);
  return price.price_credits;
}
