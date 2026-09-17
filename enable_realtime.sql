-- Enable Supabase Realtime for notes and workspaces so changes made on one
-- device (desktop / phone) appear instantly on the others.
-- Run once in the Supabase SQL editor.

ALTER PUBLICATION supabase_realtime ADD TABLE public.notes, public.workspaces;

-- Send the full old row with UPDATE/DELETE events (needed so deletes of
-- shared rows can be matched and RLS can be evaluated on them).
ALTER TABLE public.notes REPLICA IDENTITY FULL;
ALTER TABLE public.workspaces REPLICA IDENTITY FULL;
