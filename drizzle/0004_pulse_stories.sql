-- Pulse Stories table: Article Pulse → Elite Writer Pipeline
CREATE TABLE IF NOT EXISTS `pulse_stories` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int,
  `externalId` int,
  `headline` varchar(500) NOT NULL,
  `source` varchar(1000),
  `sourceDisplay` varchar(200),
  `beat` varchar(100) NOT NULL,
  `urgency` enum('breaking','this_week','evergreen') NOT NULL DEFAULT 'this_week',
  `urgencyEmoji` varchar(10),
  `whyItMatters` text,
  `angle` text,
  `contentType` varchar(200),
  `priority` int,
  `pulseStatus` enum('new','reviewing','writing','in_pipeline','published','skipped') NOT NULL DEFAULT 'new',
  `matchedBrands` json,
  `matchedPublications` json,
  `analysisData` json,
  `briefingDate` varchar(10) NOT NULL,
  `briefingRank` int,
  `briefingReason` text,
  `articleId` int,
  `ideaId` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);

-- Indexes for fast querying
CREATE INDEX `idx_pulse_briefing_date` ON `pulse_stories` (`briefingDate`);
CREATE INDEX `idx_pulse_status` ON `pulse_stories` (`pulseStatus`);
CREATE INDEX `idx_pulse_beat` ON `pulse_stories` (`beat`);
CREATE INDEX `idx_pulse_urgency` ON `pulse_stories` (`urgency`);
CREATE INDEX `idx_pulse_rank` ON `pulse_stories` (`briefingRank`);
