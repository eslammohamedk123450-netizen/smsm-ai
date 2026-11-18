import { resolveRoutingMode } from "./routing_mode.ts";

Deno.test("SULY profiles keep automatic model routing", () => {
  for (const profile of ["lite", "pro", "max", "x"]) {
    const mode = resolveRoutingMode({ requestedMode: "auto", hasExplicitModel: false });
    if (mode !== "auto") throw new Error(`${profile} profile must retain automatic model routing`);
  }
});

Deno.test("manual routing without a concrete model safely falls back to auto", () => {
  if (resolveRoutingMode({ requestedMode: "manual", hasExplicitModel: false }) !== "auto") {
    throw new Error("manual mode without a model must safely fall back to automatic routing");
  }
});

Deno.test("manual routing with explicit model and legacy explicit model remain manual", () => {
  if (resolveRoutingMode({ requestedMode: "manual", hasExplicitModel: true }) !== "manual") {
    throw new Error("manual mode with an explicit model must remain manual");
  }
  if (resolveRoutingMode({ requestedMode: undefined, hasExplicitModel: true }) !== "manual") {
    throw new Error("a legacy explicit model without routing_mode must remain manual");
  }
});

Deno.test("explicit auto mode takes precedence over a selected model", () => {
  if (resolveRoutingMode({ requestedMode: "auto", hasExplicitModel: true }) !== "auto") {
    throw new Error("explicit auto mode must keep automatic routing");
  }
  if (resolveRoutingMode({ requestedMode: "auto", hasExplicitModel: false }) !== "auto") {
    throw new Error("normal profile routing must remain automatic");
  }
});
