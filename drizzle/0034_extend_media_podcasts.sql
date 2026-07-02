ALTER TABLE media_podcasts
  ADD COLUMN description text,
  ADD COLUMN audio_url text,
  ADD COLUMN race_weekend_id integer REFERENCES race_weekends(id),
  ADD COLUMN published_at timestamptz,
  ADD COLUMN script_text text,
  ADD COLUMN language text NOT NULL DEFAULT 'pt';
