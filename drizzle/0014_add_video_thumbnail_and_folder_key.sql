ALTER TABLE "media_videos" ADD COLUMN "thumbnail_url" text;
ALTER TABLE "media_videos" ADD COLUMN "folder_key" text;
CREATE UNIQUE INDEX "media_videos_folder_key_unique_idx" ON "media_videos" ("folder_key") WHERE "folder_key" IS NOT NULL;
