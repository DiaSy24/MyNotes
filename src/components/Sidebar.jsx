import React, { useState, useEffect } from 'react';
import { 
  FolderKanban, 
  CheckCircle2, 
  Plus, 
  Cloud, 
  CloudOff,
  ChevronDown,
  Sparkles,
  Edit2,
  Check,
  X,
  Trash2,
  Lock,
  LogOut,
  Clock,
  ListTodo,
  GripVertical,
  Users
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const EMOJI_PALETTE = ['📝', '🚀', '👥', '📂', '💼', '📌', '💡', '🏷️', '⚡', '🎯', '🎨', '🔥', '📚', '⭐', '🛠️', '✨'];

export default function Sidebar({ 
  workspaces, 
  activeWorkspaceId, 
  setActiveWorkspaceId, 
  activeCategory, 
  setActiveCategory,
  trashCount,
  session,
  onOpenAuthModal,
  onNewNote,
  onUpdateWorkspace,
  onAddWorkspace,
  onDeleteWorkspace,
  onReorderWorkspaces,
  onManageMembers
}) {
  const [editingWsId, setEditingWsId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isAddingNewWs, setIsAddingNewWs] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts to allow clicking
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      const oldIndex = workspaces.findIndex((w) => w.id === active.id);
      const newIndex = workspaces.findIndex((w) => w.id === over.id);
      
      const reordered = arrayMove(workspaces, oldIndex, newIndex);
      if (onReorderWorkspaces) {
        onReorderWorkspaces(reordered);
      }
    }
  };

  // Resizable Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('mynotes_sidebar_width');
    return saved ? parseInt(saved, 10) : 260;
  });
  const [isDragging, setIsDragging] = useState(false);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

  // Resizer Drag Listener
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const newWidth = Math.min(450, Math.max(180, e.clientX));
      setSidebarWidth(newWidth);
      localStorage.setItem('mynotes_sidebar_width', newWidth.toString());
    };

    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const startEditingWs = (e, ws) => {
    e.stopPropagation();
    if (ws.isFixed) {
      alert('Ortak Çalışma Alanı sabittir, ismi veya simgesi değiştirilemez!');
      return;
    }
    setEditingWsId(ws.id);
    setEditName(ws.name);
    setEditIcon(ws.icon || '📝');
    setShowEmojiPicker(false);
  };

  const saveWorkspaceEdit = (wsId) => {
    if (editName.trim() && onUpdateWorkspace) {
      onUpdateWorkspace(wsId, editName.trim(), editIcon);
    }
    setEditingWsId(null);
  };

  const handleCreateNewWs = () => {
    if (editName.trim() && onAddWorkspace) {
      onAddWorkspace(editName.trim(), editIcon || '📂');
      setIsAddingNewWs(false);
      setEditName('');
    }
  };

  const handleDeleteWs = (wsId) => {
    if (window.confirm('Bu çalışma alanını silmek istediğinize emin misiniz?')) {
      onDeleteWorkspace(wsId);
      setEditingWsId(null);
    }
  };

  return (
    <aside className="sidebar" style={{ width: `${sidebarWidth}px` }}>
      {/* Drag Resizer Splitter Handle */}
      <div 
        className={`sidebar-resizer ${isDragging ? 'is-dragging' : ''}`} 
        onMouseDown={() => setIsDragging(true)}
        title="Sürükleyerek sol menü genişliğini ayarlayın"
      />

      {/* Workspace Selector Header */}
      <div className="sidebar-header">
        <div className="workspace-badge" onClick={onOpenAuthModal} style={{ width: '100%' }}>
          <span>{activeWorkspace?.icon || '🚀'}</span>
          <div className="sidebar-item-name" style={{ flex: 1 }}>
            <span className="sidebar-item-name-text">{activeWorkspace?.name}</span>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </div>
      </div>

      {/* Workspaces Section */}
      <div className="sidebar-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '4px' }}>
          <div className="sidebar-section-title">Çalışma Alanları</div>
          <button 
            className="icon-btn" 
            title="Yeni Çalışma Alanı Ekle"
            onClick={() => {
              setIsAddingNewWs(true);
              setEditName('');
              setEditIcon('📂');
            }}
          >
            <Plus size={14} />
          </button>
        </div>

        {/* New Workspace Creation Box - Compact & strictly bounded */}
        {isAddingNewWs && (
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.05)', 
            padding: '8px', 
            borderRadius: '6px', 
            marginBottom: '8px', 
            border: '1px solid var(--accent-blue)',
            width: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', width: '100%' }}>
              <span 
                style={{ fontSize: '1.1rem', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.1)', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                {editIcon}
              </span>
              <input 
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Çalışma Alanı Adı..."
                autoFocus
                style={{
                  minWidth: 0,
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>

            {showEmojiPicker && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', padding: '4px', background: '#202020', borderRadius: '6px', marginBottom: '6px', maxHeight: '90px', overflowY: 'auto' }}>
                {EMOJI_PALETTE.map(emoji => (
                  <span 
                    key={emoji} 
                    onClick={() => { setEditIcon(emoji); setShowEmojiPicker(false); }}
                    style={{ cursor: 'pointer', fontSize: '0.95rem', padding: '2px 4px' }}
                  >
                    {emoji}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
              <button className="icon-btn" onClick={() => setIsAddingNewWs(false)}><X size={14} /></button>
              <button 
                style={{ background: '#2eaadc', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                onClick={handleCreateNewWs}
              >
                Ekle
              </button>
            </div>
          </div>
        )}

        {/* Workspaces List with Drag and Drop */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={workspaces.map(w => w.id)} strategy={verticalListSortingStrategy}>
            {workspaces.map(ws => (
              <SortableWorkspaceItem 
                key={ws.id}
                ws={ws}
                isEditing={editingWsId === ws.id}
                isActive={ws.id === activeWorkspaceId && activeCategory !== 'trash'}
                activeCategory={activeCategory}
                setActiveWorkspaceId={setActiveWorkspaceId}
                setActiveCategory={setActiveCategory}
                startEditingWs={startEditingWs}
                saveWorkspaceEdit={saveWorkspaceEdit}
                handleDeleteWs={handleDeleteWs}
                editName={editName}
                setEditName={setEditName}
                editIcon={editIcon}
                setEditIcon={setEditIcon}
                showEmojiPicker={showEmojiPicker}
                setShowEmojiPicker={setShowEmojiPicker}
                EMOJI_PALETTE={EMOJI_PALETTE}
                onManageMembers={onManageMembers}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Görünümler & Süzgeçler */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Görünümler & Süzgeçler</div>
        
        <div 
          className={`sidebar-item ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          <FolderKanban size={16} style={{ flexShrink: 0 }} />
          <div className="sidebar-item-name">
            <span className="sidebar-item-name-text">Tüm Projeler & Notlar</span>
          </div>
        </div>

        <div 
          className={`sidebar-item ${activeCategory === 'To Do' ? 'active' : ''}`}
          onClick={() => setActiveCategory('To Do')}
        >
          <ListTodo size={16} style={{ color: 'var(--status-todo-dot)', flexShrink: 0 }} />
          <div className="sidebar-item-name">
            <span className="sidebar-item-name-text">Yapılacaklar (To Do)</span>
          </div>
        </div>

        <div 
          className={`sidebar-item ${activeCategory === 'In Progress' ? 'active' : ''}`}
          onClick={() => setActiveCategory('In Progress')}
        >
          <Sparkles size={16} style={{ color: 'var(--status-progress-dot)', flexShrink: 0 }} />
          <div className="sidebar-item-name">
            <span className="sidebar-item-name-text">Devam Edenler (In Progress)</span>
          </div>
        </div>

        <div 
          className={`sidebar-item ${activeCategory === 'In Review' ? 'active' : ''}`}
          onClick={() => setActiveCategory('In Review')}
        >
          <Clock size={16} style={{ color: 'var(--status-review-dot)', flexShrink: 0 }} />
          <div className="sidebar-item-name">
            <span className="sidebar-item-name-text">İncelemedekiler (In Review)</span>
          </div>
        </div>

        <div 
          className={`sidebar-item ${activeCategory === 'Done' ? 'active' : ''}`}
          onClick={() => setActiveCategory('Done')}
        >
          <CheckCircle2 size={16} style={{ color: 'var(--status-done-dot)', flexShrink: 0 }} />
          <div className="sidebar-item-name">
            <span className="sidebar-item-name-text">Tamamlananlar (Done)</span>
          </div>
        </div>

        {/* Trash Bin Section */}
        <div 
          className={`sidebar-item ${activeCategory === 'trash' ? 'active' : ''}`}
          onClick={() => setActiveCategory('trash')}
          style={{ color: activeCategory === 'trash' ? '#f87171' : 'var(--text-secondary)' }}
        >
          <Trash2 size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
          <div className="sidebar-item-name">
            <span className="sidebar-item-name-text">Geri Dönüşüm Kutusu</span>
          </div>
          {trashCount > 0 && (
            <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '1px 6px', borderRadius: '10px', fontWeight: 600, flexShrink: 0 }}>
              {trashCount}
            </span>
          )}
        </div>
      </div>

      {/* Footer Account & Sync */}
      <div className="sidebar-footer">
        <div className="sync-status-card" style={{ cursor: 'pointer' }} onClick={onOpenAuthModal}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
            {session ? (
              <Cloud size={16} style={{ color: '#8b5cf6', flexShrink: 0 }} />
            ) : (
              <CloudOff size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            )}
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {session ? 'Supabase Bulut Aktif' : 'Bulut Bağlı Değil'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {session 
                  ? (session.user.email.replace('@mynotes.app', '') || 'Aktif')
                  : 'Giriş Yap'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// Child component for Sortable Item
function SortableWorkspaceItem({ 
  ws, 
  isActive, 
  isEditing,
  activeCategory,
  setActiveWorkspaceId,
  setActiveCategory,
  startEditingWs,
  saveWorkspaceEdit,
  handleDeleteWs,
  editName,
  setEditName,
  editIcon,
  setEditIcon,
  showEmojiPicker,
  setShowEmojiPicker,
  EMOJI_PALETTE,
  onManageMembers
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: ws.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    zIndex: isDragging ? 1 : 0
  };

  return (
    <div ref={setNodeRef} style={style}>
      {isEditing ? (
        /* Inline Workspace Edit Box */
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.05)', 
          padding: '6px', 
          borderRadius: '6px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '6px', 
          border: '1px solid var(--accent-blue)',
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', minWidth: 0 }}>
            <span 
              style={{ fontSize: '1rem', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.1)', padding: '2px 4px', borderRadius: '4px', flexShrink: 0 }}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Emoji Değiştir"
            >
              {editIcon}
            </span>
            <input 
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveWorkspaceEdit(ws.id)}
              autoFocus
              style={{
                minWidth: 0,
                flex: 1,
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border-main)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                outline: 'none',
                padding: '2px'
              }}
            />
            <button className="icon-btn" onClick={() => saveWorkspaceEdit(ws.id)} style={{ padding: '2px', flexShrink: 0 }}>
              <Check size={14} style={{ color: '#4ade80' }} />
            </button>

            <button 
              className="icon-btn" 
              title="Üyeleri Yönet"
              onClick={() => onManageMembers(ws.id, ws.name)}
              style={{ color: '#38bdf8', padding: '2px', flexShrink: 0 }}
            >
              <Users size={14} />
            </button>

            {!ws.isFixed && (
              <button 
                className="icon-btn" 
                title="Kategoriyi Sil"
                onClick={() => handleDeleteWs(ws.id)}
                style={{ color: '#ef4444', padding: '2px', flexShrink: 0 }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {showEmojiPicker && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', padding: '4px', background: '#202020', borderRadius: '6px', maxHeight: '80px', overflowY: 'auto' }}>
              {EMOJI_PALETTE.map(emoji => (
                <span 
                  key={emoji} 
                  onClick={() => { setEditIcon(emoji); setShowEmojiPicker(false); }}
                  style={{ cursor: 'pointer', fontSize: '0.95rem', padding: '2px 4px' }}
                >
                  {emoji}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div 
          className={`sidebar-item ${isActive ? 'active' : ''}`}
          onClick={() => {
            setActiveWorkspaceId(ws.id);
            if (activeCategory === 'trash') setActiveCategory('all');
          }}
          style={{ width: '100%', overflow: 'hidden', paddingLeft: '4px' }}
        >
          {/* DRAG HANDLE */}
          <div 
            {...attributes} 
            {...listeners} 
            style={{ cursor: 'grab', padding: '4px 2px', marginRight: '4px', color: 'var(--text-muted)', flexShrink: 0 }}
          >
            <GripVertical size={14} />
          </div>

          <span style={{ fontSize: '1rem', flexShrink: 0 }}>{ws.icon || '📝'}</span>
          
          <div className="sidebar-item-name" title={ws.name}>
            <span className="sidebar-item-name-text">{ws.name}</span>
          </div>
          
          {ws.isFixed ? (
            <Lock size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} title="Ortak Çalışma Alanı Sabittir" />
          ) : (
            <button 
              className="icon-btn" 
              title="İsmi, Emojiyi Düzenle veya Sil"
              onClick={(e) => startEditingWs(e, ws)}
              style={{ opacity: 0.6, flexShrink: 0 }}
            >
              <Edit2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
