-- P3a-fixes: Backfill research_references → research_items (ADDITIVE ONLY)
-- research_references table is NOT dropped — legacy data preserved.
-- After this migration, "Save source" writes to research_items only.

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
FROM `research_references` r;
