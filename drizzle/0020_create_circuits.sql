CREATE TABLE IF NOT EXISTS "circuits" (
  "id" serial PRIMARY KEY NOT NULL,
  "circuit_id" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "locality" text,
  "country" text,
  "lat" real,
  "lng" real,
  "wiki_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "race_weekends" ADD COLUMN IF NOT EXISTS "circuit_ref" text;
