CREATE TABLE "f1tv_sync_points" (
  "id" serial PRIMARY KEY NOT NULL,
  "session_id" integer NOT NULL REFERENCES "race_sessions"("id") ON DELETE CASCADE,
  "content_id" integer NOT NULL,
  "channel_id" integer,
  "stream_start_utc" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "f1tv_sync_points_session_content_channel_idx"
  ON "f1tv_sync_points" ("session_id", "content_id", COALESCE("channel_id", -1));

CREATE INDEX "f1tv_sync_points_session_idx" ON "f1tv_sync_points" ("session_id");
