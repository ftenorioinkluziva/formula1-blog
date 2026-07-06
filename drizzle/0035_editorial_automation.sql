CREATE TABLE IF NOT EXISTS "editorial_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"raw_input" text NOT NULL,
	"topic_canonical" text NOT NULL,
	"assignment_type" text NOT NULL,
	"editorial_desk" text NOT NULL,
	"season" integer,
	"round" integer,
	"session_id" integer,
	"status" text DEFAULT 'new' NOT NULL,
	"confidence_score" real,
	"locale" text DEFAULT 'pt' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_log" text,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"source_event_key" text,
	"news_article_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "editorial_source_packets" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"packet_json" jsonb NOT NULL,
	"packet_hash" text NOT NULL,
	"source_summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "editorial_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"pending_article_id" integer,
	"review_type" text NOT NULL,
	"status" text NOT NULL,
	"score" real,
	"issues_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "article_source_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"pending_article_id" integer NOT NULL,
	"source_type" text NOT NULL,
	"source_ref" text NOT NULL,
	"source_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Extensions to news_articles
ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "locale" text DEFAULT 'pt' NOT NULL;
CREATE INDEX IF NOT EXISTS "news_articles_locale_idx" ON "news_articles" ("locale");

-- Extensions to pending_articles
ALTER TABLE "pending_articles" ADD COLUMN IF NOT EXISTS "assignment_type" text;
ALTER TABLE "pending_articles" ADD COLUMN IF NOT EXISTS "editorial_desk" text;
ALTER TABLE "pending_articles" ADD COLUMN IF NOT EXISTS "season" integer;
ALTER TABLE "pending_articles" ADD COLUMN IF NOT EXISTS "round" integer;
ALTER TABLE "pending_articles" ADD COLUMN IF NOT EXISTS "session_id" integer;
ALTER TABLE "pending_articles" ADD COLUMN IF NOT EXISTS "review_status" text;
ALTER TABLE "pending_articles" ADD COLUMN IF NOT EXISTS "confidence_score" real;
ALTER TABLE "pending_articles" ADD COLUMN IF NOT EXISTS "source_packet_id" integer;
ALTER TABLE "pending_articles" ADD COLUMN IF NOT EXISTS "news_article_id" integer;
ALTER TABLE "pending_articles" ADD COLUMN IF NOT EXISTS "locale" text DEFAULT 'pt' NOT NULL;
ALTER TABLE "pending_articles" ADD COLUMN IF NOT EXISTS "override_reason" text;
ALTER TABLE "pending_articles" ADD COLUMN IF NOT EXISTS "override_at" timestamp with time zone;
ALTER TABLE "pending_articles" ADD COLUMN IF NOT EXISTS "override_by" text;

CREATE INDEX IF NOT EXISTS "pending_articles_locale_idx" ON "pending_articles" ("locale");
CREATE INDEX IF NOT EXISTS "pending_articles_assignment_idx" ON "pending_articles" ("session_id", "assignment_type");

-- Foreign key constraints and indexes
CREATE INDEX IF NOT EXISTS "editorial_assignments_status_idx" ON "editorial_assignments" ("status");
CREATE INDEX IF NOT EXISTS "editorial_assignments_next_attempt_idx" ON "editorial_assignments" ("status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "editorial_assignments_session_idx" ON "editorial_assignments" ("session_id");
CREATE INDEX IF NOT EXISTS "editorial_source_packets_assignment_idx" ON "editorial_source_packets" ("assignment_id");
CREATE INDEX IF NOT EXISTS "editorial_reviews_assignment_idx" ON "editorial_reviews" ("assignment_id");
CREATE INDEX IF NOT EXISTS "editorial_reviews_pending_article_idx" ON "editorial_reviews" ("pending_article_id");
CREATE INDEX IF NOT EXISTS "article_source_links_pending_article_idx" ON "article_source_links" ("pending_article_id");

DO $$ BEGIN
 ALTER TABLE "editorial_assignments" ADD CONSTRAINT "editorial_assignments_session_id_race_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "race_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "editorial_source_packets" ADD CONSTRAINT "editorial_source_packets_assignment_id_editorial_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "editorial_assignments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "editorial_reviews" ADD CONSTRAINT "editorial_reviews_assignment_id_editorial_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "editorial_assignments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "editorial_reviews" ADD CONSTRAINT "editorial_reviews_pending_article_id_pending_articles_id_fk" FOREIGN KEY ("pending_article_id") REFERENCES "pending_articles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "article_source_links" ADD CONSTRAINT "article_source_links_pending_article_id_pending_articles_id_fk" FOREIGN KEY ("pending_article_id") REFERENCES "pending_articles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
