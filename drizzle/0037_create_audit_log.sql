CREATE TABLE IF NOT EXISTS "admin_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" text NOT NULL,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "admin_audit_log_actor_idx" ON "admin_audit_log" ("actor_user_id");
CREATE INDEX IF NOT EXISTS "admin_audit_log_action_idx" ON "admin_audit_log" ("action");
CREATE INDEX IF NOT EXISTS "admin_audit_log_target_idx" ON "admin_audit_log" ("target_type", "target_id");
