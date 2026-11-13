const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Require an explicit client approval envelope tied to the exact immutable
 * request ID and user operation. The router separately consumes the write
 * approval atomically before calling the external connector; a legacy boolean
 * is deliberately ignored.
 */
export function isConnectorApprovalBoundToRequest(
  approvalRequestId: unknown,
  approvalOriginalText: unknown,
  requestId: string,
  userOperation: string,
): boolean {
  return typeof approvalRequestId === "string"
    && UUID_PATTERN.test(approvalRequestId)
    && approvalRequestId === requestId
    && typeof approvalOriginalText === "string"
    && approvalOriginalText === userOperation;
}
