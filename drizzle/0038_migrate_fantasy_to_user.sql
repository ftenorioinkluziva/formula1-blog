ALTER TABLE "fantasy_profiles" ALTER COLUMN "session_key" DROP NOT NULL;
ALTER TABLE "fantasy_profiles" ADD COLUMN "user_id" text;
ALTER TABLE "fantasy_profiles" ADD CONSTRAINT "fantasy_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX IF NOT EXISTS "fantasy_profiles_user_id_unique_idx" ON "fantasy_profiles" ("user_id");
DROP INDEX IF EXISTS "fantasy_profiles_session_key_unique_idx";
