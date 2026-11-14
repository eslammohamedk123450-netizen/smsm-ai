import { prioritizeModelCandidate } from "./model_routing.ts";

const candidate = (id: number) => ({ model: { id } });

Deno.test("prioritizes the configured model when it is in the eligible pool", () => {
  const result = prioritizeModelCandidate([candidate(1), candidate(2), candidate(3)], 2);
  if (result.map((item) => item.model.id).join(",") !== "2,1,3") {
    throw new Error("The configured Gmail model should be tried first.");
  }
});

Deno.test("keeps the pool unchanged when the selected model is not eligible", () => {
  const pool = [candidate(1), candidate(2)];
  const result = prioritizeModelCandidate(pool, 9);
  if (result !== pool || result.map((item) => item.model.id).join(",") !== "1,2") {
    throw new Error("An ineligible model must not be added to the routing pool.");
  }
});

Deno.test("does not reorder when no custom model is configured", () => {
  const pool = [candidate(1), candidate(2)];
  if (prioritizeModelCandidate(pool, null) !== pool) {
    throw new Error("The default model order should remain unchanged.");
  }
});
