-- Source registry: per-article research provenance (sources never get stripped).
ALTER TABLE `articles` ADD COLUMN `sources` json;
