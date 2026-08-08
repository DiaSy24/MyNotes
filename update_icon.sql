-- Çalışma alanlarına (Workspaces) icon desteği ekler
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '📝';
