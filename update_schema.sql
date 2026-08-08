-- ==========================================
-- SÜREÇ 1: KULLANICI PROFİLLERİ (PROFILES)
-- ==========================================

-- 1. Profiles tablosunu oluştur
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Dışarıdan email aranabilmesi için Profiles tablosuna RLS (Güvenlik) izni ver
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Herkes sistemdeki email adreslerini "okuyabilir" (arama yapabilmek için gerekli)
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles" 
ON public.profiles FOR SELECT 
USING (true);

-- 3. Yeni üye kayıt olduğunda otomatik profile ekleme (Trigger) fonksiyonu
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (new.id, new.email);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger'ı bağla
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Geçmişte kayıt olmuş kullanıcılar varsa onları da profillere ekle
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- ==========================================
-- SÜREÇ 2: ÇALIŞMA ALANI ÜYELERİ (WORKSPACE_MEMBERS)
-- ==========================================

-- 1. Tabloyu oluştur
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(workspace_id, user_id) -- Bir kullanıcı bir çalışma alanına sadece 1 kez eklenebilir
);

-- 2. RLS İzinleri
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Üyeleri okuma işlemi sonsuz döngü yaratmaması için herkese açıktır (zaten workspace ID bilinmeden ulaşılamaz)
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
CREATE POLICY "Members can view workspace members" 
ON public.workspace_members FOR SELECT 
USING (true);

-- Sadece çalışma alanı sahibi yeni üye ekleyebilir/silebilir
DROP POLICY IF EXISTS "Only workspace owners can insert members" ON public.workspace_members;
CREATE POLICY "Only workspace owners can insert members" 
ON public.workspace_members FOR INSERT 
WITH CHECK (
    EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_members.workspace_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Only workspace owners can delete members" ON public.workspace_members;
CREATE POLICY "Only workspace owners can delete members" 
ON public.workspace_members FOR DELETE 
USING (
    EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_members.workspace_id AND user_id = auth.uid()) OR
    user_id = auth.uid() -- Kişi kendi de çıkabilir
);


-- ==========================================
-- SÜREÇ 3: GÜVENLİK (RLS) KURALLARINI ORTAK ÇALIŞMAYA GÖRE GÜNCELLEME
-- ==========================================

-- Eski kuralları sil
DROP POLICY IF EXISTS "Users can view their own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can update their own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can delete their own workspaces" ON public.workspaces;

DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;


-- WORKSPACES YENİ KURALLAR
-- Görüntüleme: Sahibi VEYA Üyesi olan görebilir
DROP POLICY IF EXISTS "Users can view workspaces they own or belong to" ON public.workspaces;
CREATE POLICY "Users can view workspaces they own or belong to" 
ON public.workspaces FOR SELECT 
USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = id AND user_id = auth.uid())
);

-- Güncelleme: Sahibi VEYA Üyesi olan güncelleyebilir
DROP POLICY IF EXISTS "Users can update workspaces they own or belong to" ON public.workspaces;
CREATE POLICY "Users can update workspaces they own or belong to" 
ON public.workspaces FOR UPDATE 
USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = id AND user_id = auth.uid())
);

-- Silme: Sadece sahibi silebilir
DROP POLICY IF EXISTS "Only owners can delete workspaces" ON public.workspaces;
CREATE POLICY "Only owners can delete workspaces" 
ON public.workspaces FOR DELETE 
USING (auth.uid() = user_id);


-- NOTES YENİ KURALLAR
-- Görüntüleme: Notun bağlı olduğu çalışma alanının sahibi VEYA üyesi ise görebilir
DROP POLICY IF EXISTS "Users can view notes in their workspaces" ON public.notes;
CREATE POLICY "Users can view notes in their workspaces" 
ON public.notes FOR SELECT 
USING (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.user_id = auth.uid()) OR 
    EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = workspace_id AND wm.user_id = auth.uid())
);

-- Ekleme: Çalışma alanının sahibi veya üyesi ise ekleyebilir
DROP POLICY IF EXISTS "Users can insert notes in their workspaces" ON public.notes;
CREATE POLICY "Users can insert notes in their workspaces" 
ON public.notes FOR INSERT 
WITH CHECK (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.user_id = auth.uid()) OR 
    EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = workspace_id AND wm.user_id = auth.uid())
);

-- Güncelleme: Çalışma alanının sahibi veya üyesi ise güncelleyebilir
DROP POLICY IF EXISTS "Users can update notes in their workspaces" ON public.notes;
CREATE POLICY "Users can update notes in their workspaces" 
ON public.notes FOR UPDATE 
USING (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.user_id = auth.uid()) OR 
    EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = workspace_id AND wm.user_id = auth.uid())
);

-- Silme: Çalışma alanının sahibi veya üyesi ise silebilir
DROP POLICY IF EXISTS "Users can delete notes in their workspaces" ON public.notes;
CREATE POLICY "Users can delete notes in their workspaces" 
ON public.notes FOR DELETE 
USING (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.user_id = auth.uid()) OR 
    EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = workspace_id AND wm.user_id = auth.uid())
);
