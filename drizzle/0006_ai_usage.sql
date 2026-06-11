-- Server-side AI usage ledger: one aggregated row per (day, model).
-- Powers daily budget enforcement (AI_DAILY_BUDGET_USD) and spend dashboards.
CREATE TABLE IF NOT EXISTS `ai_usage` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `day` varchar(10) NOT NULL,
  `model` varchar(200) NOT NULL,
  `promptTokens` int NOT NULL DEFAULT 0,
  `completionTokens` int NOT NULL DEFAULT 0,
  `costMicros` bigint NOT NULL DEFAULT 0,
  `calls` int NOT NULL DEFAULT 0,
  UNIQUE KEY `day_model_idx` (`day`, `model`)
);
