-- Publication intelligence: reader avatar + editor preferences
-- Feed the 13-dimension scorecard (reader_resonance, editor_alignment)
-- and AI drafting context with WHO reads the publication and WHAT its
-- gatekeeping editor accepts/rejects.
ALTER TABLE `publications`
  ADD COLUMN `audienceAvatar` text,
  ADD COLUMN `editorPreferences` text;
