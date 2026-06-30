CREATE TABLE `article_research` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`articleId` int NOT NULL,
	`itemId` int NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `article_research_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(300) NOT NULL,
	`parentId` int,
	`color` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `research_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_highlights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`itemId` int NOT NULL,
	`text` text NOT NULL,
	`note` text,
	`color` varchar(20) DEFAULT 'yellow',
	`position` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `research_highlights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`folderId` int,
	`projectId` int,
	`contentType` varchar(40) NOT NULL DEFAULT 'webpage',
	`title` varchar(700) NOT NULL,
	`url` varchar(2000),
	`r2Key` varchar(500),
	`authors` json,
	`year` int,
	`doi` varchar(200),
	`publication` varchar(300),
	`abstract` text,
	`tags` json,
	`refKey` varchar(100),
	`source` varchar(120),
	`citationCount` int DEFAULT 0,
	`riStatus` enum('inbox','saved','archived') NOT NULL DEFAULT 'inbox',
	`notes` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `research_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(300) NOT NULL,
	`description` text,
	`rpStatus` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `research_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `template_sops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` varchar(80) NOT NULL,
	`name` varchar(200) NOT NULL,
	`purpose` text,
	`sections` json,
	`tone` text,
	`hookPattern` text,
	`evidenceRules` text,
	`visualSlots` json,
	`ctaClose` text,
	`seoPattern` text,
	`publicationFit` text,
	`isSeeded` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `template_sops_id` PRIMARY KEY(`id`),
	CONSTRAINT `template_sops_templateId_unique` UNIQUE(`templateId`)
);
