CREATE TABLE IF NOT EXISTS "pole_videos" (
  "id" serial PRIMARY KEY NOT NULL,
  "season" integer NOT NULL,
  "round" integer NOT NULL,
  "cloudinary_url" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pole_videos_season_round_unique" UNIQUE("season","round")
);
