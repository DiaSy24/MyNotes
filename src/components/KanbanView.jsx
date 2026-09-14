import React from 'react';
import { Plus, MoreHorizontal, FileText, CheckCircle2 } from 'lucide-react';
import NoteHoverPreview from './NoteHoverPreview';

const COLUMNS = [
  { id: 'Yapılacaklar', label: 'Yapılacaklar', color: '#9ca3af' },
  { id: 'Devam Ediyor', label: 'Devam Ediyor', color: '#60a5fa' },
  { id: 'İnceleniyor', label: 'İnceleniyor', color: '#fbbf24' },
  { id: 'Tamamlandı', label: 'Tamamlandı', color: '#4ade80' }
];

export default function KanbanView({ notes, onSelectNote, onUpdateStatus, onNewNote }) {
  return (
    <div className="kanban-container">
      {COLUMNS.map(col => {
        const colNotes = notes.filter(n => n.status === col.id);

        return (
          <div key={col.id} className="kanban-column">
            <div className="kanban-column-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.88rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color }} />
                <span>{col.label}</span>
                <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.1)', padding: '1px 6px', borderRadius: '10px', color: 'var(--text-muted)' }}>
                  {colNotes.length}
                </span>
              </div>
              <button className="icon-btn" onClick={onNewNote}><Plus size={14} /></button>
            </div>

            <div className="kanban-cards">
              {colNotes.map(note => (
                <NoteHoverPreview key={note.id} note={note}>
                  <div className="kanban-card" onClick={() => onSelectNote(note)}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                      <FileText size={15} style={{ color: 'var(--text-muted)', marginTop: '2px' }} />
                      <div style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.3' }}>
                        {note.title}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '12px', fontSize: '0.78rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {note.assignee || 'Atanmadı'}
                      </span>
                    </div>
                  </div>
                </NoteHoverPreview>
              ))}

              {colNotes.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', border: '1px dashed var(--border-main)', borderRadius: '6px' }}>
                  Bu sütunda not bulunmuyor
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
