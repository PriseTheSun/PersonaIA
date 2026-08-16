-- Supports stable newest-first pagination when no organization/action filter is
-- selected. The UUID tiebreaker avoids a full sort for equal timestamps.
CREATE INDEX "AuditLog_createdAt_id_desc_idx" ON "AuditLog"("createdAt" DESC, "id" DESC);
