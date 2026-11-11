-- Removes App Studio. Destroys every studio project, version and message.
DROP FUNCTION IF EXISTS omnix_published_app(text);
DROP TABLE IF EXISTS ai_app_messages, ai_app_versions, ai_app_projects;
