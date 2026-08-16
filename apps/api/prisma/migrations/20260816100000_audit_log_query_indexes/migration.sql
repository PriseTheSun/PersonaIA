-- The global audit screen filters and sorts an append-only, potentially large
-- table. These indexes keep the allowlisted action/resource filters bounded.
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "AuditLog_targetType_createdAt_idx" ON "AuditLog"("targetType", "createdAt");
