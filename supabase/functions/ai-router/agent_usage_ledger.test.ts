import { assertEquals } from "jsr:@std/assert@1";
import { buildAgentUsageLedgerRecord } from "./agent_usage_ledger.ts";

Deno.test("provider attempt start creates an unknown usage checkpoint", () => {
  assertEquals(buildAgentUsageLedgerRecord({
    stage: "started",
    status: "cancelled",
    usageReported: false,
    inputTokens: 0,
    outputTokens: 0,
    inputCreditsPer1k: 1,
    outputCreditsPer1k: 1,
  }), {
    inputTokens: null,
    outputTokens: null,
    actualCost: null,
    usageStatus: "unknown",
    usageSource: "unavailable",
  });
});

Deno.test("successful provider-reported usage is billable", () => {
  assertEquals(buildAgentUsageLedgerRecord({
    stage: "finished",
    status: "success",
    usageReported: true,
    inputTokens: 120,
    outputTokens: 45,
    inputCreditsPer1k: 1,
    outputCreditsPer1k: 2,
  }), {
    inputTokens: 120,
    outputTokens: 45,
    actualCost: 1,
    usageStatus: "completed",
    usageSource: "provider_reported",
  });
});

Deno.test("failed attempts with reported usage retain partial provider cost", () => {
  assertEquals(buildAgentUsageLedgerRecord({
    stage: "finished",
    status: "timeout",
    usageReported: true,
    inputTokens: 300,
    outputTokens: 20,
    inputCreditsPer1k: 2,
    outputCreditsPer1k: 3,
  }), {
    inputTokens: 300,
    outputTokens: 20,
    actualCost: 1,
    usageStatus: "partial",
    usageSource: "provider_reported_partial",
  });
});

Deno.test("estimated zero defaults never masquerade as provider usage", () => {
  assertEquals(buildAgentUsageLedgerRecord({
    stage: "finished",
    status: "success",
    usageReported: false,
    inputTokens: 0,
    outputTokens: 0,
    inputCreditsPer1k: 1,
    outputCreditsPer1k: 1,
  }).usageStatus, "unknown");
});
