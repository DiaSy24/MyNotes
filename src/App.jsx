import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TableView from './components/TableView';
import KanbanView from './components/KanbanView';
import GanttView from './components/GanttView';
import TrashView from './components/TrashView';
import NoteDetailDrawer from './components/NoteDetailDrawer';
import AuthModal from './components/AuthModal';
import MembersModal from './components/MembersModal';
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
  getWorkspaceMembers
} from './services/storageService';
import { CheckCircle, Loader2 } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [isFetchingData, setIsFetchingData] = useState(false);

  // Setup Supabase Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        setIsAuthModalOpen(true);
      }
      setIsInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setIsAuthModalOpen(false);
      } else {
        // Clear data when logged out
        setWorkspaces([]);
        setNotes([]);
        setTrashNotes([]);
        setIsAuthModalOpen(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch data when session changes
  useEffect(() => {
    if (session) {
      refreshAppData();
    }
  }, [session]);

  // Toast notification listener
  useEffect(() => {
    const handleToast = (e) => {
      setToastMessage(e.detail.message);
      setTimeout(() => setToastMessage(null), 2500);
    };
    window.addEventListener('app_toast_notify', handleToast);
    return () => window.removeEventListener('app_toast_notify', handleToast);
  }, []);

  const refreshAppData = async () => {
    setIsFetchingData(true);
    
    // Create default workspace if none exists for new user
    let wsData = await fetchWorkspaces();
    if (wsData.length === 0) {
      const defaultWs = { title: 'Ana Çalışma Alanı', color: '#191919' };
      const newWs = await saveWorkspace(defaultWs);
      if (newWs) {
        wsData = [newWs];
      }
    }
    
    setWorkspaces(wsData);
    if (wsData.length > 0 && !activeWorkspaceId) {
      setActiveWorkspaceId(wsData[0].id);
    }
    
    const notesData = await fetchNotes();
    
    // Normalize legacy statuses
    const normalizedNotes = notesData.map(n => {
      let st = n.status;
      if (st === 'To Do') st = 'Yapılacaklar';
      else if (st === 'In Progress') st = 'Devam Ediyor';
      else if (st === 'In Review') st = 'İnceleniyor';
      else if (st === 'Done') st = 'Tamamlandı';
      return { ...n, status: st };
    });
    setNotes(normalizedNotes);
    
    
    const trashData = await fetchTrashNotes();
    setTrashNotes(trashData);
    
    setIsFetchingData(false);
  };

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

  const handleUpdateStatus = async (noteId, newStatus) => {
    const noteToUpdate = notes.find(n => n.id === noteId);
    if (!noteToUpdate) return;
    
    let updatedNote = { ...noteToUpdate, status: newStatus };

    // Otomatik tarih atama mantığı
    if (newStatus === 'Devam Ediyor' && !updatedNote.startDate) {
      updatedNote.startDate = new Date().toISOString();
    }
    if (newStatus === 'Tamamlandı') {
      updatedNote.endDate = new Date().toISOString();
    }

    const result = await saveNote(updatedNote);
    
    if (result) {
       setNotes(notes.map(n => n.id === noteId ? { ...updatedNote, updatedAt: result.updated_at } : n));
       if (selectedNote && selectedNote.id === noteId) {
         setSelectedNote({ ...updatedNote, updatedAt: result.updated_at });
       }
    }
  };

  const handleUpdateDates = async (noteId, newStartDate, newEndDate) => {
    const noteToUpdate = notes.find(n => n.id === noteId);
    if (!noteToUpdate) return;
    
    const updatedNote = { ...noteToUpdate, startDate: newStartDate, endDate: newEndDate };
    const result = await saveNote(updatedNote);
    
    if (result) {
       setNotes(notes.map(n => n.id === noteId ? { ...updatedNote, updatedAt: result.updated_at } : n));
       if (selectedNote && selectedNote.id === noteId) {
         setSelectedNote({ ...updatedNote, updatedAt: result.updated_at });
       }
    }
  };

  const handleUpdateTitle = async (noteId, newTitle) => {
    const noteToUpdate = notes.find(n => n.id === noteId);
    if (!noteToUpdate) return;
    
    const updatedNote = { ...noteToUpdate, title: newTitle };
    const result = await saveNote(updatedNote);
    
    if (result) {
       setNotes(notes.map(n => n.id === noteId ? { ...n, title: newTitle, updatedAt: result.updated_at } : n));
       if (selectedNote && selectedNote.id === noteId) {
         setSelectedNote({ ...selectedNote, title: newTitle, updatedAt: result.updated_at });
       }
    }
  };

  const handleSaveNote = async (updatedNote) => {
    const result = await saveNote(updatedNote);
    if (result) {
      const dbSavedNote = { ...updatedNote, id: result.id, updatedAt: result.updated_at };
      setNotes(notes.map(n => (n.id === updatedNote.id || n.id === result.id) ? dbSavedNote : n));
      setSelectedNote(dbSavedNote);
    }
  };

  const handleMoveToTrash = async (noteId) => {
    const success = await moveNoteToTrash(noteId);
    if (success) {
      refreshAppData();
      setSelectedNote(null);
    }
  };

  const handleRestoreFromTrash = async (noteId) => {
    const success = await restoreNoteFromTrash(noteId);
    if (success) refreshAppData();
  };

  const handlePermanentlyDelete = async (noteId) => {
    const success = await permanentlyDeleteNote(noteId);
    if (success) refreshAppData();
  };

  const handleEmptyTrash = async () => {
    if (window.confirm('Geri Dönüşüm Kutusu\'ndaki tüm notlar kalıcı olarak silinecek. Emin misiniz?')) {
      const success = await emptyTrashBin();
      if (success) refreshAppData();
    }
  };

  const handleNewNote = async () => {
    const defaultMember = projectMembers[0]?.name || 'Siz (Hesabınız)';
    const workspaceNotes = notes.filter(n => n.workspaceId === activeWorkspaceId);
    const maxOrder = workspaceNotes.length > 0 ? Math.max(...workspaceNotes.map(n => n.order || 0)) : -1;

    const newNote = {
      id: `note-${Date.now()}`, // Temporary ID until saved to DB
      workspaceId: activeWorkspaceId,
      title: 'Yeni Not / Görev Başlığı',
      status: 'Yapılacaklar',
      priority: 'Medium',
      assignee: defaultMember,
      category: 'Genel',
      order: maxOrder + 1,
      updatedAt: new Date().toISOString(),
      content: '### Not Detayları\n- [ ] Yapılacak görevi yazın'
    };

    // Save immediately to get real UUID
    const result = await saveNote(newNote);
    if (result) {
      const realNote = { ...newNote, id: result.id, updatedAt: result.updated_at, createdAt: result.created_at };
      setNotes([...notes, realNote]);
      setSelectedNote(realNote);
    }
  };

  const handleUpdateWorkspace = async (wsId, newName, newIcon) => {
    const wsToUpdate = workspaces.find(w => w.id === wsId);
    if (!wsToUpdate) return;
    
    const updatedWs = { ...wsToUpdate, title: newName, icon: newIcon };
    const result = await saveWorkspace(updatedWs);
    if (result) {
      setWorkspaces(workspaces.map(w => w.id === wsId ? { ...w, title: result.title, icon: result.icon } : w));
    }
  };

  const handleAddWorkspace = async (name, icon) => {
    const newWs = { title: name, color: '#191919', icon };
    const result = await saveWorkspace(newWs);
    if (result) {
      setWorkspaces([...workspaces, result]);
      setActiveWorkspaceId(result.id);
    }
  };

  const handleDeleteWorkspace = async (wsId) => {
    if (workspaces.length <= 1) {
      alert('En az bir çalışma alanınız bulunmalıdır. Son çalışma alanını silemezsiniz.');
      return;
    }

    const success = await deleteWorkspace(wsId);
    if (success) {
      const updatedWs = workspaces.filter(w => w.id !== wsId);
      setWorkspaces(updatedWs);
      if (activeWorkspaceId === wsId) {
        setActiveWorkspaceId(updatedWs[0]?.id || null);
      }
      refreshAppData();
    }
  };

  const handleReorderWorkspaces = async (reorderedWorkspaces) => {
    setWorkspaces(reorderedWorkspaces); // Update UI immediately
    const updates = reorderedWorkspaces.map((ws, index) => ({ id: ws.id, order: index }));
    await updateWorkspaceOrders(updates);
  };

  const handleReorderNotes = async (reorderedNotes) => {
    // 1. We need to merge reorderedNotes with notes from other workspaces
    // because reorderedNotes only contains the displayedNotes!
    const reorderedIds = new Set(reorderedNotes.map(n => n.id));
    const otherNotes = notes.filter(n => !reorderedIds.has(n.id));
    
    // UI update
    setNotes([...otherNotes, ...reorderedNotes]);

    // DB update
    const updates = reorderedNotes.map((n, index) => ({ id: n.id, order: index }));
    await updateNoteOrders(updates);
  };

  // No longer a mock, we use the real MembersModal!
  const handleAddMember = (memberName) => {
    // This is passed to NoteDetailDrawer if they type a custom name.
    // We should probably just tell them to use the Members UI now.
    alert("Üye eklemek için lütfen Çalışma Alanı ayarlarından 'Üyeleri Yönet' ekranını kullanın.");
  };

  if (isInitializing) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', color: '#fff' }}>
        <Loader2 size={32} className="spin-loader" />
      </div>
    );
  }

  return (
    <div className="app-container">
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
      />

      <main className="main-content" style={{ position: 'relative' }}>
        {isFetchingData && (
          <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 100, background: 'rgba(0,0,0,0.5)', padding: '8px', borderRadius: '50%' }}>
            <Loader2 size={20} className="spin-loader" style={{ color: '#a78bfa' }} />
          </div>
        )}

        {(!session) ? (
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
              />
            )}

            {activeView === 'by-status' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="notion-topbar">
                  <div className="notion-views-tab">
                    <button className="view-tab-btn active" onClick={() => setActiveView('by-status')}>
                      <span>➔ Duruma Göre</span>
                    </button>
                    <button className="view-tab-btn" onClick={() => setActiveView('all-projects')}>
                      <span>★ Tüm Projeler</span>
                    </button>
                    <button className="view-tab-btn" onClick={() => setActiveView('gantt')}>
                      <span>📊 Gantt</span>
                    </button>
                  </div>
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
                  <div className="notion-views-tab">
                    <button className="view-tab-btn" onClick={() => setActiveView('by-status')}>
                      <span>➔ Duruma Göre</span>
                    </button>
                    <button className="view-tab-btn" onClick={() => setActiveView('all-projects')}>
                      <span>★ Tüm Projeler</span>
                    </button>
                    <button className="view-tab-btn active" onClick={() => setActiveView('gantt')}>
                      <span>📊 Gantt</span>
                    </button>
                  </div>
                </div>
                <GanttView 
                  notes={displayedNotes}
                  onSelectNote={setSelectedNote}
                  onUpdateDates={handleUpdateDates}
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
        projectMembers={projectMembers}
        onAddMember={handleAddMember}
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
    </div>
  );
}
