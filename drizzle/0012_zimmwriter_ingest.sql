-- ZimmWriter ingest: external article provenance + pipeline scoring flags
ALTER TABLE articles ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS body_markdown text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS body_html text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS excerpt text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS category varchar(200);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS tags jsonb;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS featured_image_url text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS featured_image_b64 text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS needs_scoring boolean NOT NULL DEFAULT false;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS compliance_flag boolean NOT NULL DEFAULT false;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS neuron_score integer;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS neuron_share_url text;

CREATE UNIQUE INDEX IF NOT EXISTS articles_source_source_id_uidx ON articles (source, source_id);
