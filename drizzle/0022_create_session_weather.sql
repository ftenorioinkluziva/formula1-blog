CREATE TABLE IF NOT EXISTS "session_weather" (
  "id" serial PRIMARY KEY NOT NULL,
  "session_id" integer NOT NULL REFERENCES "race_sessions"("id") ON DELETE CASCADE,
  "air_temperature" real,
  "track_temperature" real,
  "humidity" integer,
  "pressure" real,
  "rainfall" boolean NOT NULL DEFAULT false,
  "wind_direction" integer,
  "wind_speed" real,
  "recorded_at_utc" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "session_weather_session_recorded_idx" ON "session_weather" ("session_id", "recorded_at_utc");
CREATE INDEX IF NOT EXISTS "session_weather_session_idx" ON "session_weather" ("session_id");
