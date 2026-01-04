// src/services/fulfillmentAudit.js
import { prisma } from "../db/client.js";

/**
 * Record an immutable audit event for a fulfillment order
 *
 * @param {Object} params
 * @param {number} params.fulfillmentOrderId
 * @param {string} params.action            - short action name (e.g. "CJ_RETRY", "FALLBACK")
 * @param {string|null} params.previousStatus
 * @param {string|null} params.newStatus
 * @param {string} params.performedBy       - "system" | "admin"
 * @param {string|null} params.reason
 */
export async function logFulfillmentAudit({
  fulfillmentOrderId,
  action,
  previousStatus = null,
  newStatus = null,
  performedBy = "system",
  reason = null,
}) {
  if (!fulfillmentOrderId || !action) {
    throw new Error("logFulfillmentAudit missing required fields");
  }

  return prisma.fulfillmentAuditLog.create({
    data: {
      fulfillmentOrderId,
      action,
      previousStatus,
      newStatus,
      performedBy,
      reason,
    },
  });
}
