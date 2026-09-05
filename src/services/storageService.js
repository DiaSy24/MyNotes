import { supabase } from './supabaseClient';

const getCurrentUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id;
};

export const fetchWorkspaces = async () => {
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

  return data.map(ws => {
    let icon = '📝';
    let color = ws.color;
    try {
      if (ws.color && ws.color.startsWith('{')) {
        const parsed = JSON.parse(ws.color);
        icon = parsed.icon || icon;
        color = parsed.hex || color;
      }
    } catch(e) {}
    
    return {
      ...ws,
      name: ws.title, // Sidebar expects ws.name
      icon,
      color
    };
  }) || [];
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

  const { data, error } = await supabase
    .from('workspaces')
    .upsert({ ...dbWorkspace, user_id: userId })
    .select();
    
  if (error) {
    console.error('Error saving workspace:', error);
    alert('Kayıt başarısız: ' + error.message);
    return null;
  }
  notifySaveSuccess('Çalışma alanı kaydedildi');
  
  if (data && data[0]) {
    let parsedIcon = '📝';
    try {
      if (data[0].color && data[0].color.startsWith('{')) {
        parsedIcon = JSON.parse(data[0].color).icon || parsedIcon;
      }
    } catch(e) {}
    return { ...data[0], name: data[0].title, icon: parsedIcon };
  }
  return null;
};

export const deleteWorkspace = async (workspaceId) => {
  const { error } = await supabase
    .from('workspaces')
    .update({ is_trash: true, updated_at: new Date().toISOString() })
    .eq('id', workspaceId);
    
  if (error) {
    console.error('Error deleting workspace:', error);
    return false;
  }
  notifySaveSuccess('Çalışma alanı silindi');
  return true;
};

export const fetchNotes = async () => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('is_trash', false)
    .order('order', { ascending: true })
    .order('updated_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
  
  // Transform db snake_case to frontend camelCase
  return data.map(n => ({
    id: n.id,
    workspaceId: n.workspace_id,
    title: n.title,
    content: n.content,
    status: n.status,
    category: 'Genel', // Hardcoded for now or add to schema
    order: n.order ?? 0,
    updatedAt: n.updated_at,
    createdAt: n.created_at,
    startDate: n.start_date,
    endDate: n.end_date,
    is_trash: n.is_trash
  })) || [];
};

export const fetchTrashNotes = async () => {
  // Fetch trash notes
  const { data: notesData, error: notesError } = await supabase
    .from('notes')
    .select('*')
    .eq('is_trash', true)
    .order('updated_at', { ascending: false });
    
  if (notesError) console.error('Error fetching trash notes:', notesError);
  
  // Fetch trash workspaces
  const { data: wsData, error: wsError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('is_trash', true)
    .order('updated_at', { ascending: false });
    
  if (wsError) console.error('Error fetching trash workspaces:', wsError);

  const trashItems = [];
  
  if (notesData) {
    trashItems.push(...notesData.map(n => ({
      id: n.id,
      workspaceId: n.workspace_id,
      title: n.title,
      content: n.content,
      status: n.status,
      category: 'Genel',
      order: n.order ?? 0,
      updatedAt: n.updated_at,
      createdAt: n.created_at,
      is_trash: n.is_trash,
      type: 'note',
      deletedAt: n.updated_at
    })));
  }

  if (wsData) {
    trashItems.push(...wsData.map(w => {
      let icon = '📂';
      try {
        if (w.color && w.color.startsWith('{')) {
          icon = JSON.parse(w.color).icon || icon;
        }
      } catch(e) {}
      
      return {
        id: w.id,
        name: w.title, // map title to name for UI
        icon,
        type: 'workspace',
        deletedAt: w.updated_at
      };
    }));
  }
  
  // Sort combined by deletedAt desc
  return trashItems.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
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

  const dbNote = {
    id: note.id && !note.id.startsWith('note-') ? note.id : undefined, // Let Supabase handle UUID if it's a new fake ID
    user_id: userId,
    workspace_id: note.workspaceId,
    title: note.title || 'İsimsiz Not',
    content: note.content || '',
    status: note.status || 'Yapılacaklar',
    order: typeof note.order === 'number' ? note.order : 0,
    start_date: sanitizeTimestamp(note.startDate),
    end_date: sanitizeTimestamp(note.endDate),
    is_trash: note.is_trash || false,
    updated_at: new Date().toISOString()
  };

  // If it's a completely new note with our old 'note-123' id format, we must not pass the id to Supabase 
  // so Supabase can generate a valid UUID.
  if (note.id && note.id.startsWith('note-')) {
    delete dbNote.id;
  }

  const { data, error } = await supabase
    .from('notes')
    .upsert(dbNote)
    .select();
    
  if (error) {
    console.error('Error saving note:', error);
    alert('Not kaydedilemedi: ' + error.message);
    return null;
  }
  notifySaveSuccess('Not kaydedildi');
  return data?.[0];
};

export const moveNoteToTrash = async (noteId) => {
  const { error } = await supabase
    .from('notes')
    .update({ is_trash: true, updated_at: new Date().toISOString() })
    .eq('id', noteId);
    
  if (error) {
    console.error('Error moving note to trash:', error);
    return false;
  }
  notifySaveSuccess('Not Çöp Kutusuna taşındı');
  return true;
};

export const restoreNoteFromTrash = async (itemId) => {
  // Try notes first
  const { error: noteError } = await supabase
    .from('notes')
    .update({ is_trash: false, updated_at: new Date().toISOString() })
    .eq('id', itemId);
    
  if (!noteError) {
    // Note restored (or didn't exist, which is fine, we'll try workspace)
  }

  const { error: wsError } = await supabase
    .from('workspaces')
    .update({ is_trash: false, updated_at: new Date().toISOString() })
    .eq('id', itemId);
    
  notifySaveSuccess('Öğe geri yüklendi');
  return true;
};

export const permanentlyDeleteNote = async (itemId) => {
  await supabase.from('notes').delete().eq('id', itemId);
  await supabase.from('workspaces').delete().eq('id', itemId);
  
  notifySaveSuccess('Öğe kalıcı olarak silindi');
  return true;
};

export const emptyTrashBin = async () => {
  await supabase.from('notes').delete().eq('is_trash', true);
  await supabase.from('workspaces').delete().eq('is_trash', true);
  
  notifySaveSuccess('Çöp Kutusu boşaltıldı');
  return true;
};

const notifySaveSuccess = (message) => {
  window.dispatchEvent(new CustomEvent('app_toast_notify', { detail: { message } }));
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
  try {
    const promises = updates.map(u => 
      supabase.from('workspaces').update({ order: u.order }).eq('id', u.id)
    );
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Error updating workspace orders:', error);
    return false;
  }
};

export const updateNoteOrders = async (updates) => {
  try {
    const results = await Promise.all(
      updates.map(u => supabase.from('notes').update({ order: u.order }).eq('id', u.id))
    );
    const failed = results.filter(r => r.error);
    if (failed.length > 0) {
      console.error('Error updating note orders:', failed.map(f => f.error));
      window.dispatchEvent(new CustomEvent('app_toast_notify', {
        detail: { message: 'Not sırası kaydedilemedi, tekrar deneyin.' }
      }));
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error updating note orders:', error);
    return false;
  }
};
