CREATE TABLE IF NOT EXISTS "fantasy_seasons" (
  "id" serial PRIMARY KEY NOT NULL,
  "season" integer NOT NULL,
  "name" text NOT NULL,
  "budget_cap" real DEFAULT 100 NOT NULL,
  "is_active" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fantasy_seasons_season_unique" UNIQUE("season")
);

CREATE INDEX "fantasy_seasons_active_idx" ON "fantasy_seasons" ("is_active");

CREATE TABLE IF NOT EXISTS "fantasy_rulesets" (
  "id" serial PRIMARY KEY NOT NULL,
  "season_id" integer NOT NULL REFERENCES "fantasy_seasons"("id") ON DELETE CASCADE,
  "lock_phase" text DEFAULT 'qualifying_start' NOT NULL,
  "free_driver_transfers" integer DEFAULT 2 NOT NULL,
  "free_engineer_transfers" integer DEFAULT 1 NOT NULL,
  "extra_driver_transfer_penalty" integer DEFAULT 10 NOT NULL,
  "extra_engineer_transfer_penalty" integer DEFAULT 10 NOT NULL,
  "team_min_hold_rounds" integer DEFAULT 3 NOT NULL,
  "predictions_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "fantasy_rulesets_season_unique_idx" ON "fantasy_rulesets" ("season_id");

CREATE TABLE IF NOT EXISTS "fantasy_profiles" (
  "id" serial PRIMARY KEY NOT NULL,
  "display_name" text NOT NULL,
  "session_key" text NOT NULL,
  "favorite_team_id" integer REFERENCES "teams"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "fantasy_profiles_session_key_unique_idx" ON "fantasy_profiles" ("session_key");
CREATE INDEX "fantasy_profiles_favorite_team_idx" ON "fantasy_profiles" ("favorite_team_id");

CREATE TABLE IF NOT EXISTS "fantasy_engineers" (
  "id" serial PRIMARY KEY NOT NULL,
  "season" integer NOT NULL,
  "engineer_code" text NOT NULL,
  "display_name" text NOT NULL,
  "short_name" text NOT NULL,
  "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE RESTRICT,
  "driver_id" integer NOT NULL REFERENCES "drivers"("id") ON DELETE CASCADE,
  "active_from_round" integer NOT NULL,
  "active_to_round" integer,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "fantasy_engineers_code_season_unique_idx" ON "fantasy_engineers" ("season", "engineer_code");
CREATE UNIQUE INDEX "fantasy_engineers_season_driver_round_unique_idx" ON "fantasy_engineers" ("season", "driver_id", "active_from_round");
CREATE INDEX "fantasy_engineers_season_team_idx" ON "fantasy_engineers" ("season", "team_id");

CREATE TABLE IF NOT EXISTS "fantasy_assets" (
  "id" serial PRIMARY KEY NOT NULL,
  "season" integer NOT NULL,
  "asset_type" text NOT NULL,
  "display_name" text NOT NULL,
  "slug" text NOT NULL,
  "source_driver_id" integer REFERENCES "drivers"("id") ON DELETE CASCADE,
  "source_team_id" integer REFERENCES "teams"("id") ON DELETE CASCADE,
  "source_engineer_id" integer REFERENCES "fantasy_engineers"("id") ON DELETE CASCADE,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "fantasy_assets_season_slug_unique_idx" ON "fantasy_assets" ("season", "slug");
CREATE INDEX "fantasy_assets_season_type_idx" ON "fantasy_assets" ("season", "asset_type");
CREATE UNIQUE INDEX "fantasy_assets_season_driver_unique_idx" ON "fantasy_assets" ("season", "source_driver_id");
CREATE UNIQUE INDEX "fantasy_assets_season_team_unique_idx" ON "fantasy_assets" ("season", "source_team_id");
CREATE UNIQUE INDEX "fantasy_assets_season_engineer_unique_idx" ON "fantasy_assets" ("season", "source_engineer_id");

CREATE TABLE IF NOT EXISTS "fantasy_asset_prices" (
  "id" serial PRIMARY KEY NOT NULL,
  "asset_id" integer NOT NULL REFERENCES "fantasy_assets"("id") ON DELETE CASCADE,
  "season" integer NOT NULL,
  "round" integer NOT NULL,
  "price" real NOT NULL,
  "price_delta" real DEFAULT 0 NOT NULL,
  "performance_index" real DEFAULT 0 NOT NULL,
  "locked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "fantasy_asset_prices_asset_season_round_unique_idx" ON "fantasy_asset_prices" ("asset_id", "season", "round");
CREATE INDEX "fantasy_asset_prices_season_round_idx" ON "fantasy_asset_prices" ("season", "round");

CREATE TABLE IF NOT EXISTS "fantasy_round_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "profile_id" integer NOT NULL REFERENCES "fantasy_profiles"("id") ON DELETE CASCADE,
  "season_id" integer NOT NULL REFERENCES "fantasy_seasons"("id") ON DELETE CASCADE,
  "weekend_id" integer NOT NULL REFERENCES "race_weekends"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'draft' NOT NULL,
  "budget_total" real NOT NULL,
  "budget_spent" real DEFAULT 0 NOT NULL,
  "free_driver_transfers_left" integer DEFAULT 2 NOT NULL,
  "free_engineer_transfers_left" integer DEFAULT 1 NOT NULL,
  "team_locked_until_round" integer,
  "submitted_at" timestamp with time zone,
  "locked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "fantasy_round_entries_profile_season_weekend_unique_idx" ON "fantasy_round_entries" ("profile_id", "season_id", "weekend_id");
CREATE INDEX "fantasy_round_entries_season_weekend_status_idx" ON "fantasy_round_entries" ("season_id", "weekend_id", "status");

CREATE TABLE IF NOT EXISTS "fantasy_round_holdings" (
  "id" serial PRIMARY KEY NOT NULL,
  "entry_id" integer NOT NULL REFERENCES "fantasy_round_entries"("id") ON DELETE CASCADE,
  "slot_type" text NOT NULL,
  "asset_id" integer NOT NULL REFERENCES "fantasy_assets"("id") ON DELETE RESTRICT,
  "locked_price" real NOT NULL,
  "acquired_round" integer NOT NULL,
  "is_locked" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "fantasy_round_holdings_entry_slot_unique_idx" ON "fantasy_round_holdings" ("entry_id", "slot_type");
CREATE UNIQUE INDEX "fantasy_round_holdings_entry_asset_unique_idx" ON "fantasy_round_holdings" ("entry_id", "asset_id");
CREATE INDEX "fantasy_round_holdings_entry_idx" ON "fantasy_round_holdings" ("entry_id");

CREATE TABLE IF NOT EXISTS "fantasy_transfers" (
  "id" serial PRIMARY KEY NOT NULL,
  "entry_id" integer NOT NULL REFERENCES "fantasy_round_entries"("id") ON DELETE CASCADE,
  "season_id" integer NOT NULL REFERENCES "fantasy_seasons"("id") ON DELETE CASCADE,
  "weekend_id" integer NOT NULL REFERENCES "race_weekends"("id") ON DELETE CASCADE,
  "transfer_kind" text NOT NULL,
  "slot_type" text NOT NULL,
  "outgoing_asset_id" integer REFERENCES "fantasy_assets"("id") ON DELETE SET NULL,
  "incoming_asset_id" integer NOT NULL REFERENCES "fantasy_assets"("id") ON DELETE RESTRICT,
  "penalty_points" integer DEFAULT 0 NOT NULL,
  "used_free_transfer" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "fantasy_transfers_entry_created_idx" ON "fantasy_transfers" ("entry_id", "created_at");
CREATE INDEX "fantasy_transfers_season_weekend_idx" ON "fantasy_transfers" ("season_id", "weekend_id");

CREATE TABLE IF NOT EXISTS "fantasy_predictions" (
  "id" serial PRIMARY KEY NOT NULL,
  "entry_id" integer NOT NULL REFERENCES "fantasy_round_entries"("id") ON DELETE CASCADE,
  "season_id" integer NOT NULL REFERENCES "fantasy_seasons"("id") ON DELETE CASCADE,
  "weekend_id" integer NOT NULL REFERENCES "race_weekends"("id") ON DELETE CASCADE,
  "pole_driver_id" integer REFERENCES "drivers"("id") ON DELETE SET NULL,
  "race_winner_driver_id" integer REFERENCES "drivers"("id") ON DELETE SET NULL,
  "podium_p1_driver_id" integer REFERENCES "drivers"("id") ON DELETE SET NULL,
  "podium_p2_driver_id" integer REFERENCES "drivers"("id") ON DELETE SET NULL,
  "podium_p3_driver_id" integer REFERENCES "drivers"("id") ON DELETE SET NULL,
  "fastest_lap_driver_id" integer REFERENCES "drivers"("id") ON DELETE SET NULL,
  "fastest_pit_team_id" integer REFERENCES "teams"("id") ON DELETE SET NULL,
  "safety_car_band" text,
  "has_red_flag" boolean,
  "locked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "fantasy_predictions_entry_unique_idx" ON "fantasy_predictions" ("entry_id");
CREATE INDEX "fantasy_predictions_season_weekend_idx" ON "fantasy_predictions" ("season_id", "weekend_id");

CREATE TABLE IF NOT EXISTS "fantasy_round_scores" (
  "id" serial PRIMARY KEY NOT NULL,
  "entry_id" integer NOT NULL REFERENCES "fantasy_round_entries"("id") ON DELETE CASCADE,
  "season_id" integer NOT NULL REFERENCES "fantasy_seasons"("id") ON DELETE CASCADE,
  "weekend_id" integer NOT NULL REFERENCES "race_weekends"("id") ON DELETE CASCADE,
  "drivers_score" integer DEFAULT 0 NOT NULL,
  "team_score" integer DEFAULT 0 NOT NULL,
  "engineer_score" integer DEFAULT 0 NOT NULL,
  "predictions_score" integer DEFAULT 0 NOT NULL,
  "total_score" integer DEFAULT 0 NOT NULL,
  "is_official" boolean DEFAULT false NOT NULL,
  "calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "fantasy_round_scores_entry_unique_idx" ON "fantasy_round_scores" ("entry_id");
CREATE INDEX "fantasy_round_scores_season_weekend_official_idx" ON "fantasy_round_scores" ("season_id", "weekend_id", "is_official");

CREATE TABLE IF NOT EXISTS "fantasy_score_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "round_score_id" integer NOT NULL REFERENCES "fantasy_round_scores"("id") ON DELETE CASCADE,
  "asset_id" integer REFERENCES "fantasy_assets"("id") ON DELETE SET NULL,
  "score_block" text NOT NULL,
  "score_type" text NOT NULL,
  "points" integer NOT NULL,
  "source_table" text NOT NULL,
  "source_record_id" integer,
  "meta_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "fantasy_score_items_round_score_idx" ON "fantasy_score_items" ("round_score_id");
CREATE INDEX "fantasy_score_items_asset_idx" ON "fantasy_score_items" ("asset_id");
CREATE INDEX "fantasy_score_items_block_type_idx" ON "fantasy_score_items" ("score_block", "score_type");