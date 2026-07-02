CREATE TABLE IF NOT EXISTS "overtakes" (
  "id" serial PRIMARY KEY NOT NULL,
  "session_id" integer NOT NULL REFERENCES "race_sessions"("id") ON DELETE CASCADE,
  "overtaking_driver_id" integer NOT NULL REFERENCES "drivers"("id") ON DELETE CASCADE,
  "overtaken_driver_id" integer NOT NULL REFERENCES "drivers"("id") ON DELETE CASCADE,
  "lap" integer NOT NULL,
  "position" integer,
  "occurred_at_utc" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "overtakes_session_dedupe_idx" ON "overtakes" ("session_id", "overtaking_driver_id", "overtaken_driver_id", "occurred_at_utc");
CREATE INDEX "overtakes_session_idx" ON "overtakes" ("session_id");
