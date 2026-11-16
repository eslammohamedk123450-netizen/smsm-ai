import { hasCapabilityEvidenceConflict, prioritizeModelCandidate, restrictModelsToAssignedRoute, type ModelCapabilityEvidence } from "./model_routing.ts";

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



Deno.test("configured route assignments restrict the eligible pool to selected models", () => {
  const pool = [candidate(1), candidate(2), candidate(3)];
  const assignments = [
    { route_role: "planner", model_id: 2, enabled: true },
    { route_role: "planner", model_id: 3, enabled: true },
    { route_role: "chat", model_id: 1, enabled: true },
    { route_role: "planner", model_id: 1, enabled: false },
  ];
  const result = restrictModelsToAssignedRoute(pool, assignments, "planner");
  if (result.map((item) => item.model.id).join(",") !== "2,3") {
    throw new Error("Only enabled models assigned to the requested role should remain.");
  }
});

Deno.test("an empty route fails closed instead of silently using every eligible model", () => {
  const result = restrictModelsToAssignedRoute([candidate(1), candidate(2)], [], "worker");
  if (result.length !== 0) throw new Error("An unconfigured route must not fall back to arbitrary models.");
});


const capabilityEvidence = (
  capability_key: string,
  vendor_claim_status: ModelCapabilityEvidence["vendor_claim_status"] = "supported",
  provider_test_status: ModelCapabilityEvidence["provider_test_status"] = "not_tested",
  suly_test_status: ModelCapabilityEvidence["suly_test_status"] = "not_tested",
  model_id = 1,
): ModelCapabilityEvidence => ({
  model_id, capability_key, vendor_claim_status, provider_test_status, suly_test_status,
});

Deno.test("capability evidence leaves legacy routing unchanged when no evidence exists", () => {
  if (hasCapabilityEvidenceConflict(1, ["chat", "vision"], [])) {
    throw new Error("Missing evidence must preserve legacy capability routing.");
  }
});

Deno.test("explicit upstream unsupported claim blocks only the matching required capability", () => {
  const rows = [capabilityEvidence("audio_input", "unsupported")];
  if (!hasCapabilityEvidenceConflict(1, ["audio"], rows)) {
    throw new Error("An explicitly unsupported audio input capability must be blocked.");
  }
  if (hasCapabilityEvidenceConflict(1, ["chat"], rows)) {
    throw new Error("An unrelated text request must not be blocked by audio evidence.");
  }
});

Deno.test("failed provider or SULY probes block the affected capability", () => {
  const providerFailed = [capabilityEvidence("vision", "supported", "failed")];
  const sulyFailed = [capabilityEvidence("vision", "supported", "passed", "failed")];
  if (!hasCapabilityEvidenceConflict(1, ["vision"], providerFailed)) {
    throw new Error("A failed provider probe must block vision routing.");
  }
  if (!hasCapabilityEvidenceConflict(1, ["vision"], sulyFailed)) {
    throw new Error("A failed SULY integration test must block vision routing.");
  }
});

Deno.test("a successful provider probe can validate a gateway-specific alias despite upstream negative evidence", () => {
  const rows = [capabilityEvidence("video_input", "unsupported", "passed")];
  if (hasCapabilityEvidenceConflict(1, ["video"], rows)) {
    throw new Error("A successful provider probe should override an upstream alias mismatch.");
  }
});

Deno.test("a successful SULY integration test is authoritative for the capability", () => {
  const rows = [capabilityEvidence("pdf_input", "unsupported", "failed", "passed")];
  if (hasCapabilityEvidenceConflict(1, ["pdf"], rows)) {
    throw new Error("A successful SULY test should be authoritative for a verified gateway alias.");
  }
});

Deno.test("legacy attachment capability names map to their normalized evidence keys", () => {
  const rows = [
    capabilityEvidence("text", "unsupported"),
    capabilityEvidence("vision", "unsupported"),
    capabilityEvidence("pdf_input", "unsupported"),
    capabilityEvidence("file_input", "unsupported"),
    capabilityEvidence("video_input", "unsupported"),
  ];
  for (const required of ["chat", "vision", "pdf", "word", "video"]) {
    if (!hasCapabilityEvidenceConflict(1, [required], rows)) {
      throw new Error(`Expected evidence conflict for ${required}.`);
    }
  }
});

Deno.test("connector capabilities remain governed by the connector registry, not model modality evidence", () => {
  const rows = [capabilityEvidence("gmail", "unsupported")];
  if (hasCapabilityEvidenceConflict(1, ["gmail"], rows)) {
    throw new Error("External Gmail connector availability must not be treated as a model-native modality.");
  }
});
