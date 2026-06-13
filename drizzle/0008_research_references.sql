-- Research References (Reference Library / citation manager).
-- Structured citations gathered by the agentic research hub or imported
-- (DOI / BibTeX / RIS). Distinct from kb_items: a reference is queryable
-- metadata (authors, year, DOI, citation count), not a freeform note.
CREATE TABLE IF NOT EXISTS `research_references` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `type` varchar(40) NOT NULL DEFAULT 'article',
  `title` varchar(700) NOT NULL,
  `authors` json,
  `year` int,
  `doi` varchar(200),
  `url` varchar(1000),
  `abstract` text,
  `source` varchar(120),
  `citationCount` int DEFAULT 0,
  `tags` json,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE (now())
);

-- Library is listed newest-first per user; filtered by type.
CREATE INDEX `idx_research_references_user_created` ON `research_references` (`userId`, `createdAt`);
CREATE INDEX `idx_research_references_user_type` ON `research_references` (`userId`, `type`);
