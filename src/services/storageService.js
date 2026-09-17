import { supabase } from './supabaseClient';
import { enqueue, getLastUserId, isNetworkError, isOnline } from './offlineStore';

const getCurrentUserId = async () => {
  // getSession reads the locally stored session (no network round trip), so
  // writes still know who the user is while offline.
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || getLastUserId();
  } catch {
    return getLastUserId();
  }
};

const newId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const notifySaveSuccess = (message) => {
  window.dispatchEvent(new CustomEvent('app_toast_notify', { detail: { message } }));
};

const OFFLINE_SAVED_MESSAGE = 'Çevrimdışı kaydedildi, bağlantı gelince eşitlenecek';

// ==========================================
// ROW MAPPERS (DB snake_case -> UI camelCase)
// ==========================================

const LEGACY_STATUS = {
  'To Do': 'Yapılacaklar',
  'In Progress': 'Devam Ediyor',
  'In Review': 'İnceleniyor',
  'Done': 'Tamamlandı'
};

export const mapWorkspaceRow = (ws) => {
  let icon = '📝';
  let color = ws.color;
  try {
    if (ws.color && ws.color.startsWith('{')) {
      const parsed = JSON.parse(ws.color);
      icon = parsed.icon || icon;
      color = parsed.hex || color;
    }
  } catch { /* plain hex color */ }

  return {
    ...ws,
    name: ws.title, // Sidebar expects ws.name
    icon,
    color
  };
};

export const mapNoteRow = (n) => ({
  id: n.id,
  workspaceId: n.workspace_id,
  title: n.title,
  content: n.content,
  status: LEGACY_STATUS[n.status] || n.status,
  order: n.order ?? 0,
  updatedAt: n.updated_at,
  createdAt: n.created_at,
  startDate: n.start_date,
  endDate: n.end_date,
  is_trash: n.is_trash
});

export const mapTrashNoteRow = (n) => ({
  ...mapNoteRow(n),
  type: 'note',
  deletedAt: n.updated_at
});

export const mapTrashWorkspaceRow = (w) => {
  const mapped = mapWorkspaceRow(w);
  return {
    id: w.id,
    name: w.title,
    icon: mapped.icon === '📝' ? '📂' : mapped.icon,
    type: 'workspace',
    deletedAt: w.updated_at
  };
};

// ==========================================
// REMOTE EXECUTORS
// Each resolves to { data, error }. They are used both for live writes and
// for replaying queued offline writes, so their arguments must be plain JSON.
// ==========================================

const firstError = (results) => results.find(r => r.error)?.error || null;

const remote = {
  saveNote: (dbNote) => supabase.from('notes').upsert(dbNote).select(),

  saveWorkspace: (dbWorkspace) => supabase.from('workspaces').upsert(dbWorkspace).select(),

  deleteWorkspace: (workspaceId, timestamp) => supabase
    .from('workspaces')
    .update({ is_trash: true, updated_at: timestamp })
    .eq('id', workspaceId),

  moveNoteToTrash: (noteId, timestamp) => supabase
    .from('notes')
    .update({ is_trash: true, updated_at: timestamp })
    .eq('id', noteId),

  restoreItem: async (itemId, timestamp) => {
    // The id may belong to either a note or a workspace.
    const results = await Promise.all([
      supabase.from('notes').update({ is_trash: false, updated_at: timestamp }).eq('id', itemId),
      supabase.from('workspaces').update({ is_trash: false, updated_at: timestamp }).eq('id', itemId)
    ]);
    return { data: null, error: firstError(results) };
  },

  permanentlyDelete: async (itemId) => {
    const results = await Promise.all([
      supabase.from('notes').delete().eq('id', itemId),
      supabase.from('workspaces').delete().eq('id', itemId)
    ]);
    return { data: null, error: firstError(results) };
  },

  emptyTrash: async () => {
    const results = [
      await supabase.from('notes').delete().eq('is_trash', true),
      await supabase.from('workspaces').delete().eq('is_trash', true)
    ];
    return { data: null, error: firstError(results) };
  },

  updateWorkspaceOrders: async (updates) => {
    const results = await Promise.all(
      updates.map(u => supabase.from('workspaces').update({ order: u.order }).eq('id', u.id))
    );
    return { data: null, error: firstError(results) };
  },

  updateNoteOrders: async (updates) => {
    const results = await Promise.all(
      updates.map(u => supabase.from('notes').update({ order: u.order }).eq('id', u.id))
    );
    return { data: null, error: firstError(results) };
  }
};

// Replays one queued operation (see offlineStore.flushOutbox).
export const executeQueuedOp = async (op) => {
  const fn = remote[op.type];
  if (!fn) return { ok: true }; // unknown/obsolete op: drop it
  try {
    const { error } = await fn(...(op.args || []));
    return error ? { ok: false, error } : { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
};

// Runs a write against Supabase, or queues it when the network is unavailable.
// Returns { ok, data, queued }.
const runWrite = async (type, args, key) => {
  const queue = () => {
    enqueue({ type, args, key });
    notifySaveSuccess(OFFLINE_SAVED_MESSAGE);
    return { ok: true, data: null, queued: true };
  };

  if (!isOnline()) return queue();

  try {
    const { data, error } = await remote[type](...args);
    if (error) {
      if (isNetworkError(error)) return queue();
      return { ok: false, error };
    }
    return { ok: true, data, queued: false };
  } catch (error) {
    if (isNetworkError(error)) return queue();
    return { ok: false, error };
  }
};

// ==========================================
// WORKSPACES
// ==========================================

// Returns null when the request failed (e.g. offline) so callers can tell
// "could not load" apart from "no workspaces".
export const fetchWorkspaces = async () => {
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('is_trash', false)
      .order('order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching workspaces:', error);
      return null;
    }
    return (data || []).map(mapWorkspaceRow);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return null;
  }
};

export const saveWorkspace = async (workspace) => {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('User not logged in');
    return null;
  }

  // Convert name to title for DB if it exists
  const dbWorkspace = { ...workspace };
  if (dbWorkspace.name && !dbWorkspace.title) {
    dbWorkspace.title = dbWorkspace.name;
  }
  delete dbWorkspace.name; // Don't try to save 'name' to DB

  // Encode icon into color field to avoid schema errors
  let dbColor = dbWorkspace.color || '#191919';
  if (dbWorkspace.icon) {
    dbColor = JSON.stringify({ hex: dbColor, icon: dbWorkspace.icon });
  }
  delete dbWorkspace.icon;
  dbWorkspace.color = dbColor;

  // Client-side ids let a workspace created offline keep the same id once synced.
  const now = new Date().toISOString();
  if (!dbWorkspace.id) {
    dbWorkspace.id = newId();
    dbWorkspace.created_at = now;
  }
  dbWorkspace.updated_at = now;
  dbWorkspace.user_id = dbWorkspace.user_id || userId;

  const result = await runWrite('saveWorkspace', [dbWorkspace], dbWorkspace.id);

  if (!result.ok) {
    console.error('Error saving workspace:', result.error);
    alert('Kayıt başarısız: ' + result.error.message);
    return null;
  }

  if (result.queued) return mapWorkspaceRow(dbWorkspace);

  notifySaveSuccess('Çalışma alanı kaydedildi');
  return result.data?.[0] ? mapWorkspaceRow(result.data[0]) : mapWorkspaceRow(dbWorkspace);
};

export const deleteWorkspace = async (workspaceId) => {
  const result = await runWrite('deleteWorkspace', [workspaceId, new Date().toISOString()]);
  if (!result.ok) {
    console.error('Error deleting workspace:', result.error);
    return false;
  }
  if (!result.queued) notifySaveSuccess('Çalışma alanı silindi');
  return true;
};

// ==========================================
// NOTES
// ==========================================

export const fetchNotes = async () => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('is_trash', false)
      .order('order', { ascending: true })
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching notes:', error);
      return null;
    }
    return (data || []).map(mapNoteRow);
  } catch (error) {
    console.error('Error fetching notes:', error);
    return null;
  }
};

export const fetchTrashNotes = async () => {
  try {
    const [{ data: notesData, error: notesError }, { data: wsData, error: wsError }] = await Promise.all([
      supabase.from('notes').select('*').eq('is_trash', true).order('updated_at', { ascending: false }),
      supabase.from('workspaces').select('*').eq('is_trash', true).order('updated_at', { ascending: false })
    ]);

    if (notesError || wsError) {
      console.error('Error fetching trash:', notesError || wsError);
      return null;
    }

    const trashItems = [
      ...(notesData || []).map(mapTrashNoteRow),
      ...(wsData || []).map(mapTrashWorkspaceRow)
    ];

    // Sort combined by deletedAt desc
    return trashItems.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  } catch (error) {
    console.error('Error fetching trash:', error);
    return null;
  }
};

const sanitizeTimestamp = (val) => {
  if (!val) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.toISOString();
  }
  return null;
};

export const saveNote = async (note) => {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('User not logged in');
    return null;
  }

  const now = new Date().toISOString();
  // Legacy temporary 'note-123' ids (or no id) get a real UUID generated here,
  // so a note created offline keeps the same id once it syncs.
  const id = note.id && !note.id.startsWith('note-') ? note.id : newId();

  const dbNote = {
    id,
    user_id: userId,
    workspace_id: note.workspaceId,
    title: note.title || 'İsimsiz Not',
    content: note.content || '',
    status: note.status || 'Yapılacaklar',
    order: typeof note.order === 'number' ? note.order : 0,
    start_date: sanitizeTimestamp(note.startDate),
    end_date: sanitizeTimestamp(note.endDate),
    is_trash: note.is_trash || false,
    updated_at: now
  };

  const result = await runWrite('saveNote', [dbNote], id);

  if (!result.ok) {
    console.error('Error saving note:', result.error);
    alert('Not kaydedilemedi: ' + result.error.message);
    return null;
  }

  if (result.queued) {
    return { ...dbNote, created_at: note.createdAt || now };
  }

  notifySaveSuccess('Not kaydedildi');
  return result.data?.[0] || { ...dbNote, created_at: note.createdAt || now };
};

export const moveNoteToTrash = async (noteId) => {
  const result = await runWrite('moveNoteToTrash', [noteId, new Date().toISOString()]);
  if (!result.ok) {
    console.error('Error moving note to trash:', result.error);
    return false;
  }
  if (!result.queued) notifySaveSuccess('Not Çöp Kutusuna taşındı');
  return true;
};

export const restoreNoteFromTrash = async (itemId) => {
  const result = await runWrite('restoreItem', [itemId, new Date().toISOString()]);
  if (!result.ok) {
    console.error('Error restoring item:', result.error);
    return false;
  }
  if (!result.queued) notifySaveSuccess('Öğe geri yüklendi');
  return true;
};

export const permanentlyDeleteNote = async (itemId) => {
  const result = await runWrite('permanentlyDelete', [itemId]);
  if (!result.ok) {
    console.error('Error deleting item:', result.error);
    return false;
  }
  if (!result.queued) notifySaveSuccess('Öğe kalıcı olarak silindi');
  return true;
};

export const emptyTrashBin = async () => {
  const result = await runWrite('emptyTrash', []);
  if (!result.ok) {
    console.error('Error emptying trash:', result.error);
    return false;
  }
  if (!result.queued) notifySaveSuccess('Çöp Kutusu boşaltıldı');
  return true;
};

// Dummy functions to satisfy UI for export/import temporarily since we moved to DB
export const exportDataJSON = () => { alert("Bu özellik Supabase sürümünde henüz yapılandırılmadı."); };
export const importDataJSON = () => { alert("Bu özellik Supabase sürümünde henüz yapılandırılmadı."); };
export const clearAllData = () => { alert("Bu özellik Supabase sürümünde henüz yapılandırılmadı."); };

// ==========================================
// WORKSPACE MEMBERSHIP (COLLABORATION)
// ==========================================

export const checkUserExists = async (email) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error checking user:', error);
      return null;
    }
    return data; // returns { id, email }
  } catch (err) {
    console.error('Network error checking user:', err);
    return null;
  }
};

export const getWorkspaceMembers = async (workspaceId) => {
  try {
    // We join workspace_members with profiles to get the emails
    const { data, error } = await supabase
      .from('workspace_members')
      .select(`
        id,
        role,
        user_id,
        profiles (
          email
        )
      `)
      .eq('workspace_id', workspaceId);

    if (error) throw error;
    
    // Flatten the result
    return data.map(member => ({
      id: member.id,
      userId: member.user_id,
      email: member.profiles?.email || 'Bilinmiyor',
      role: member.role
    }));
  } catch (err) {
    console.error('Error fetching members:', err);
    return [];
  }
};

export const addWorkspaceMember = async (workspaceId, email) => {
  try {
    // 1. Check if user exists
    const userProfile = await checkUserExists(email);
    if (!userProfile) {
      return { success: false, error: 'Bu e-posta sistemde kayıtlı değil.' };
    }

    // 2. Check if already a member
    const { data: existing, error: existError } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userProfile.id)
      .single();

    if (existing) {
      return { success: false, error: 'Kullanıcı zaten bu çalışma alanında ekli.' };
    }

    // 3. Add to workspace
    const { error: insertError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: userProfile.id,
        role: 'member'
      });
      
    if (insertError) throw insertError;
    return { success: true };
  } catch (err) {
    console.error('Error adding member:', err);
    return { success: false, error: 'Üye eklenirken beklenmedik bir hata oluştu.' };
  }
};

export const removeWorkspaceMember = async (memberId) => {
  try {
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error removing member:', err);
    return false;
  }
};

// Ordering updates
export const updateWorkspaceOrders = async (updates) => {
  // updates: array of { id, order }
  const result = await runWrite('updateWorkspaceOrders', [updates]);
  if (!result.ok) {
    console.error('Error updating workspace orders:', result.error);
    return false;
  }
  return true;
};

export const updateNoteOrders = async (updates) => {
  const result = await runWrite('updateNoteOrders', [updates]);
  if (!result.ok) {
    console.error('Error updating note orders:', result.error);
    window.dispatchEvent(new CustomEvent('app_toast_notify', {
      detail: { message: 'Not sırası kaydedilemedi, tekrar deneyin.' }
    }));
    return false;
  }
  return true;
};
