import {
  actualChargeCredits,
  actualCostUsd,
  validateEnabledMediaPrice,
  providerEndpointAllowed,
} from "./cost.ts";

const validPrice = {
  price_credits: 50,
  estimated_provider_cost_usd: 0.5,
  target_margin: 0.3,
  credit_value_egp: 0.1,
  usd_to_egp: 50,
};

Deno.test("accepts an explicitly USD-denominated provider cost", () => {
  const result = actualCostUsd({ usage: { cost_usd: 0.25 } }, 0.5);
  if (!result.confirmed || result.value !== 0.25) throw new Error("explicit USD cost was not accepted");
});

Deno.test("does not interpret an unlabeled gateway cost as USD", () => {
  const result = actualCostUsd({ usage: { cost: 5 } }, 0.5);
  if (result.confirmed || result.value !== 0.5) throw new Error("unlabeled cost must use the estimate");
});

Deno.test("does not interpret an EGP gateway cost as USD", () => {
  const result = actualCostUsd({ usage: { cost: 5, currency: "EGP" } }, 0.5);
  if (result.confirmed || result.value !== 0.5) throw new Error("EGP cost was misclassified as USD");
});

Deno.test("accepts a generic cost only when the provider explicitly labels USD", () => {
  const result = actualCostUsd({ usage: { cost: 0.25, currency: "USD" } }, 0.5);
  if (!result.confirmed || result.value !== 0.25) throw new Error("USD-labelled cost was not accepted");
});

Deno.test("requires FX, credit value, and estimated cost before enabling a price", () => {
  const result = validateEnabledMediaPrice({
    ...validPrice,
    credit_value_egp: 0,
  });
  if (result.valid) throw new Error("zero credit value must be rejected");
});

Deno.test("rejects a reserve below the cost-plus-margin floor", () => {
  const result = validateEnabledMediaPrice({
    ...validPrice,
    price_credits: 10,
  });
  if (result.valid) throw new Error("underpriced reservation must be rejected");
});

Deno.test("accepts a fully funded price and reports its minimum reserve", () => {
  const result = validateEnabledMediaPrice(validPrice);
  if (!result.valid || result.minimumCredits !== 358) {
    throw new Error(`unexpected price validation result: ${JSON.stringify(result)}`);
  }
});

Deno.test("uses the fixed reservation when provider cost is not confirmed", () => {
  const result = actualChargeCredits(0.25, validPrice, false);
  if (result !== 50) throw new Error("unconfirmed cost must use the configured reserve");
});

Deno.test("settles credits using confirmed USD cost and FX", () => {
  const result = actualChargeCredits(0.25, validPrice, true);
  if (result !== 179) throw new Error(`unexpected settled credits: ${result}`);
});

Deno.test("accepts an image endpoint under the configured provider base path", () => {
  if (!providerEndpointAllowed(
    "https://soal.help/api/v1/images/generations",
    "https://soal.help/api/v1",
  )) throw new Error("valid provider image endpoint was rejected");
});

Deno.test("rejects endpoints on a different host", () => {
  if (providerEndpointAllowed(
    "https://attacker.example/api/v1/images/generations",
    "https://soal.help/api/v1",
  )) throw new Error("cross-host endpoint was accepted");
});

Deno.test("rejects insecure and private endpoint URLs", () => {
  const invalid = [
    ["http://soal.help/api/v1/images/generations", "https://soal.help/api/v1"],
    ["https://127.0.0.1/api/v1/images/generations", "https://127.0.0.1/api/v1"],
    ["https://localhost/api/v1/images/generations", "https://localhost/api/v1"],
    ["https://soal.help/api/v1/images/generations?redirect=https://evil.example", "https://soal.help/api/v1"],
  ];
  for (const [endpoint, base] of invalid) {
    if (providerEndpointAllowed(endpoint, base)) throw new Error(`unsafe endpoint accepted: ${endpoint}`);
  }
});

Deno.test("rejects a path outside the OpenAI Images endpoint", () => {
  if (providerEndpointAllowed(
    "https://soal.help/api/v1/admin",
    "https://soal.help/api/v1",
  )) throw new Error("non-image endpoint was accepted");
});
