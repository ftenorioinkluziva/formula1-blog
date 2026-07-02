WITH ranked_engineers AS (
	SELECT
		id,
		season,
		team_id,
		active_from_round,
		engineer_code,
		ROW_NUMBER() OVER (
			PARTITION BY season, team_id, active_from_round
			ORDER BY CASE WHEN engineer_code LIKE 'team-%' THEN 0 ELSE 1 END, updated_at DESC, id DESC
		) AS keep_rank
	FROM fantasy_engineers
),
canonical_engineers AS (
	SELECT
		season,
		team_id,
		active_from_round,
		id AS canonical_engineer_id
	FROM ranked_engineers
	WHERE keep_rank = 1
),
asset_candidates AS (
	SELECT
		group_engineers.season,
		group_engineers.team_id,
		group_engineers.active_from_round,
		assets.id AS asset_id,
		canonical_engineers.canonical_engineer_id,
		CASE WHEN assets.source_engineer_id = canonical_engineers.canonical_engineer_id THEN 0 ELSE 1 END AS asset_rank
	FROM canonical_engineers
	JOIN fantasy_engineers group_engineers
		ON group_engineers.season = canonical_engineers.season
	 AND group_engineers.team_id = canonical_engineers.team_id
	 AND group_engineers.active_from_round = canonical_engineers.active_from_round
	JOIN fantasy_assets assets
		ON assets.source_engineer_id = group_engineers.id
),
canonical_assets AS (
	SELECT DISTINCT ON (season, team_id, active_from_round)
		season,
		team_id,
		active_from_round,
		canonical_engineer_id,
		asset_id AS canonical_asset_id
	FROM asset_candidates
	ORDER BY season, team_id, active_from_round, asset_rank, asset_id
)
UPDATE fantasy_assets AS assets
SET
	source_engineer_id = canonical_assets.canonical_engineer_id,
	updated_at = now()
FROM canonical_assets
WHERE assets.id = canonical_assets.canonical_asset_id
	AND assets.source_engineer_id IS DISTINCT FROM canonical_assets.canonical_engineer_id;

WITH ranked_engineers AS (
	SELECT
		id,
		season,
		team_id,
		active_from_round,
		engineer_code,
		ROW_NUMBER() OVER (
			PARTITION BY season, team_id, active_from_round
			ORDER BY CASE WHEN engineer_code LIKE 'team-%' THEN 0 ELSE 1 END, updated_at DESC, id DESC
		) AS keep_rank
	FROM fantasy_engineers
),
canonical_engineers AS (
	SELECT
		season,
		team_id,
		active_from_round,
		id AS canonical_engineer_id
	FROM ranked_engineers
	WHERE keep_rank = 1
),
asset_candidates AS (
	SELECT
		group_engineers.season,
		group_engineers.team_id,
		group_engineers.active_from_round,
		assets.id AS asset_id,
		canonical_engineers.canonical_engineer_id,
		CASE WHEN assets.source_engineer_id = canonical_engineers.canonical_engineer_id THEN 0 ELSE 1 END AS asset_rank
	FROM canonical_engineers
	JOIN fantasy_engineers group_engineers
		ON group_engineers.season = canonical_engineers.season
	 AND group_engineers.team_id = canonical_engineers.team_id
	 AND group_engineers.active_from_round = canonical_engineers.active_from_round
	JOIN fantasy_assets assets
		ON assets.source_engineer_id = group_engineers.id
),
canonical_assets AS (
	SELECT DISTINCT ON (season, team_id, active_from_round)
		season,
		team_id,
		active_from_round,
		canonical_engineer_id,
		asset_id AS canonical_asset_id
	FROM asset_candidates
	ORDER BY season, team_id, active_from_round, asset_rank, asset_id
),
asset_remap AS (
	SELECT
		assets.id AS legacy_asset_id,
		canonical_assets.canonical_asset_id
	FROM canonical_assets
	JOIN fantasy_engineers group_engineers
		ON group_engineers.season = canonical_assets.season
	 AND group_engineers.team_id = canonical_assets.team_id
	 AND group_engineers.active_from_round = canonical_assets.active_from_round
	JOIN fantasy_assets assets
		ON assets.source_engineer_id = group_engineers.id
	WHERE assets.id <> canonical_assets.canonical_asset_id
)
INSERT INTO fantasy_asset_prices (asset_id, season, round, price, price_delta, performance_index, locked_at)
SELECT
	asset_remap.canonical_asset_id,
	prices.season,
	prices.round,
	prices.price,
	prices.price_delta,
	prices.performance_index,
	prices.locked_at
FROM fantasy_asset_prices AS prices
JOIN asset_remap
	ON asset_remap.legacy_asset_id = prices.asset_id
ON CONFLICT (asset_id, season, round) DO NOTHING;

WITH ranked_engineers AS (
	SELECT
		id,
		season,
		team_id,
		active_from_round,
		engineer_code,
		ROW_NUMBER() OVER (
			PARTITION BY season, team_id, active_from_round
			ORDER BY CASE WHEN engineer_code LIKE 'team-%' THEN 0 ELSE 1 END, updated_at DESC, id DESC
		) AS keep_rank
	FROM fantasy_engineers
),
canonical_engineers AS (
	SELECT
		season,
		team_id,
		active_from_round,
		id AS canonical_engineer_id
	FROM ranked_engineers
	WHERE keep_rank = 1
),
asset_candidates AS (
	SELECT
		group_engineers.season,
		group_engineers.team_id,
		group_engineers.active_from_round,
		assets.id AS asset_id,
		canonical_engineers.canonical_engineer_id,
		CASE WHEN assets.source_engineer_id = canonical_engineers.canonical_engineer_id THEN 0 ELSE 1 END AS asset_rank
	FROM canonical_engineers
	JOIN fantasy_engineers group_engineers
		ON group_engineers.season = canonical_engineers.season
	 AND group_engineers.team_id = canonical_engineers.team_id
	 AND group_engineers.active_from_round = canonical_engineers.active_from_round
	JOIN fantasy_assets assets
		ON assets.source_engineer_id = group_engineers.id
),
canonical_assets AS (
	SELECT DISTINCT ON (season, team_id, active_from_round)
		season,
		team_id,
		active_from_round,
		canonical_engineer_id,
		asset_id AS canonical_asset_id
	FROM asset_candidates
	ORDER BY season, team_id, active_from_round, asset_rank, asset_id
),
asset_remap AS (
	SELECT
		assets.id AS legacy_asset_id,
		canonical_assets.canonical_asset_id
	FROM canonical_assets
	JOIN fantasy_engineers group_engineers
		ON group_engineers.season = canonical_assets.season
	 AND group_engineers.team_id = canonical_assets.team_id
	 AND group_engineers.active_from_round = canonical_assets.active_from_round
	JOIN fantasy_assets assets
		ON assets.source_engineer_id = group_engineers.id
	WHERE assets.id <> canonical_assets.canonical_asset_id
)
UPDATE fantasy_round_holdings AS holdings
SET asset_id = asset_remap.canonical_asset_id
FROM asset_remap
WHERE holdings.asset_id = asset_remap.legacy_asset_id;

WITH ranked_engineers AS (
	SELECT
		id,
		season,
		team_id,
		active_from_round,
		engineer_code,
		ROW_NUMBER() OVER (
			PARTITION BY season, team_id, active_from_round
			ORDER BY CASE WHEN engineer_code LIKE 'team-%' THEN 0 ELSE 1 END, updated_at DESC, id DESC
		) AS keep_rank
	FROM fantasy_engineers
),
canonical_engineers AS (
	SELECT
		season,
		team_id,
		active_from_round,
		id AS canonical_engineer_id
	FROM ranked_engineers
	WHERE keep_rank = 1
),
asset_candidates AS (
	SELECT
		group_engineers.season,
		group_engineers.team_id,
		group_engineers.active_from_round,
		assets.id AS asset_id,
		canonical_engineers.canonical_engineer_id,
		CASE WHEN assets.source_engineer_id = canonical_engineers.canonical_engineer_id THEN 0 ELSE 1 END AS asset_rank
	FROM canonical_engineers
	JOIN fantasy_engineers group_engineers
		ON group_engineers.season = canonical_engineers.season
	 AND group_engineers.team_id = canonical_engineers.team_id
	 AND group_engineers.active_from_round = canonical_engineers.active_from_round
	JOIN fantasy_assets assets
		ON assets.source_engineer_id = group_engineers.id
),
canonical_assets AS (
	SELECT DISTINCT ON (season, team_id, active_from_round)
		season,
		team_id,
		active_from_round,
		canonical_engineer_id,
		asset_id AS canonical_asset_id
	FROM asset_candidates
	ORDER BY season, team_id, active_from_round, asset_rank, asset_id
),
asset_remap AS (
	SELECT
		assets.id AS legacy_asset_id,
		canonical_assets.canonical_asset_id
	FROM canonical_assets
	JOIN fantasy_engineers group_engineers
		ON group_engineers.season = canonical_assets.season
	 AND group_engineers.team_id = canonical_assets.team_id
	 AND group_engineers.active_from_round = canonical_assets.active_from_round
	JOIN fantasy_assets assets
		ON assets.source_engineer_id = group_engineers.id
	WHERE assets.id <> canonical_assets.canonical_asset_id
)
UPDATE fantasy_transfers AS transfers
SET incoming_asset_id = asset_remap.canonical_asset_id
FROM asset_remap
WHERE transfers.incoming_asset_id = asset_remap.legacy_asset_id;

WITH ranked_engineers AS (
	SELECT
		id,
		season,
		team_id,
		active_from_round,
		engineer_code,
		ROW_NUMBER() OVER (
			PARTITION BY season, team_id, active_from_round
			ORDER BY CASE WHEN engineer_code LIKE 'team-%' THEN 0 ELSE 1 END, updated_at DESC, id DESC
		) AS keep_rank
	FROM fantasy_engineers
),
canonical_engineers AS (
	SELECT
		season,
		team_id,
		active_from_round,
		id AS canonical_engineer_id
	FROM ranked_engineers
	WHERE keep_rank = 1
),
asset_candidates AS (
	SELECT
		group_engineers.season,
		group_engineers.team_id,
		group_engineers.active_from_round,
		assets.id AS asset_id,
		canonical_engineers.canonical_engineer_id,
		CASE WHEN assets.source_engineer_id = canonical_engineers.canonical_engineer_id THEN 0 ELSE 1 END AS asset_rank
	FROM canonical_engineers
	JOIN fantasy_engineers group_engineers
		ON group_engineers.season = canonical_engineers.season
	 AND group_engineers.team_id = canonical_engineers.team_id
	 AND group_engineers.active_from_round = canonical_engineers.active_from_round
	JOIN fantasy_assets assets
		ON assets.source_engineer_id = group_engineers.id
),
canonical_assets AS (
	SELECT DISTINCT ON (season, team_id, active_from_round)
		season,
		team_id,
		active_from_round,
		canonical_engineer_id,
		asset_id AS canonical_asset_id
	FROM asset_candidates
	ORDER BY season, team_id, active_from_round, asset_rank, asset_id
),
asset_remap AS (
	SELECT
		assets.id AS legacy_asset_id,
		canonical_assets.canonical_asset_id
	FROM canonical_assets
	JOIN fantasy_engineers group_engineers
		ON group_engineers.season = canonical_assets.season
	 AND group_engineers.team_id = canonical_assets.team_id
	 AND group_engineers.active_from_round = canonical_assets.active_from_round
	JOIN fantasy_assets assets
		ON assets.source_engineer_id = group_engineers.id
	WHERE assets.id <> canonical_assets.canonical_asset_id
)
UPDATE fantasy_transfers AS transfers
SET outgoing_asset_id = asset_remap.canonical_asset_id
FROM asset_remap
WHERE transfers.outgoing_asset_id = asset_remap.legacy_asset_id;

WITH ranked_engineers AS (
	SELECT
		id,
		season,
		team_id,
		active_from_round,
		engineer_code,
		ROW_NUMBER() OVER (
			PARTITION BY season, team_id, active_from_round
			ORDER BY CASE WHEN engineer_code LIKE 'team-%' THEN 0 ELSE 1 END, updated_at DESC, id DESC
		) AS keep_rank
	FROM fantasy_engineers
),
canonical_engineers AS (
	SELECT
		season,
		team_id,
		active_from_round,
		id AS canonical_engineer_id
	FROM ranked_engineers
	WHERE keep_rank = 1
),
asset_candidates AS (
	SELECT
		group_engineers.season,
		group_engineers.team_id,
		group_engineers.active_from_round,
		assets.id AS asset_id,
		canonical_engineers.canonical_engineer_id,
		CASE WHEN assets.source_engineer_id = canonical_engineers.canonical_engineer_id THEN 0 ELSE 1 END AS asset_rank
	FROM canonical_engineers
	JOIN fantasy_engineers group_engineers
		ON group_engineers.season = canonical_engineers.season
	 AND group_engineers.team_id = canonical_engineers.team_id
	 AND group_engineers.active_from_round = canonical_engineers.active_from_round
	JOIN fantasy_assets assets
		ON assets.source_engineer_id = group_engineers.id
),
canonical_assets AS (
	SELECT DISTINCT ON (season, team_id, active_from_round)
		season,
		team_id,
		active_from_round,
		canonical_engineer_id,
		asset_id AS canonical_asset_id
	FROM asset_candidates
	ORDER BY season, team_id, active_from_round, asset_rank, asset_id
),
asset_remap AS (
	SELECT
		assets.id AS legacy_asset_id,
		canonical_assets.canonical_asset_id
	FROM canonical_assets
	JOIN fantasy_engineers group_engineers
		ON group_engineers.season = canonical_assets.season
	 AND group_engineers.team_id = canonical_assets.team_id
	 AND group_engineers.active_from_round = canonical_assets.active_from_round
	JOIN fantasy_assets assets
		ON assets.source_engineer_id = group_engineers.id
	WHERE assets.id <> canonical_assets.canonical_asset_id
)
UPDATE fantasy_score_items AS items
SET asset_id = asset_remap.canonical_asset_id
FROM asset_remap
WHERE items.asset_id = asset_remap.legacy_asset_id;

WITH ranked_engineers AS (
	SELECT
		id,
		season,
		team_id,
		active_from_round,
		engineer_code,
		ROW_NUMBER() OVER (
			PARTITION BY season, team_id, active_from_round
			ORDER BY CASE WHEN engineer_code LIKE 'team-%' THEN 0 ELSE 1 END, updated_at DESC, id DESC
		) AS keep_rank
	FROM fantasy_engineers
),
canonical_engineers AS (
	SELECT
		season,
		team_id,
		active_from_round,
		id AS canonical_engineer_id
	FROM ranked_engineers
	WHERE keep_rank = 1
),
asset_candidates AS (
	SELECT
		group_engineers.season,
		group_engineers.team_id,
		group_engineers.active_from_round,
		assets.id AS asset_id,
		canonical_engineers.canonical_engineer_id,
		CASE WHEN assets.source_engineer_id = canonical_engineers.canonical_engineer_id THEN 0 ELSE 1 END AS asset_rank
	FROM canonical_engineers
	JOIN fantasy_engineers group_engineers
		ON group_engineers.season = canonical_engineers.season
	 AND group_engineers.team_id = canonical_engineers.team_id
	 AND group_engineers.active_from_round = canonical_engineers.active_from_round
	JOIN fantasy_assets assets
		ON assets.source_engineer_id = group_engineers.id
),
canonical_assets AS (
	SELECT DISTINCT ON (season, team_id, active_from_round)
		season,
		team_id,
		active_from_round,
		canonical_engineer_id,
		asset_id AS canonical_asset_id
	FROM asset_candidates
	ORDER BY season, team_id, active_from_round, asset_rank, asset_id
),
asset_remap AS (
	SELECT
		assets.id AS legacy_asset_id,
		canonical_assets.canonical_asset_id
	FROM canonical_assets
	JOIN fantasy_engineers group_engineers
		ON group_engineers.season = canonical_assets.season
	 AND group_engineers.team_id = canonical_assets.team_id
	 AND group_engineers.active_from_round = canonical_assets.active_from_round
	JOIN fantasy_assets assets
		ON assets.source_engineer_id = group_engineers.id
	WHERE assets.id <> canonical_assets.canonical_asset_id
)
DELETE FROM fantasy_asset_prices AS prices
USING asset_remap
WHERE prices.asset_id = asset_remap.legacy_asset_id;

WITH ranked_engineers AS (
	SELECT
		id,
		season,
		team_id,
		active_from_round,
		engineer_code,
		ROW_NUMBER() OVER (
			PARTITION BY season, team_id, active_from_round
			ORDER BY CASE WHEN engineer_code LIKE 'team-%' THEN 0 ELSE 1 END, updated_at DESC, id DESC
		) AS keep_rank
	FROM fantasy_engineers
),
canonical_engineers AS (
	SELECT
		season,
		team_id,
		active_from_round,
		id AS canonical_engineer_id
	FROM ranked_engineers
	WHERE keep_rank = 1
),
asset_candidates AS (
	SELECT
		group_engineers.season,
		group_engineers.team_id,
		group_engineers.active_from_round,
		assets.id AS asset_id,
		canonical_engineers.canonical_engineer_id,
		CASE WHEN assets.source_engineer_id = canonical_engineers.canonical_engineer_id THEN 0 ELSE 1 END AS asset_rank
	FROM canonical_engineers
	JOIN fantasy_engineers group_engineers
		ON group_engineers.season = canonical_engineers.season
	 AND group_engineers.team_id = canonical_engineers.team_id
	 AND group_engineers.active_from_round = canonical_engineers.active_from_round
	JOIN fantasy_assets assets
		ON assets.source_engineer_id = group_engineers.id
),
canonical_assets AS (
	SELECT DISTINCT ON (season, team_id, active_from_round)
		season,
		team_id,
		active_from_round,
		canonical_engineer_id,
		asset_id AS canonical_asset_id
	FROM asset_candidates
	ORDER BY season, team_id, active_from_round, asset_rank, asset_id
),
asset_remap AS (
	SELECT
		assets.id AS legacy_asset_id,
		canonical_assets.canonical_asset_id
	FROM canonical_assets
	JOIN fantasy_engineers group_engineers
		ON group_engineers.season = canonical_assets.season
	 AND group_engineers.team_id = canonical_assets.team_id
	 AND group_engineers.active_from_round = canonical_assets.active_from_round
	JOIN fantasy_assets assets
		ON assets.source_engineer_id = group_engineers.id
	WHERE assets.id <> canonical_assets.canonical_asset_id
)
DELETE FROM fantasy_assets AS assets
USING asset_remap
WHERE assets.id = asset_remap.legacy_asset_id;

WITH ranked_engineers AS (
	SELECT
		id,
		season,
		team_id,
		active_from_round,
		engineer_code,
		ROW_NUMBER() OVER (
			PARTITION BY season, team_id, active_from_round
			ORDER BY CASE WHEN engineer_code LIKE 'team-%' THEN 0 ELSE 1 END, updated_at DESC, id DESC
		) AS keep_rank
	FROM fantasy_engineers
)
DELETE FROM fantasy_engineers AS engineers
USING ranked_engineers
WHERE engineers.id = ranked_engineers.id
	AND ranked_engineers.keep_rank > 1;

DROP INDEX IF EXISTS "fantasy_engineers_season_driver_round_unique_idx";

ALTER TABLE "fantasy_engineers"
DROP COLUMN IF EXISTS "driver_id";

CREATE UNIQUE INDEX IF NOT EXISTS "fantasy_engineers_season_team_round_unique_idx"
ON "fantasy_engineers" ("season", "team_id", "active_from_round");
