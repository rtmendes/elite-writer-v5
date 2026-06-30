-- Template SOPs: one per writing template, editable in-app.
-- The Drafter injects the chosen SOP into its system prompt so output
-- follows section order, word targets, evidence rules, visual slots, etc.
CREATE TABLE IF NOT EXISTS `template_sops` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
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
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `template_sops_templateId_unique` (`templateId`)
);
