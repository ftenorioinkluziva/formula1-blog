CREATE TABLE "pending_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"template" text NOT NULL,
	"source" text NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"category" text NOT NULL,
	"read_time" text NOT NULL,
	"date" text NOT NULL,
	"author" text NOT NULL,
	"image" text,
	"body" text[] NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pending_articles_status_idx" ON "pending_articles" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_articles_filename_unique_idx" ON "pending_articles" USING btree ("filename");