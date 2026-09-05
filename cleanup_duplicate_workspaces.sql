-- Merges duplicate workspaces created by the "Ana Çalışma Alanı" seeding bug.
-- For each (user_id, title) group among non-trashed workspaces, keeps the
-- OLDEST workspace, re-points every note from the newer duplicates onto it,
-- then permanently deletes the now-empty duplicate workspaces.
--
-- Run this once in the Supabase SQL editor. Safe to re-run (no-op if there
-- are no duplicates left).

BEGIN;

WITH ranked AS (
  SELECT
    id,
    user_id,
    title,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, title
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.workspaces
  WHERE is_trash = false
),
keepers AS (
  SELECT user_id, title, id AS keeper_id
  FROM ranked
  WHERE rn = 1
),
duplicates AS (
  SELECT r.id AS duplicate_id, k.keeper_id
  FROM ranked r
  JOIN keepers k ON k.user_id = r.user_id AND k.title = r.title
  WHERE r.rn > 1
)
-- Move notes off the duplicate workspaces onto the kept one.
UPDATE public.notes n
SET workspace_id = d.keeper_id
FROM duplicates d
WHERE n.workspace_id = d.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    user_id,
    title,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, title
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.workspaces
  WHERE is_trash = false
)
DELETE FROM public.workspaces
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

COMMIT;
