import { isConnectorApprovalBoundToRequest } from "./connector_approval.ts";

const requestId = "c73ccfd0-3b56-4ae4-b3d1-251cf4dad103";
const operation = "أرسل إلى أحمد: موعدنا غدًا";

Deno.test("accepts only an exact approval for the current request and operation", () => {
  if (!isConnectorApprovalBoundToRequest(requestId, operation, requestId, operation)) throw new Error("Exact approval should be accepted");
  if (isConnectorApprovalBoundToRequest(requestId, `${operation}!`, requestId, operation)) throw new Error("Changed operation must not be accepted");
  if (isConnectorApprovalBoundToRequest("b73ccfd0-3b56-4ae4-b3d1-251cf4dad104", operation, requestId, operation)) throw new Error("Different request ID must not be accepted");
  if (isConnectorApprovalBoundToRequest(true, operation, requestId, operation)) throw new Error("Legacy boolean approval must not be accepted");
  if (isConnectorApprovalBoundToRequest("not-a-uuid", operation, requestId, operation)) throw new Error("Invalid request ID must not be accepted");
});
