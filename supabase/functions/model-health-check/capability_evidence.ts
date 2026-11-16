export type TextProbeResult = {
  status: "success" | "error";
  duration_ms: number;
  error_code: string | null;
};

export type ExistingTextCapabilityEvidence = {
  vendor_claim_status?: "unknown" | "supported" | "unsupported" | null;
  vendor_evidence_url?: string | null;
  suly_test_status?: "not_tested" | "passed" | "failed" | null;
  suly_evidence_url?: string | null;
  suly_tested_at?: string | null;
  notes?: string | null;
};

export type TextCapabilityEvidencePatch = {
  model_id: number;
  capability_key: "text";
  vendor_claim_status: "unknown" | "supported" | "unsupported";
  vendor_evidence_url: string | null;
  provider_test_status: "passed" | "failed";
  provider_evidence_url: string;
  provider_tested_at: string;
  suly_test_status: "not_tested" | "passed" | "failed";
  suly_evidence_url: string | null;
  suly_tested_at: string | null;
  notes: string;
  updated_at: string;
};

/**
 * Synchronize only an actual text/chat probe result. A single transient failure
 * on a healthy model does not erase its last known provider status; failures
 * become authoritative only after the existing health system restricts the
 * model. A later successful probe restores provider status to passed.
 */
export function buildTextCapabilityEvidencePatch(input: {
  modelId: number;
  providerEndpoint: string | null;
  checkKey: string;
  result: TextProbeResult;
  isRestricted: boolean;
  existing?: ExistingTextCapabilityEvidence | null;
  nowIso?: string;
}): TextCapabilityEvidencePatch | null {
  if (!input.providerEndpoint || !/^https:\/\//i.test(input.providerEndpoint)) return null;
  if (input.result.status === "error" && !input.isRestricted) return null;

  const providerStatus = input.result.status === "success" ? "passed" : "failed";
  const previousSulyStatus = input.existing?.suly_test_status ?? "not_tested";
  const resetSuly = providerStatus === "failed" && previousSulyStatus === "passed";
  const note = [
    `Text/chat provider probe: ${providerStatus}`,
    `check_key=${input.checkKey.slice(0, 180)}`,
    `duration_ms=${Math.max(0, Math.floor(input.result.duration_ms))}`,
    input.result.error_code ? `error_code=${input.result.error_code.slice(0, 120)}` : "",
    resetSuly ? "Previous SULY pass reset because provider probe failed after restriction." : "",
  ].filter(Boolean).join("; ");
  const notes = [input.existing?.notes?.trim(), note].filter(Boolean).join("\n").slice(-2000);
  const testedAt = input.nowIso ?? new Date().toISOString();

  return {
    model_id: input.modelId,
    capability_key: "text",
    vendor_claim_status: input.existing?.vendor_claim_status ?? "unknown",
    vendor_evidence_url: input.existing?.vendor_evidence_url ?? null,
    provider_test_status: providerStatus,
    provider_evidence_url: input.providerEndpoint,
    provider_tested_at: testedAt,
    suly_test_status: resetSuly ? "not_tested" : previousSulyStatus,
    suly_evidence_url: resetSuly ? null : input.existing?.suly_evidence_url ?? null,
    suly_tested_at: resetSuly ? null : input.existing?.suly_tested_at ?? null,
    notes,
    updated_at: testedAt,
  };
}
