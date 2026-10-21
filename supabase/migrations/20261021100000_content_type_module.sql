-- Purpose: add module to content_type for module overview revisions.
-- Prompt: 06 (lessons). Must run in its own migration (Postgres enum rule).

alter type public.content_type add value if not exists 'module';
