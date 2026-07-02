CREATE TABLE "drivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"driver_number" integer NOT NULL,
	"short_name" text NOT NULL,
	"code" text NOT NULL,
	"full_name" text NOT NULL,
	"team_id" integer NOT NULL,
	"nationality" text NOT NULL,
	"flag" text NOT NULL,
	"country" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"podiums" integer DEFAULT 0 NOT NULL,
	"poles" integer DEFAULT 0 NOT NULL,
	"championships" integer DEFAULT 0 NOT NULL,
	"dob" text NOT NULL,
	"pob" text NOT NULL,
	"gp_entered" integer DEFAULT 0 NOT NULL,
	"career_points" text DEFAULT '0' NOT NULL,
	"best_finish" text DEFAULT '—' NOT NULL,
	"best_grid" text DEFAULT '—' NOT NULL,
	"dnfs" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lap_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"driver_id" integer NOT NULL,
	"lap_number" integer NOT NULL,
	"lap_time" text,
	"sector_1" text,
	"sector_2" text,
	"sector_3" text,
	"pit_in" boolean DEFAULT false NOT NULL,
	"pit_out" boolean DEFAULT false NOT NULL,
	"occurred_at_utc" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_galleries" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"image_count" integer NOT NULL,
	"category" text NOT NULL,
	"cover_image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_podcasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"episode" text NOT NULL,
	"duration" text NOT NULL,
	"guest" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"duration" text NOT NULL,
	"views" text NOT NULL,
	"category" text NOT NULL,
	"thumbnail_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"category" text NOT NULL,
	"read_time" text NOT NULL,
	"published_date" text NOT NULL,
	"comments" integer,
	"author" text NOT NULL,
	"body" text[] NOT NULL,
	"image_url" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "race_control_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"message_type" text DEFAULT 'Other' NOT NULL,
	"flag" text DEFAULT '' NOT NULL,
	"lap" integer DEFAULT -1 NOT NULL,
	"message_text" text NOT NULL,
	"racing_number" text DEFAULT '' NOT NULL,
	"occurred_at_utc" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "race_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"weekend_id" integer NOT NULL,
	"session_type" text NOT NULL,
	"session_code" text NOT NULL,
	"part" integer,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"source" text DEFAULT 'seed' NOT NULL,
	"is_sprint_weekend" boolean DEFAULT false NOT NULL,
	"start_time_utc" timestamp with time zone NOT NULL,
	"end_time_utc" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "race_weekends" (
	"id" serial PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"round" integer NOT NULL,
	"grand_prix_name" text NOT NULL,
	"circuit" text NOT NULL,
	"country" text NOT NULL,
	"location" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"driver_id" integer NOT NULL,
	"position" integer NOT NULL,
	"best_lap_time" text,
	"gap_to_leader" text,
	"points" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'finished' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_status_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"status" text NOT NULL,
	"status_reason" text,
	"occurred_at_utc" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"podiums" integer DEFAULT 0 NOT NULL,
	"base" text NOT NULL,
	"full_name" text NOT NULL,
	"team_chief" text NOT NULL,
	"technical_chief" text NOT NULL,
	"chassis" text NOT NULL,
	"power_unit" text NOT NULL,
	"first_entry" text NOT NULL,
	"championships" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lap_summaries" ADD CONSTRAINT "lap_summaries_session_id_race_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."race_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lap_summaries" ADD CONSTRAINT "lap_summaries_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_control_messages" ADD CONSTRAINT "race_control_messages_session_id_race_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."race_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_sessions" ADD CONSTRAINT "race_sessions_weekend_id_race_weekends_id_fk" FOREIGN KEY ("weekend_id") REFERENCES "public"."race_weekends"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_results" ADD CONSTRAINT "session_results_session_id_race_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."race_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_results" ADD CONSTRAINT "session_results_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_status_events" ADD CONSTRAINT "session_status_events_session_id_race_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."race_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "drivers_code_unique_idx" ON "drivers" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "drivers_number_unique_idx" ON "drivers" USING btree ("driver_number");--> statement-breakpoint
CREATE UNIQUE INDEX "drivers_short_name_unique_idx" ON "drivers" USING btree ("short_name");--> statement-breakpoint
CREATE INDEX "drivers_team_idx" ON "drivers" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lap_summaries_session_driver_lap_unique_idx" ON "lap_summaries" USING btree ("session_id","driver_id","lap_number");--> statement-breakpoint
CREATE INDEX "lap_summaries_session_driver_lap_idx" ON "lap_summaries" USING btree ("session_id","driver_id","lap_number");--> statement-breakpoint
CREATE INDEX "lap_summaries_session_occurred_idx" ON "lap_summaries" USING btree ("session_id","occurred_at_utc");--> statement-breakpoint
CREATE INDEX "media_galleries_sort_order_idx" ON "media_galleries" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "media_podcasts_sort_order_idx" ON "media_podcasts" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "media_videos_sort_order_idx" ON "media_videos" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "news_articles_featured_idx" ON "news_articles" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "news_articles_sort_order_idx" ON "news_articles" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "race_control_messages_session_occurred_idx" ON "race_control_messages" USING btree ("session_id","occurred_at_utc");--> statement-breakpoint
CREATE UNIQUE INDEX "race_control_messages_dedupe_idx" ON "race_control_messages" USING btree ("session_id","occurred_at_utc","message_type","flag","lap","message_text","racing_number");--> statement-breakpoint
CREATE INDEX "race_sessions_status_start_idx" ON "race_sessions" USING btree ("status","start_time_utc");--> statement-breakpoint
CREATE UNIQUE INDEX "race_sessions_weekend_session_code_unique_idx" ON "race_sessions" USING btree ("weekend_id","session_code");--> statement-breakpoint
CREATE INDEX "race_sessions_weekend_start_idx" ON "race_sessions" USING btree ("weekend_id","start_time_utc");--> statement-breakpoint
CREATE INDEX "race_sessions_weekend_idx" ON "race_sessions" USING btree ("weekend_id");--> statement-breakpoint
CREATE UNIQUE INDEX "race_weekends_season_round_unique_idx" ON "race_weekends" USING btree ("season","round");--> statement-breakpoint
CREATE UNIQUE INDEX "session_results_session_driver_unique_idx" ON "session_results" USING btree ("session_id","driver_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_results_session_position_unique_idx" ON "session_results" USING btree ("session_id","position");--> statement-breakpoint
CREATE INDEX "session_results_session_position_idx" ON "session_results" USING btree ("session_id","position");--> statement-breakpoint
CREATE INDEX "session_status_events_session_occurred_idx" ON "session_status_events" USING btree ("session_id","occurred_at_utc");--> statement-breakpoint
CREATE UNIQUE INDEX "session_status_events_dedupe_idx" ON "session_status_events" USING btree ("session_id","status","occurred_at_utc");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_name_unique_idx" ON "teams" USING btree ("name");--> statement-breakpoint
CREATE INDEX "teams_position_idx" ON "teams" USING btree ("position");