-- P3a-fixes: Backfill research_references → research_items (ADDITIVE ONLY, IDEMPOTENT)
-- research_references is NOT dropped — legacy data preserved.
-- Idempotency: skip any reference that already has a matching research_items row
--   for the same userId, matched on COALESCE(doi, url, title) in priority order.

INSERT INTO `research_items` (
  `userId`, `contentType`, `title`, `url`, `authors`, `year`, `doi`,
  `abstract`, `tags`, `source`, `citationCount`, `notes`,
  `createdAt`, `updatedAt`
)
SELECT
  r.`userId`,
  CASE r.`type`
    WHEN 'article' THEN 'academic'
    WHEN 'video'   THEN 'video'
    WHEN 'book'    THEN 'manual'
    WHEN 'report'  THEN 'manual'
    ELSE 'webpage'
  END,
  r.`title`,
  r.`url`,
  r.`authors`,
  r.`year`,
  r.`doi`,
  r.`abstract`,
  r.`tags`,
  COALESCE(r.`source`, 'manual'),
  COALESCE(r.`citationCount`, 0),
  r.`notes`,
  r.`createdAt`,
  r.`createdAt`
FROM `research_references` r
WHERE NOT EXISTS (
  SELECT 1
  FROM `research_items` i
  WHERE i.`userId` = r.`userId`
    AND (
      -- Match by DOI (most precise) when both have one
      (r.`doi`  IS NOT NULL AND r.`doi`  != '' AND i.`doi`  = r.`doi`)
      OR
      -- Match by URL when both have one and no DOI
      (r.`doi` IS NULL AND r.`url` IS NOT NULL AND r.`url` != '' AND i.`url` = r.`url` AND (i.`doi` IS NULL OR i.`doi` = ''))
      OR
      -- Match by title as last resort (same user, same title, no url/doi on either)
      (r.`doi` IS NULL AND r.`url` IS NULL AND i.`title` = r.`title` AND (i.`url` IS NULL OR i.`url` = '') AND (i.`doi` IS NULL OR i.`doi` = ''))
    )
);
