-- Serves the audit log's "action starts with" filter (LIKE 'x%') newest-first, under any collation.
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action" text_pattern_ops, "createdAt" DESC);
