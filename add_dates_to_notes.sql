-- ==========================================
-- SÜREÇ 4: NOTLAR İÇİN GANTT TARİHLERİNİ EKLEME
-- ==========================================

-- 1. Notes tablosuna start_date ve end_date kolonlarını ekle
ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;
