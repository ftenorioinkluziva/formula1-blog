CREATE TABLE "gallery_images" (
  "id" serial PRIMARY KEY NOT NULL,
  "gallery_id" integer NOT NULL REFERENCES "media_galleries"("id") ON DELETE cascade,
  "image_url" text NOT NULL,
  "caption" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "gallery_images_gallery_id_idx" ON "gallery_images" ("gallery_id");
CREATE INDEX "gallery_images_sort_order_idx" ON "gallery_images" ("sort_order");
