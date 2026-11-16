import { buildTextCapabilityEvidencePatch } from "./capability_evidence.ts";

Deno.test("successful text probe records provider pass without inventing vendor or SULY claims", () => {
  const patch = buildTextCapabilityEvidencePatch({
    modelId: 7,
    providerEndpoint: "https://soal.help/api/v1/chat/completions",
    checkKey: "manual-check-1",
    result: { status: "success", duration_ms: 125, error_code: null },
    isRestricted: false,
    nowIso: "2026-11-16T14:00:00.000Z",
  });
  if (!patch) throw new Error("Expected a text evidence patch.");
  if (patch.capability_key !== "text" || patch.provider_test_status !== "passed") {
    throw new Error("Successful probe must record provider text capability as passed.");
  }
  if (patch.vendor_claim_status !== "unknown" || patch.vendor_evidence_url !== null) {
    throw new Error("A provider probe must not invent an upstream vendor claim.");
  }
  if (patch.suly_test_status !== "not_tested") {
    throw new Error("A provider probe alone must not claim SULY integration passed.");
  }
});

Deno.test("successful probe preserves existing vendor and SULY evidence", () => {
  const patch = buildTextCapabilityEvidencePatch({
    modelId: 8,
    providerEndpoint: "https://api.example.com/v1/chat/completions",
    checkKey: "scheduled-check-2",
    result: { status: "success", duration_ms: 95, error_code: null },
    isRestricted: false,
    existing: {
      vendor_claim_status: "supported",
      vendor_evidence_url: "https://vendor.example.com/models",
      suly_test_status: "passed",
      suly_test_evidence_url: "https://app.example.com/test-runs/123",
      notes: "Existing verified notes",
    },
  });
  if (!patch) throw new Error("Expected a text evidence patch.");
  if (patch.vendor_claim_status !== "supported" || patch.vendor_evidence_url !== "https://vendor.example.com/models") {
    throw new Error("Existing vendor evidence must be preserved.");
  }
  if (patch.suly_test_status !== "passed" || patch.suly_test_evidence_url !== "https://app.example.com/test-runs/123") {
    throw new Error("A successful provider probe must preserve an existing SULY pass.");
  }
});

Deno.test("one transient failure on a healthy model does not overwrite the last provider evidence", () => {
  const patch = buildTextCapabilityEvidencePatch({
    modelId: 9,
    providerEndpoint: "https://api.example.com/v1/chat/completions",
    checkKey: "manual-failure",
    result: { status: "error", duration_ms: 1000, error_code: "timeout" },
    isRestricted: false,
    existing: { provider_test_status: "passed" } as never,
  });
  if (patch !== null) throw new Error("Transient failures must not overwrite provider evidence.");
});

Deno.test("restricted provider failure marks text failed and invalidates a previous SULY pass", () => {
  const patch = buildTextCapabilityEvidencePatch({
    modelId: 10,
    providerEndpoint: "https://api.example.com/v1/chat/completions",
    checkKey: "scheduled-restricted-failure",
    result: { status: "error", duration_ms: 3000, error_code: "upstream_unavailable" },
    isRestricted: true,
    existing: {
      vendor_claim_status: "supported",
      vendor_evidence_url: "https://vendor.example.com/models",
      suly_test_status: "passed",
      suly_test_evidence_url: "https://app.example.com/test-runs/456",
    },
  });
  if (!patch) throw new Error("Expected a failed text evidence patch for a restricted model.");
  if (patch.provider_test_status !== "failed") throw new Error("Restricted provider failure must be recorded.");
  if (patch.suly_test_status !== "not_tested" || patch.suly_test_evidence_url !== null) {
    throw new Error("A provider failure must invalidate the prior SULY pass.");
  }
  if (patch.vendor_claim_status !== "supported") throw new Error("Vendor claims must remain independent.");
});

Deno.test("text probe evidence requires a safe HTTPS provider endpoint", () => {
  const patch = buildTextCapabilityEvidencePatch({
    modelId: 11,
    providerEndpoint: "http://insecure.example.com/chat/completions",
    checkKey: "bad-url",
    result: { status: "success", duration_ms: 10, error_code: null },
    isRestricted: false,
  });
  if (patch !== null) throw new Error("Insecure provider endpoints must not be recorded as evidence URLs.");
});
