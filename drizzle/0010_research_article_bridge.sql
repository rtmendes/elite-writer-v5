-- P3a: Research → Article bridge (ADDITIVE ONLY — CREATE TABLE / ADD COLUMN only)

-- 1. New columns on articles
ALTER TABLE `articles`
  ADD COLUMN `article_number` INT NULL,
  ADD COLUMN `series_id` INT NULL,
  ADD COLUMN `is_money_page` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `primary_offer_id` INT NULL;

-- 2. research_series — normalized series entity
CREATE TABLE IF NOT EXISTS `research_series` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `name` VARCHAR(300) NOT NULL,
  `description` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX `idx_rs_user` (`userId`)
);

-- 3. article_tag — per-article tags (normalized, filterable)
CREATE TABLE IF NOT EXISTS `article_tag` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `articleId` INT NOT NULL,
  `tag` VARCHAR(100) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX `idx_at_article` (`articleId`),
  INDEX `idx_at_tag` (`tag`)
);

-- 4. research_share — share link registry
CREATE TABLE IF NOT EXISTS `research_share` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `token` VARCHAR(64) NOT NULL UNIQUE,
  `ownerType` ENUM('folder','item','project') NOT NULL,
  `ownerId` INT NOT NULL,
  `userId` INT NOT NULL,
  `revoked` TINYINT(1) NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX `idx_rs_token` (`token`),
  INDEX `idx_rs_user` (`userId`)
);
