import React, { useState } from 'react';
import { 
  Star, 
  Plus, 
  SlidersHorizontal, 
  ArrowUpDown, 
  Sun,
  FileText,
  Search,
  Calendar,
  GripVertical
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const STATUS_OPTIONS = [
  { id: 'Yapılacaklar', label: 'Yapılacaklar', colorClass: 'status-To-Do' },
  { id: 'Devam Ediyor', label: 'Devam Ediyor', colorClass: 'status-In-Progress' },
  { id: 'İnceleniyor', label: 'İnceleniyor', colorClass: 'status-In-Review' },
  { id: 'Tamamlandı', label: 'Tamamlandı', colorClass: 'status-Done' }
];

export default function TableView({ 
  notes, 
  activeView, 
  setActiveView, 
  onSelectNote, 
  onUpdateStatus, 
  onUpdateTitle,
  onUpdateDates,
  onNewNote,
  onReorderNotes 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [tempTitle, setTempTitle] = useState('');
  const [sortField, setSortField] = useState('order'); // Changed default to 'order'
  const [sortDirection, setSortDirection] = useState('asc');

  // Column widths state (in pixels)
  const [colWidths, setColWidths] = useState(() => {
    const saved = localStorage.getItem('mynotes_col_widths');
    return saved ? JSON.parse(saved) : { title: 380, status: 160, category: 140, assignee: 140, createdAt: 150, endDate: 150 };
  });

  const [resizingCol, setResizingCol] = useState(null);

  // Resize handlers
  const handleResizeStart = (e, colId) => {
    e.stopPropagation();
    setResizingCol({
      id: colId,
      startX: e.clientX,
      startWidth: colWidths[colId]
    });
  };

  React.useEffect(() => {
    if (!resizingCol) return;

    const handleMouseMove = (e) => {
      const delta = e.clientX - resizingCol.startX;
      const newWidth = Math.max(50, resizingCol.startWidth + delta);
      setColWidths(prev => {
        const updated = { ...prev, [resizingCol.id]: newWidth };
        localStorage.setItem('mynotes_col_widths', JSON.stringify(updated));
        return updated;
      });
    };

    const handleMouseUp = () => setResizingCol(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol]);

  // Auto-fit on double click
  const tableRef = React.useRef(null);
  
  const handleAutoFit = (e, colId, colIndex) => {
    e.stopPropagation();
    if (!tableRef.current) return;
    
    // Find all cells in this column (th + tds)
    const rows = tableRef.current.querySelectorAll('tr');
    let maxWidth = 80; // minimum width
    
    // Create a temporary invisible span to measure text width accurately
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = '14px Inter, sans-serif'; // approximate font

    rows.forEach(row => {
      const cell = row.children[colIndex];
      if (cell && cell.textContent) {
        // Measure text width + some padding
        const textWidth = context.measureText(cell.textContent.trim()).width;
        // Add padding (approx 40px for icons and padding)
        maxWidth = Math.max(maxWidth, textWidth + 45); 
      }
    });

    setColWidths(prev => {
      const updated = { ...prev, [colId]: maxWidth };
      localStorage.setItem('mynotes_col_widths', JSON.stringify(updated));
      return updated;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (active && over && active.id !== over.id) {
      const oldIndex = filteredNotes.findIndex((n) => n.id === active.id);
      const newIndex = filteredNotes.findIndex((n) => n.id === over.id);
      
      const reordered = arrayMove(filteredNotes, oldIndex, newIndex);
      if (onReorderNotes) {
        onReorderNotes(reordered);
      }
    }
  };

  // Filter notes
  let filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (n.category && n.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (n.assignee && n.assignee.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Sort notes
  filteredNotes.sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (sortField === 'order') {
      const numA = typeof valA === 'number' ? valA : 0;
      const numB = typeof valB === 'number' ? valB : 0;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    }

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSortToggle = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const startEditingTitle = (note) => {
    setEditingTitleId(note.id);
    setTempTitle(note.title);
  };

  const saveInlineTitle = (noteId) => {
    if (tempTitle.trim() && onUpdateTitle) {
      onUpdateTitle(noteId, tempTitle.trim());
    }
    setEditingTitleId(null);
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Tabs Bar */}
      <div className="notion-topbar">
        <div className="notion-views-tab">
          <button 
            className={`view-tab-btn ${activeView === 'by-status' ? 'active' : ''}`}
            onClick={() => setActiveView('by-status')}
          >
            <span>➔ Duruma Göre</span>
          </button>

          <button 
            className={`view-tab-btn ${activeView === 'all-projects' ? 'active' : ''}`}
            onClick={() => setActiveView('all-projects')}
          >
            <Star size={14} style={{ fill: '#eab308', color: '#eab308' }} />
            <span>Tüm Projeler</span>
          </button>

          <button 
            className={`view-tab-btn ${activeView === 'gantt' ? 'active' : ''}`}
            onClick={() => setActiveView('gantt')}
          >
            <span>📊 Gantt</span>
          </button>

          <button className="icon-btn" onClick={onNewNote} title="Yeni Görünüm / Not Ekle">
            <Plus size={16} />
          </button>
        </div>

        {/* Right Tools */}
        <div className="topbar-actions">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              placeholder="Filtrele..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-main)',
                borderRadius: '6px',
                padding: '4px 10px 4px 28px',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                outline: 'none',
                width: '150px'
              }}
            />
          </div>
          <button className="icon-btn" onClick={() => handleSortToggle('title')} title="İsme Göre Sırala">
            <ArrowUpDown size={16} />
          </button>
          <button 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#2eaadc',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
            onClick={onNewNote}
          >
            <Plus size={14} /> Yeni Not Ekle
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="table-view-container">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <table className="notion-table" ref={tableRef} style={{ tableLayout: 'fixed', width: 'max-content' }}>
          <thead>
            <tr>
              <th style={{ width: colWidths.title, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', height: '100%' }} onClick={() => handleSortToggle('title')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Aa</span>
                    Proje Adı {sortField === 'title' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                  </span>
                </div>
                <div 
                  className="col-resizer" 
                  onMouseDown={(e) => handleResizeStart(e, 'title')}
                  onDoubleClick={(e) => handleAutoFit(e, 'title', 0)}
                />
              </th>
              
              <th style={{ width: colWidths.status, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', height: '100%' }} onClick={() => handleSortToggle('status')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Sun size={13} style={{ color: 'var(--text-muted)' }} />
                    Durum {sortField === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                  </span>
                </div>
                <div 
                  className="col-resizer" 
                  onMouseDown={(e) => handleResizeStart(e, 'status')}
                  onDoubleClick={(e) => handleAutoFit(e, 'status', 1)}
                />
              </th>
              
              <th style={{ width: colWidths.category, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>Kategori</div>
                <div 
                  className="col-resizer" 
                  onMouseDown={(e) => handleResizeStart(e, 'category')}
                  onDoubleClick={(e) => handleAutoFit(e, 'category', 2)}
                />
              </th>
              
              <th style={{ width: colWidths.assignee, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>Sorumlu</div>
                <div 
                  className="col-resizer" 
                  onMouseDown={(e) => handleResizeStart(e, 'assignee')}
                  onDoubleClick={(e) => handleAutoFit(e, 'assignee', 3)}
                />
              </th>
              
              <th style={{ width: colWidths.createdAt, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', height: '100%' }} onClick={() => handleSortToggle('createdAt')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                    Oluşturma Tarihi {sortField === 'createdAt' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                  </span>
                </div>
                <div 
                  className="col-resizer" 
                  onMouseDown={(e) => handleResizeStart(e, 'createdAt')}
                  onDoubleClick={(e) => handleAutoFit(e, 'createdAt', 4)}
                />
              </th>
              
              <th style={{ width: colWidths.endDate, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', height: '100%' }} onClick={() => handleSortToggle('endDate')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                    Bitiş Tarihi {sortField === 'endDate' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                  </span>
                </div>
                <div 
                  className="col-resizer" 
                  onMouseDown={(e) => handleResizeStart(e, 'endDate')}
                  onDoubleClick={(e) => handleAutoFit(e, 'endDate', 5)}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            <SortableContext items={filteredNotes.map(n => n.id)} strategy={verticalListSortingStrategy}>
            {filteredNotes.map((note) => {
              return (
                <SortableNoteRow 
                  key={note.id}
                  note={note}
                  isEditingThisTitle={editingTitleId === note.id}
                  tempTitle={tempTitle}
                  setTempTitle={setTempTitle}
                  saveInlineTitle={saveInlineTitle}
                  onSelectNote={onSelectNote}
                  startEditingTitle={startEditingTitle}
                  editingStatusId={editingStatusId}
                  setEditingStatusId={setEditingStatusId}
                  STATUS_OPTIONS={STATUS_OPTIONS}
                  onUpdateStatus={onUpdateStatus}
                  onUpdateDates={onUpdateDates}
                  formatDate={formatDate}
                />
              );
            })}
            </SortableContext>

            {filteredNotes.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  Henüz not bulunmuyor veya arama kriterine uyan not yok.
                </td>
              </tr>
            )}

            {/* Quick Add Row */}
            <tr>
              <td colSpan={6} onClick={onNewNote} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                  <Plus size={16} />
                  <span>Yeni Not Ekle...</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        </DndContext>
      </div>
    </div>
  );
}

function SortableNoteRow({
  note,
  isEditingThisTitle,
  tempTitle,
  setTempTitle,
  saveInlineTitle,
  onSelectNote,
  startEditingTitle,
  editingStatusId,
  setEditingStatusId,
  STATUS_OPTIONS,
  onUpdateStatus,
  onUpdateDates,
  formatDate
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1 : 0
  };

  return (
    <tr ref={setNodeRef} style={style}>
      {/* Title Column */}
      <td>
        <div className="project-title-cell" style={{ display: 'flex', alignItems: 'center' }}>
          {/* DRAG HANDLE */}
          <div 
            {...attributes} 
            {...listeners} 
            style={{ cursor: 'grab', padding: '4px 2px', marginRight: '6px', color: 'var(--text-muted)', flexShrink: 0 }}
          >
            <GripVertical size={14} />
          </div>

          <FileText size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          
          {isEditingThisTitle ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
              <input 
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveInlineTitle(note.id)}
                onBlur={() => saveInlineTitle(note.id)}
                autoFocus
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid var(--accent-blue)',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  color: 'var(--text-main)',
                  fontSize: '0.88rem',
                  width: '100%',
                  outline: 'none'
                }}
              />
            </div>
          ) : (
            <span 
              onClick={() => onSelectNote(note)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                startEditingTitle(note);
              }}
              style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              title="Tıklayın açın veya çift tıklayarak düzenleyin"
            >
              {note.title}
            </span>
          )}

          <span className="open-drawer-hint" onClick={() => onSelectNote(note)}>
            Aç ➔
          </span>
        </div>
      </td>

      {/* Status Column */}
      <td style={{ position: 'relative' }}>
        <div 
          className={`status-pill ${STATUS_OPTIONS.find(opt => opt.id === note.status)?.colorClass || 'status-To-Do'}`}
          onClick={(e) => {
            e.stopPropagation();
            setEditingStatusId(editingStatusId === note.id ? null : note.id);
          }}
        >
          <span className="status-pill-dot" />
          <span>{STATUS_OPTIONS.find(opt => opt.id === note.status)?.label || note.status}</span>
        </div>

        {/* Status Dropdown */}
        {editingStatusId === note.id && (
          <div 
            style={{
              position: 'absolute',
              top: '100%',
              left: '10px',
              zIndex: 50,
              background: '#252525',
              border: '1px solid var(--border-main)',
              borderRadius: '8px',
              padding: '6px',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              width: '140px'
            }}
          >
            {STATUS_OPTIONS.map(opt => (
              <div 
                key={opt.id}
                className={`status-pill ${opt.colorClass}`}
                style={{ justifyContent: 'flex-start', width: '100%', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateStatus(note.id, opt.id);
                  setEditingStatusId(null);
                }}
              >
                <span className="status-pill-dot" />
                <span>{opt.label}</span>
              </div>
            ))}
          </div>
        )}
      </td>

      {/* Category Column */}
      <td>
        <span style={{ 
          fontSize: '0.78rem', 
          background: 'rgba(255, 255, 255, 0.05)', 
          padding: '3px 8px', 
          borderRadius: '4px',
          color: 'var(--text-secondary)',
          display: 'inline-block',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          verticalAlign: 'bottom'
        }}>
          {note.category || 'Genel'}
        </span>
      </td>

      {/* Assignee Column */}
      <td>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
          {note.assignee || 'Atanmadı'}
        </div>
      </td>

      {/* Creation Date Column */}
      <td>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {formatDate(note.createdAt)}
        </span>
      </td>

      {/* End Date Column */}
      <td>
        <input 
          type="date" 
          value={note.endDate ? note.endDate.split('T')[0] : ''}
          onChange={(e) => {
            const newDate = e.target.value ? new Date(e.target.value).toISOString() : null;
            if (onUpdateDates) {
               onUpdateDates(note.id, note.startDate || note.createdAt, newDate);
            }
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-main)',
            borderRadius: '4px',
            color: 'var(--text-main)',
            padding: '2px 4px',
            fontSize: '0.8rem',
            outline: 'none',
            colorScheme: 'dark',
            width: '100%'
          }}
        />
      </td>
    </tr>
  );
}
