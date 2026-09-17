import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import TableView from './components/TableView';
import ViewTabs from './components/ViewTabs';
import KanbanView from './components/KanbanView';
import GanttView from './components/GanttView';
import TrashView from './components/TrashView';
import NoteDetailDrawer from './components/NoteDetailDrawer';
import AuthModal from './components/AuthModal';
import MembersModal from './components/MembersModal';
import PetCompanion from './components/PetCompanion';
import { supabase } from './services/supabaseClient';
import {
  fetchWorkspaces,
  saveWorkspace,
  deleteWorkspace,
  fetchNotes,
  saveNote,
  fetchTrashNotes,
  moveNoteToTrash,
  restoreNoteFromTrash,
  permanentlyDeleteNote,
  emptyTrashBin,
  updateWorkspaceOrders,
  updateNoteOrders,
  getWorkspaceMembers,
  executeQueuedOp,
  mapNoteRow,
  mapTrashNoteRow,
  mapWorkspaceRow,
  mapTrashWorkspaceRow
} from './services/storageService';
import {
  isOnline,
  loadCache,
  saveCache,
  getLastUserId,
  setLastUserId,
  setOutboxUser,
  flushOutbox,
  getQueue,
  emitSyncStatus
} from './services/offlineStore';
import { CheckCircle, Loader2, Menu, CloudOff, RefreshCw } from 'lucide-react';
import { parseContent, serializeBlocks } from './utils/noteBlocks';

const sortByDeletedAt = (items) => [...items].sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
const sortWorkspaces = (items) => [...items].sort((a, b) =>
  (a.order ?? 0) - (b.order ?? 0) || new Date(a.created_at) - new Date(b.created_at)
);
// A realtime row only replaces the local copy if it isn't older than it.
const isNotOlder = (incomingTs, localTs) => !localTs || !incomingTs || new Date(incomingTs) >= new Date(localTs);

export default function App() {
  const [session, setSession] = useState(null);
  // Set when the app starts offline and the stored session could not be
  // restored: the last signed-in user's cached data is shown instead.
  const [offlineUserId, setOfflineUserId] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [notes, setNotes] = useState([]);
  const [trashNotes, setTrashNotes] = useState([]);

  // Project members for the active workspace
  const [projectMembers, setProjectMembers] = useState([]);

  // Members Modal state
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [manageWorkspaceId, setManageWorkspaceId] = useState(null);
  const [manageWorkspaceName, setManageWorkspaceName] = useState('');

  const [activeCategory, setActiveCategory] = useState('all');
  const [activeView, setActiveView] = useState('all-projects');

  const [selectedNote, setSelectedNote] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ online: isOnline(), pending: 0, flushing: false });

  const userId = session?.user?.id || offlineUserId;

  // Guards against duplicate workspace seeding when refreshAppData runs
  // multiple times in parallel (INITIAL_SESSION + TOKEN_REFRESHED etc.)
  const isSeedingWorkspaceRef = useRef(false);
  const hasSeededWorkspaceRef = useRef(false);
  // True once state holds real data (from cache or server), so the cache is
  // never overwritten with the empty initial state.
  const hasLoadedDataRef = useRef(false);
  // Long-lived listeners (realtime, online events) call the latest version.
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const hasSessionRef = useRef(false);
  hasSessionRef.current = Boolean(session);
  const refreshRef = useRef(null);

  // Setup Supabase Auth Listener
  useEffect(() => {
    // Offline, restoring an expired session can keep retrying the token
    // refresh for a long time; don't block startup on it. A session that
    // arrives later is still delivered through onAuthStateChange.
    const sessionPromise = supabase.auth.getSession();
    const startup = isOnline()
      ? sessionPromise
      : Promise.race([
          sessionPromise,
          new Promise(resolve => setTimeout(() => resolve({ data: { session: null } }), 3000))
        ]);

    startup.then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setLastUserId(session.user.id);
      } else {
        const lastUser = getLastUserId();
        if (!isOnline() && lastUser && loadCache(lastUser)) {
          setOfflineUserId(lastUser);
        } else {
          setIsAuthModalOpen(true);
        }
      }
      setIsInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setSession(session);
        setLastUserId(session.user.id);
        setOfflineUserId(null);
        setIsAuthModalOpen(false);
        return;
      }

      setSession(null);
      if (event === 'SIGNED_OUT') {
        // Clear data when logged out
        hasLoadedDataRef.current = false;
        setLastUserId(null);
        setOfflineUserId(null);
        setOutboxUser(null);
        setWorkspaces([]);
        setNotes([]);
        setTrashNotes([]);
        setActiveWorkspaceId(null);
        setIsAuthModalOpen(true);
      } else if (isOnline() || !getLastUserId()) {
        setIsAuthModalOpen(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load data when the logged-in user changes (compare by id, not by
  // session object reference — getSession/INITIAL_SESSION/TOKEN_REFRESHED
  // each hand back a distinct session object for the same user and would
  // otherwise re-trigger this effect and run refreshAppData concurrently).
  // Cached data is painted first, then replaced by fresh server data.
  // Also re-runs when a live session appears after an offline start, so the
  // queued changes get sent and fresh data is fetched.
  useEffect(() => {
    if (!userId) return;
    setOutboxUser(userId);
    const cached = loadCache(userId);
    if (cached) {
      setWorkspaces(cached.workspaces || []);
      setNotes(cached.notes || []);
      setTrashNotes(cached.trashNotes || []);
      if (cached.activeWorkspaceId) setActiveWorkspaceId(cached.activeWorkspaceId);
      hasLoadedDataRef.current = true;
    }
    refreshAppData();
  }, [userId, session?.user?.id]);

  // Persist the current data for offline use.
  useEffect(() => {
    if (!userId || !hasLoadedDataRef.current) return;
    saveCache(userId, { workspaces, notes, trashNotes, activeWorkspaceId });
  }, [userId, workspaces, notes, trashNotes, activeWorkspaceId]);

  // Keep the active workspace valid when workspaces load, get deleted locally
  // or are removed from another device.
  useEffect(() => {
    if (workspaces.length > 0 && !workspaces.some(w => w.id === activeWorkspaceId)) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, activeWorkspaceId]);

  // Toast notification listener
  useEffect(() => {
    const handleToast = (e) => {
      setToastMessage(e.detail.message);
      setTimeout(() => setToastMessage(null), 2500);
    };
    window.addEventListener('app_toast_notify', handleToast);
    return () => window.removeEventListener('app_toast_notify', handleToast);
  }, []);

  // Connectivity: track online/offline + pending queue, and sync once the
  // connection returns. The interval retries when the browser reports online
  // but the server was unreachable during the last attempt.
  useEffect(() => {
    const handleSyncStatus = (e) => setSyncStatus(e.detail);
    const handleOnline = () => {
      emitSyncStatus();
      refreshRef.current?.();
    };
    const handleOffline = () => emitSyncStatus();

    window.addEventListener('app_sync_status', handleSyncStatus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const retryTimer = setInterval(() => {
      if (isOnline() && getQueue().length > 0) refreshRef.current?.();
    }, 30000);
    emitSyncStatus();

    return () => {
      window.removeEventListener('app_sync_status', handleSyncStatus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(retryTimer);
    };
  }, []);

  // Realtime: apply changes made on other devices (same account or shared
  // workspace members) as they happen. Requires enable_realtime.sql.
  useEffect(() => {
    const sessionUserId = session?.user?.id;
    if (!sessionUserId) return;

    const handleNoteChange = (payload) => {
      if (payload.eventType === 'DELETE') {
        const id = payload.old?.id;
        if (!id) return;
        setNotes(prev => prev.filter(n => n.id !== id));
        setTrashNotes(prev => prev.filter(t => t.id !== id));
        return;
      }

      const row = payload.new;
      if (row.is_trash) {
        const item = mapTrashNoteRow(row);
        setNotes(prev => prev.filter(n => n.id !== row.id));
        setTrashNotes(prev => {
          const local = prev.find(t => t.id === row.id);
          if (local && !isNotOlder(item.updatedAt, local.updatedAt)) return prev;
          return sortByDeletedAt([item, ...prev.filter(t => t.id !== row.id)]);
        });
      } else {
        const incoming = mapNoteRow(row);
        setTrashNotes(prev => prev.filter(t => t.id !== row.id));
        setNotes(prev => {
          const local = prev.find(n => n.id === row.id);
          if (!local) return [...prev, incoming];
          if (!isNotOlder(incoming.updatedAt, local.updatedAt)) return prev;
          return prev.map(n => n.id === row.id ? { ...n, ...incoming } : n);
        });
      }
    };

    const handleWorkspaceChange = (payload) => {
      if (payload.eventType === 'DELETE') {
        const id = payload.old?.id;
        if (!id) return;
        setWorkspaces(prev => prev.filter(w => w.id !== id));
        setTrashNotes(prev => prev.filter(t => t.id !== id));
        return;
      }

      const row = payload.new;
      if (row.is_trash) {
        setWorkspaces(prev => prev.filter(w => w.id !== row.id));
        setTrashNotes(prev => sortByDeletedAt([mapTrashWorkspaceRow(row), ...prev.filter(t => t.id !== row.id)]));
      } else {
        const incoming = mapWorkspaceRow(row);
        setTrashNotes(prev => prev.filter(t => t.id !== row.id));
        setWorkspaces(prev => {
          const local = prev.find(w => w.id === row.id);
          if (!local) return sortWorkspaces([...prev, incoming]);
          if (!isNotOlder(incoming.updated_at, local.updated_at)) return prev;
          return sortWorkspaces(prev.map(w => w.id === row.id ? { ...w, ...incoming } : w));
        });
      }
    };

    let hasSubscribedOnce = false;
    const channel = supabase
      .channel(`mynotes-sync-${sessionUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, handleNoteChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, handleWorkspaceChange)
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        // The first subscribe coincides with the initial load; later ones are
        // reconnects, where changes may have been missed in between.
        if (hasSubscribedOnce) refreshRef.current?.();
        hasSubscribedOnce = true;
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const refreshAppData = async () => {
    const uid = userIdRef.current;
    // Without a live session (offline start) requests would be rejected and
    // queued changes dropped, so wait until auth is restored.
    if (!uid || !hasSessionRef.current || !isOnline()) return;

    setIsFetchingData(true);
    try {
      // Send offline changes first; if some are still pending, server data
      // would overwrite them locally, so keep the local state for now.
      await flushOutbox(executeQueuedOp);
      if (getQueue().length > 0) return;

      let wsData = await fetchWorkspaces();

      if (wsData === null) {
        // fetchWorkspaces failed (network blip, token not yet attached, etc).
        // Do NOT treat this as "no workspaces" — that would seed a duplicate
        // "Ana Çalışma Alanı" on every failed launch. Keep whatever is
        // currently in state and let the user retry.
        window.dispatchEvent(new CustomEvent('app_toast_notify', {
          detail: { message: 'Çalışma alanları yüklenemedi, tekrar denenecek.' }
        }));
      } else if (wsData.length === 0 && !hasSeededWorkspaceRef.current && !isSeedingWorkspaceRef.current) {
        // Genuinely a new user with zero workspaces. Guard against this
        // running twice in parallel (StrictMode double-mount, overlapping
        // auth events) creating two default workspaces.
        isSeedingWorkspaceRef.current = true;
        try {
          const defaultWs = { title: 'Ana Çalışma Alanı', color: '#191919' };
          const newWs = await saveWorkspace(defaultWs);
          if (newWs) {
            wsData = [newWs];
            hasSeededWorkspaceRef.current = true;
          }
        } finally {
          isSeedingWorkspaceRef.current = false;
        }
      }

      const [notesData, trashData] = await Promise.all([fetchNotes(), fetchTrashNotes()]);

      // The user may have signed out or switched while requests were running.
      if (userIdRef.current !== uid) return;

      if (wsData !== null) setWorkspaces(wsData);
      if (notesData !== null) setNotes(notesData);
      if (trashData !== null) setTrashNotes(trashData);
      if (wsData !== null || notesData !== null || trashData !== null) {
        hasLoadedDataRef.current = true;
      }
    } finally {
      setIsFetchingData(false);
    }
  };
  refreshRef.current = refreshAppData;

  // Fetch members when active workspace changes
  useEffect(() => {
    if (activeWorkspaceId && session) {
      refreshActiveMembers();
    }
  }, [activeWorkspaceId, session]);

  const refreshActiveMembers = async () => {
    if (!activeWorkspaceId) return;
    const members = await getWorkspaceMembers(activeWorkspaceId);

    // Always include the current user dynamically if not found
    const hasMe = members.some(m => m.email === session?.user?.email);
    if (!hasMe && session?.user) {
       members.unshift({
         id: 'me',
         userId: session.user.id,
         email: session.user.email,
         role: 'owner' // or member depending on what they actually are
       });
    }

    setProjectMembers(members.map(m => ({
      ...m,
      name: m.email.split('@')[0], // Mock a name from email
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(m.email)}`
    })));
  };

  const openManageMembers = (wsId, wsName) => {
    setManageWorkspaceId(wsId);
    setManageWorkspaceName(wsName);
    setIsMembersModalOpen(true);
  };

  // Filter notes by workspace & category
  const workspaceNotes = notes.filter(n => n.workspaceId === activeWorkspaceId);
  const displayedNotes = workspaceNotes.filter(n => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'shared') return false; // shared not supported yet in simple schema
    return n.status === activeCategory;
  });

  // Replaces a note in the list (and in the open drawer) after a save.
  const applySavedNote = (noteId, savedNote) => {
    setNotes(prev => prev.map(n => n.id === noteId ? savedNote : n));
    setSelectedNote(prev => (prev && prev.id === noteId ? savedNote : prev));
  };

  const handleUpdateStatus = async (noteId, newStatus) => {
    const noteToUpdate = notes.find(n => n.id === noteId);
    if (!noteToUpdate) return;

    let updatedNote = { ...noteToUpdate, status: newStatus };

    // Otomatik tarih atama mantığı:
    // Başlangıç tarihi ASLA otomatik değişmez (not oluşturulma tarihi veya manuel seçilen tarih kalır).
    // Bitiş tarihi ise yalnızca "Tamamlandı" durumuna geçerse otomatik ayarlanır.
    if (newStatus === 'Tamamlandı') {
      updatedNote.endDate = new Date().toISOString();
      window.dispatchEvent(new CustomEvent('app_toast_notify', {
        detail: { message: 'Görev başarıyla tamamlandı!' }
      }));
    }

    const result = await saveNote(updatedNote);

    if (result) {
      applySavedNote(noteId, { ...updatedNote, updatedAt: result.updated_at });
    }
  };

  const handleUpdateDates = async (noteId, newStartDate, newEndDate) => {
    const noteToUpdate = notes.find(n => n.id === noteId);
    if (!noteToUpdate) return;

    const updatedNote = { ...noteToUpdate, startDate: newStartDate, endDate: newEndDate };
    const result = await saveNote(updatedNote);

    if (result) {
      applySavedNote(noteId, { ...updatedNote, updatedAt: result.updated_at });
    }
  };

  const handleUpdateHeadingDates = async (noteId, headingBlockId, newStartDate, newEndDate) => {
    const noteToUpdate = notes.find(n => n.id === noteId);
    if (!noteToUpdate) return;

    const blocks = parseContent(noteToUpdate.content);
    const updatedBlocks = blocks.map(b => {
      if (b.id === headingBlockId) {
        return {
          ...b,
          startDate: newStartDate,
          endDate: newEndDate
        };
      }
      return b;
    });

    const newContent = serializeBlocks(updatedBlocks);
    const updatedNote = { ...noteToUpdate, content: newContent };
    const result = await saveNote(updatedNote);

    if (result) {
      applySavedNote(noteId, { ...updatedNote, updatedAt: result.updated_at });
    }
  };

  const handleUpdateTitle = async (noteId, newTitle) => {
    const noteToUpdate = notes.find(n => n.id === noteId);
    if (!noteToUpdate) return;

    const updatedNote = { ...noteToUpdate, title: newTitle };
    const result = await saveNote(updatedNote);

    if (result) {
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, title: newTitle, updatedAt: result.updated_at } : n));
      setSelectedNote(prev => (prev && prev.id === noteId ? { ...prev, title: newTitle, updatedAt: result.updated_at } : prev));
    }
  };

  const handleSaveNote = async (updatedNote) => {
    const result = await saveNote(updatedNote);
    if (result) {
      const dbSavedNote = { ...updatedNote, id: result.id, updatedAt: result.updated_at };
      setNotes(prev => prev.map(n => (n.id === updatedNote.id || n.id === result.id) ? dbSavedNote : n));
      setSelectedNote(dbSavedNote);
    }
  };

  const handleMoveToTrash = async (noteId) => {
    const note = notes.find(n => n.id === noteId);
    const success = await moveNoteToTrash(noteId);
    if (success) {
      const now = new Date().toISOString();
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (note) {
        setTrashNotes(prev => sortByDeletedAt([
          { ...note, is_trash: true, type: 'note', updatedAt: now, deletedAt: now },
          ...prev.filter(t => t.id !== noteId)
        ]));
      }
      setSelectedNote(null);
    }
  };

  const handleRestoreFromTrash = async (itemId) => {
    const item = trashNotes.find(t => t.id === itemId);
    const success = await restoreNoteFromTrash(itemId);
    if (!success) return;

    setTrashNotes(prev => prev.filter(t => t.id !== itemId));
    if (item?.type === 'note') {
      const { type: _type, deletedAt: _deletedAt, ...note } = item;
      setNotes(prev => [...prev.filter(n => n.id !== itemId), { ...note, is_trash: false, updatedAt: new Date().toISOString() }]);
    } else if (item?.type === 'workspace') {
      setWorkspaces(prev => [
        ...prev.filter(w => w.id !== itemId),
        { id: item.id, title: item.name, name: item.name, icon: item.icon, color: '#191919', order: prev.length, is_trash: false }
      ]);
    }
    if (isOnline()) refreshAppData();
  };

  const handlePermanentlyDelete = async (itemId) => {
    const success = await permanentlyDeleteNote(itemId);
    if (success) {
      setTrashNotes(prev => prev.filter(t => t.id !== itemId));
      if (isOnline()) refreshAppData();
    }
  };

  const handleEmptyTrash = async () => {
    if (window.confirm('Geri Dönüşüm Kutusu\'ndaki tüm notlar kalıcı olarak silinecek. Emin misiniz?')) {
      const success = await emptyTrashBin();
      if (success) {
        setTrashNotes([]);
        if (isOnline()) refreshAppData();
      }
    }
  };

  const handleNewNote = async () => {
    const defaultMember = projectMembers[0]?.name || 'Siz (Hesabınız)';
    const workspaceNotes = notes.filter(n => n.workspaceId === activeWorkspaceId);
    const maxOrder = workspaceNotes.length > 0 ? Math.max(...workspaceNotes.map(n => n.order || 0)) : -1;

    const newNote = {
      id: `note-${Date.now()}`, // Temporary ID; saveNote assigns a real UUID
      workspaceId: activeWorkspaceId,
      title: 'Yeni Not / Görev Başlığı',
      status: 'Yapılacaklar',
      priority: 'Medium',
      assignee: defaultMember,
      order: maxOrder + 1,
      updatedAt: new Date().toISOString(),
      content: '### Not Detayları\n- [ ] Yapılacak görevi yazın'
    };

    // Save immediately to get real UUID
    const result = await saveNote(newNote);
    if (result) {
      const realNote = { ...newNote, id: result.id, updatedAt: result.updated_at, createdAt: result.created_at };
      // A realtime echo may have inserted the row already.
      setNotes(prev => [...prev.filter(n => n.id !== realNote.id), realNote]);
      setSelectedNote(realNote);
    }
  };

  const handleUpdateWorkspace = async (wsId, newName, newIcon) => {
    const wsToUpdate = workspaces.find(w => w.id === wsId);
    if (!wsToUpdate) return;

    const updatedWs = { ...wsToUpdate, title: newName, icon: newIcon };
    const result = await saveWorkspace(updatedWs);
    if (result) {
      // Sidebar renders ws.name, so it must be updated together with title.
      setWorkspaces(prev => prev.map(w => w.id === wsId
        ? { ...w, title: result.title, name: result.title, icon: result.icon, color: result.color, updated_at: result.updated_at }
        : w
      ));
    }
  };

  const handleAddWorkspace = async (name, icon) => {
    const newWs = { title: name, color: '#191919', icon, order: workspaces.length };
    const result = await saveWorkspace(newWs);
    if (result) {
      setWorkspaces(prev => [...prev.filter(w => w.id !== result.id), result]);
      setActiveWorkspaceId(result.id);
    }
  };

  const handleDeleteWorkspace = async (wsId) => {
    if (workspaces.length <= 1) {
      alert('En az bir çalışma alanınız bulunmalıdır. Son çalışma alanını silemezsiniz.');
      return;
    }

    const ws = workspaces.find(w => w.id === wsId);
    const success = await deleteWorkspace(wsId);
    if (success) {
      setWorkspaces(prev => prev.filter(w => w.id !== wsId));
      if (ws) {
        const now = new Date().toISOString();
        setTrashNotes(prev => sortByDeletedAt([
          { id: ws.id, name: ws.name, icon: ws.icon, type: 'workspace', deletedAt: now },
          ...prev.filter(t => t.id !== wsId)
        ]));
      }
      if (isOnline()) refreshAppData();
    }
  };

  const handleReorderWorkspaces = async (reorderedWorkspaces) => {
    // Write the index onto each workspace so realtime/sorting agree with the drag result.
    const renumbered = reorderedWorkspaces.map((ws, index) => ({ ...ws, order: index }));
    setWorkspaces(renumbered); // Update UI immediately
    const updates = renumbered.map(ws => ({ id: ws.id, order: ws.order }));
    await updateWorkspaceOrders(updates);
  };

  const handleReorderNotes = async (reorderedNotes) => {
    if (reorderedNotes.length === 0) return;

    // reorderedNotes only contains the currently visible (search/category filtered)
    // subset of one workspace, in its new drag order. Notes hidden by a filter must
    // keep their relative slot so we don't collide `order` values with them.
    const wsId = reorderedNotes[0].workspaceId;
    const workspaceNotesAll = notes.filter(n => n.workspaceId === wsId);
    const otherWorkspaceNotes = notes.filter(n => n.workspaceId !== wsId);

    const originalSlotOrder = [...workspaceNotesAll].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const reorderedIds = new Set(reorderedNotes.map(n => n.id));
    let cursor = 0;
    const merged = originalSlotOrder.map(n => {
      if (reorderedIds.has(n.id)) {
        const replacement = reorderedNotes[cursor];
        cursor += 1;
        return replacement;
      }
      return n;
    });

    // Write the new index onto each note object (not just its array position) so the
    // render-time sort by `order` agrees with the drag result instead of fighting it.
    const renumbered = merged.map((n, index) => ({ ...n, order: index }));

    // UI update
    setNotes([...otherWorkspaceNotes, ...renumbered]);

    // DB update
    const updates = renumbered.map(n => ({ id: n.id, order: n.order }));
    await updateNoteOrders(updates);
  };

  if (isInitializing) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', color: '#fff' }}>
        <Loader2 size={32} className="spin-loader" />
      </div>
    );
  }

  const showSyncPill = userId && (!syncStatus.online || syncStatus.pending > 0 || syncStatus.flushing);

  return (
    <div className="app-container">
      {/* Hamburger + backdrop only render/act as a drawer toggle below 768px (see index.css) */}
      <button
        className="mobile-sidebar-toggle"
        onClick={() => setIsMobileSidebarOpen(true)}
        title="Menüyü Aç"
      >
        <Menu size={18} />
      </button>

      {isMobileSidebarOpen && (
        <div className="mobile-sidebar-backdrop" onClick={() => setIsMobileSidebarOpen(false)} />
      )}

      <Sidebar
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        setActiveWorkspaceId={setActiveWorkspaceId}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        trashCount={trashNotes.length}
        session={session}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onNewNote={handleNewNote}
        onUpdateWorkspace={handleUpdateWorkspace}
        onAddWorkspace={handleAddWorkspace}
        onDeleteWorkspace={handleDeleteWorkspace}
        onReorderWorkspaces={handleReorderWorkspaces}
        onManageMembers={openManageMembers}
        mobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <main className="main-content" style={{ position: 'relative' }}>
        {isFetchingData && (
          <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 100, background: 'rgba(0,0,0,0.5)', padding: '8px', borderRadius: '50%' }}>
            <Loader2 size={20} className="spin-loader" style={{ color: '#a78bfa' }} />
          </div>
        )}

        {showSyncPill && (
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#252525',
            border: `1px solid ${syncStatus.online ? '#2eaadc' : '#f59e0b'}`,
            color: 'var(--text-main)',
            padding: '6px 12px',
            borderRadius: '999px',
            fontSize: '0.78rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-md)',
            pointerEvents: 'none'
          }}>
            {syncStatus.online ? (
              <>
                <RefreshCw size={14} className={syncStatus.flushing ? 'spin-loader' : undefined} style={{ color: '#2eaadc' }} />
                <span>
                  {syncStatus.flushing ? 'Eşitleniyor…' : `${syncStatus.pending} değişiklik eşitlenmeyi bekliyor`}
                </span>
              </>
            ) : (
              <>
                <CloudOff size={14} style={{ color: '#f59e0b' }} />
                <span>
                  Çevrimdışı{syncStatus.pending > 0 ? ` · ${syncStatus.pending} bekleyen değişiklik` : ''}
                </span>
              </>
            )}
          </div>
        )}

        {(!userId) ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Lütfen notlarınızı görüntülemek için giriş yapın.
          </div>
        ) : activeCategory === 'trash' ? (
          <TrashView
            trashNotes={trashNotes}
            onRestoreNote={handleRestoreFromTrash}
            onPermanentlyDeleteNote={handlePermanentlyDelete}
            onEmptyTrash={handleEmptyTrash}
          />
        ) : (
          <>
            {activeView === 'all-projects' && (
              <TableView
                notes={displayedNotes}
                activeView={activeView}
                setActiveView={setActiveView}
                onSelectNote={setSelectedNote}
                onUpdateStatus={handleUpdateStatus}
                onUpdateTitle={handleUpdateTitle}
                onUpdateDates={handleUpdateDates}
                onNewNote={handleNewNote}
                onReorderNotes={handleReorderNotes}
                activeWorkspaceId={activeWorkspaceId}
              />
            )}

            {activeView === 'by-status' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="notion-topbar">
                  <ViewTabs activeView={activeView} setActiveView={setActiveView} />
                </div>
                <KanbanView
                  notes={displayedNotes}
                  onSelectNote={setSelectedNote}
                  onUpdateStatus={handleUpdateStatus}
                  onNewNote={handleNewNote}
                />
              </div>
            )}

            {activeView === 'gantt' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="notion-topbar">
                  <ViewTabs activeView={activeView} setActiveView={setActiveView} />
                </div>
                <GanttView
                  notes={displayedNotes}
                  onSelectNote={setSelectedNote}
                  onUpdateDates={handleUpdateDates}
                  onUpdateHeadingDates={handleUpdateHeadingDates}
                />
              </div>
            )}
          </>
        )}
      </main>

      <NoteDetailDrawer
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onSave={handleSaveNote}
        onDelete={handleMoveToTrash}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        session={session}
      />

      <MembersModal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        workspaceId={manageWorkspaceId}
        workspaceName={manageWorkspaceName}
        members={manageWorkspaceId === activeWorkspaceId ? projectMembers.filter(m => m.id !== 'me') : []}
        refreshMembers={refreshActiveMembers}
      />

      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: '#252525',
          border: '1px solid #10b981',
          color: '#e3e3e3',
          padding: '10px 16px',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.85rem',
          fontWeight: 600,
          zIndex: 300,
          animation: 'fadeIn 0.2s'
        }}>
          <CheckCircle size={18} style={{ color: '#10b981' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Toph Animated Pet Companion — desktop-only: half of it is an OS-level
          overlay window (see electron/main.cjs) that has no mobile equivalent,
          and the 941-line component just adds dead weight on a phone screen. */}
      {typeof window !== 'undefined' && window.innerWidth > 768 && <PetCompanion />}
    </div>
  );
}
