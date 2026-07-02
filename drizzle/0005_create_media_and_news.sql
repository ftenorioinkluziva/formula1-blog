CREATE TABLE IF NOT EXISTS "media_videos" (
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

CREATE INDEX IF NOT EXISTS "media_videos_sort_order_idx" ON "media_videos" ("sort_order");

CREATE TABLE IF NOT EXISTS "media_galleries" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "image_count" integer NOT NULL,
  "category" text NOT NULL,
  "cover_image_url" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "media_galleries_sort_order_idx" ON "media_galleries" ("sort_order");

CREATE TABLE IF NOT EXISTS "media_podcasts" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "episode" text NOT NULL,
  "duration" text NOT NULL,
  "guest" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "media_podcasts_sort_order_idx" ON "media_podcasts" ("sort_order");

CREATE TABLE IF NOT EXISTS "news_articles" (
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

CREATE INDEX IF NOT EXISTS "news_articles_featured_idx" ON "news_articles" ("is_featured");
CREATE INDEX IF NOT EXISTS "news_articles_sort_order_idx" ON "news_articles" ("sort_order");
