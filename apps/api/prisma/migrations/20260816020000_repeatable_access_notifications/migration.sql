DROP INDEX IF EXISTS "Notification_recipientId_tenantId_type_targetId_key";

CREATE INDEX "Notification_recipientId_tenantId_type_targetId_idx"
ON "Notification"("recipientId", "tenantId", "type", "targetId");
