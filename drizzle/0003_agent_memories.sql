-- Agent Memories table for persistent per-agent knowledge
CREATE TABLE IF NOT EXISTS `agent_memories` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `agentId` varchar(50) NOT NULL,
  `fact` text NOT NULL,
  `category` varchar(100),
  `importance` int DEFAULT 5,
  `sourceChatId` int,
  `expiresAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now())
);

-- Index for fast memory retrieval per user+agent
CREATE INDEX `idx_agent_memories_user_agent` ON `agent_memories` (`userId`, `agentId`);
CREATE INDEX `idx_agent_memories_importance` ON `agent_memories` (`importance`);
