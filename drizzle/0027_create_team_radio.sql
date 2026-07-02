CREATE TABLE IF NOT EXISTS "team_radio" (
  "id" serial PRIMARY KEY NOT NULL,
  "session_id" integer NOT NULL REFERENCES "race_sessions"("id") ON DELETE CASCADE,
  "driver_id" integer NOT NULL REFERENCES "drivers"("id") ON DELETE CASCADE,
  "recording_url" text NOT NULL,
  "lap" integer,
  "occurred_at_utc" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "team_radio_session_driver_url_idx" ON "team_radio" ("session_id", "driver_id", "recording_url");
CREATE INDEX "team_radio_session_idx" ON "team_radio" ("session_id");
