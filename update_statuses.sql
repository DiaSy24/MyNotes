-- ==========================================
-- ESKİ DURUMLARI TÜRKÇEYE ÇEVİRME
-- ==========================================

UPDATE public.notes SET status = 'Yapılacaklar' WHERE status = 'To Do';
UPDATE public.notes SET status = 'Devam Ediyor' WHERE status = 'In Progress';
UPDATE public.notes SET status = 'İnceleniyor' WHERE status = 'In Review';
UPDATE public.notes SET status = 'Tamamlandı' WHERE status = 'Done';
