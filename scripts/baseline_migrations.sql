-- Baseline migration tracking for elite_writer DB
-- PURPOSE: Record migrations 0005–0011 in __drizzle_migrations so drizzle-kit migrate
--          won't try to re-apply SQL that is already in the live schema.
--
-- PRECONDITION: Run only AFTER confirming these tables already exist in elite_writer:
--   publications, ai_usage_logs, article_sources, research_references,
--   template_sops, research_series, article_tag, research_share, research_items
--
-- DANGER: Do NOT run if these migrations were NOT applied yet — that would skip them
--         and leave the schema incomplete.
--
-- HOW TO RUN:
--   1. SSH to VPS
--   2. docker exec -it thepopebot-mysql mysql -u root -p elite_writer
--   3. Paste the INSERT below (after confirming tables exist via the CHECK query)
--
-- CHECK first:
-- SHOW TABLES IN elite_writer;
-- (Verify: publications, ai_usage_logs, article_sources, research_references,
--          template_sops, research_series, article_tag, research_share, research_items all present)

-- Then run:
INSERT IGNORE INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES
  ('0005_publication_intel',     1782895341000),
  ('0006_ai_usage',              1782895341000),
  ('0007_article_sources',       1782895341000),
  ('0008_research_references',   1782895341000),
  ('0009_template_sops',         1782895341000),
  ('0010_research_article_bridge', 1782906122000),
  ('0011_research_library_merge',  1782919648000);

-- Verify:
SELECT * FROM `__drizzle_migrations` ORDER BY created_at;
