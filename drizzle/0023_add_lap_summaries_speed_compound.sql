ALTER TABLE "lap_summaries" ADD COLUMN IF NOT EXISTS "i1_speed" integer;
ALTER TABLE "lap_summaries" ADD COLUMN IF NOT EXISTS "i2_speed" integer;
ALTER TABLE "lap_summaries" ADD COLUMN IF NOT EXISTS "st_speed" integer;
ALTER TABLE "lap_summaries" ADD COLUMN IF NOT EXISTS "compound" text;
