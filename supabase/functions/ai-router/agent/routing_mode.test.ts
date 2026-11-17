import { resolveRoutingMode } from "./routing_mode.ts";

Deno.test("SULY profiles never force manual model selection", () => {
  for (const profile of ["lite", "pro", "max", "x"]) {
    const mode = resolveRoutingMode({ requestedMode: "auto", hasExplicitModel: false });
    if (mode !== "auto") throw new Error(`${profile} profile must retain automatic model routing`);
  }
});

Deno.test("only explicit model selection or manual mode enables manual routing", () => {
  if (resolveRoutingMode({ requestedMode: "manual", hasExplicitModel: false }) !== "manual") {
    throw new Error("explicit manual routing must remain manual");
  }
  if (resolveRoutingMode({ requestedMode: undefined, hasExplicitModel: true }) !== "manual") {
    throw new Error("an explicit model without auto mode must use manual routing");
  }
  if (resolveRoutingMode({ requestedMode: "auto", hasExplicitModel: true }) !== "auto") {
    throw new Error("explicit auto mode must keep automatic routing");
  }
  if (resolveRoutingMode({ requestedMode: "auto", hasExplicitModel: false }) !== "auto") {
    throw new Error("normal profile routing must remain automatic");
  }
});
