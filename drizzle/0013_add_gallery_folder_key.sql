ALTER TABLE "media_galleries" ADD COLUMN "folder_key" text;
CREATE UNIQUE INDEX "media_galleries_folder_key_unique_idx" ON "media_galleries" ("folder_key") WHERE "folder_key" IS NOT NULL;
