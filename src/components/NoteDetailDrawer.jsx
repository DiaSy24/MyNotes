import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  Share2, 
  Heading, 
  Code, 
  Quote, 
  ListChecks, 
  Save,
  Check,
  UserPlus,
  Calendar
} from 'lucide-react';

const STATUS_OPTIONS = ['Yapılacaklar', 'Devam Ediyor', 'İnceleniyor', 'Tamamlandı'];

export default function NoteDetailDrawer({ 
  note, 
  onClose, 
  onSave, 
  onDelete, 
  projectMembers,
  onAddMember 
}) {
  if (!note) return null;

  const [title, setTitle] = useState(note.title);
  const [status, setStatus] = useState(note.status);
  const [category, setCategory] = useState(note.category || '');
  const [assignee, setAssignee] = useState(note.assignee || (projectMembers[0]?.name || 'Siz (Hesabınız)'));
  const [content, setContent] = useState(note.content || '');
  const [startDate, setStartDate] = useState(note.startDate || '');
  const [endDate, setEndDate] = useState(note.endDate || '');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setTitle(note.title);
    setStatus(note.status);
    setCategory(note.category || '');
    setAssignee(note.assignee || (projectMembers[0]?.name || 'Siz (Hesabınız)'));
    setContent(note.content || '');
    setStartDate(note.startDate || '');
    setEndDate(note.endDate || '');
    setIsSaved(false);
  }, [note]);

  const handleLocalChange = (field, value) => {
    if (field === 'title') setTitle(value);
    if (field === 'status') setStatus(value);
    if (field === 'category') setCategory(value);
    if (field === 'assignee') setAssignee(value);
    if (field === 'content') setContent(value);
    if (field === 'startDate') setStartDate(value);
    if (field === 'endDate') setEndDate(value);
    setIsSaved(false);
  };

  const handleManualSave = () => {
    const updatedNote = {
      ...note,
      title,
      status,
      category,
      assignee,
      content,
      startDate,
      endDate,
      updatedAt: new Date().toISOString()
    };
    onSave(updatedNote);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const insertSnippet = (template) => {
    const newContent = content + '\n' + template;
    handleLocalChange('content', newContent);
  };

  const formatDateFull = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatForDateInput = (isoString) => {
    if (!isoString) return '';
    // Use local date part to avoid timezone shifts
    const d = new Date(isoString);
    const offset = d.getTimezoneOffset();
    d.setMinutes(d.getMinutes() - offset);
    return d.toISOString().split('T')[0];
  };

  const parseDateInput = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toISOString();
  };

  return (
    <div className="drawer-overlay" onMouseDown={onClose}>
      <div className="drawer-content" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        {/* Header Actions */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              onClick={handleManualSave}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: isSaved ? 'rgba(34, 197, 94, 0.3)' : '#2eaadc',
                color: isSaved ? '#4ade80' : '#ffffff',
                border: isSaved ? '1px solid rgba(34, 197, 94, 0.5)' : 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {isSaved ? <Check size={16} /> : <Save size={16} />}
              <span>{isSaved ? 'Kaydedildi!' : 'Kaydet'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button className="icon-btn" title="Paylaş" onClick={() => alert('Paylaşım linki kopyalandı!')}>
              <Share2 size={16} />
            </button>
            <button className="icon-btn" title="Geri Dönüşüm Kutusu'na Taşı" onClick={() => onDelete(note.id)}>
              <Trash2 size={16} style={{ color: '#ef4444' }} />
            </button>
            <button className="icon-btn" title="Kapat" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body Editor */}
        <div className="drawer-body">
          {/* Note Title Input */}
          <input 
            type="text"
            className="note-title-input"
            value={title}
            onChange={(e) => handleLocalChange('title', e.target.value)}
            placeholder="Not Başlığı..."
          />

          {/* Meta Information Grid */}
          <div className="note-meta-grid">
            <div className="meta-label">Durum (Status)</div>
            <div>
              <select 
                value={status}
                onChange={(e) => handleLocalChange('status', e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-main)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  outline: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt} value={opt} style={{ background: '#252525' }}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="meta-label">Kategori / Etiket</div>
            <div>
              <input 
                type="text"
                value={category}
                onChange={(e) => handleLocalChange('category', e.target.value)}
                placeholder="Örn: UI/UX, Backend..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border-main)',
                  color: 'var(--text-main)',
                  outline: 'none',
                  fontSize: '0.85rem',
                  width: '100%'
                }}
              />
            </div>

            <div className="meta-label">Sorumlu (Assignee)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select 
                value={assignee}
                onChange={(e) => handleLocalChange('assignee', e.target.value)}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-main)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  outline: 'none',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                {projectMembers.map(m => (
                  <option key={m.id} value={m.name} style={{ background: '#252525' }}>
                    👤 {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Creation Date Display */}
            <div className="meta-label">Oluşturma Tarihi</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
              <span>{formatDateFull(note.createdAt)}</span>
            </div>

            <div className="meta-label">Başlangıç Tarihi</div>
            <div>
              <input 
                type="date"
                value={formatForDateInput(startDate)}
                onChange={(e) => handleLocalChange('startDate', parseDateInput(e.target.value))}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-main)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  outline: 'none',
                  fontSize: '0.85rem',
                  width: '100%',
                  colorScheme: 'dark'
                }}
              />
            </div>

            <div className="meta-label">Bitiş Tarihi</div>
            <div>
              <input 
                type="date"
                value={formatForDateInput(endDate)}
                onChange={(e) => handleLocalChange('endDate', parseDateInput(e.target.value))}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-main)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  outline: 'none',
                  fontSize: '0.85rem',
                  width: '100%',
                  colorScheme: 'dark'
                }}
              />
            </div>
          </div>

          {/* Editor Quick Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 0', borderBottom: '1px solid var(--border-main)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '6px' }}>Hızlı Blok:</span>
            <button className="icon-btn" title="Başlık Ekle" onClick={() => insertSnippet('### Yeni Başlık')}>
              <Heading size={14} />
            </button>
            <button className="icon-btn" title="Kontrol Listesi" onClick={() => insertSnippet('- [ ] Yapılacak iş')}>
              <ListChecks size={14} />
            </button>
            <button className="icon-btn" title="Vurgu Kutusu" onClick={() => insertSnippet('> **Önemli Not:** ')}>
              <Quote size={14} />
            </button>
            <button className="icon-btn" title="Kod Bloku" onClick={() => insertSnippet('```javascript\n// Kod buraya\n```')}>
              <Code size={14} />
            </button>
          </div>

          {/* Detailed Content Textarea */}
          <textarea 
            className="note-content-editor"
            value={content}
            onChange={(e) => handleLocalChange('content', e.target.value)}
            placeholder="Buraya not detaylarınızı, kontrol listelerinizi veya açıklamanızı yazın..."
          />
        </div>
      </div>
    </div>
  );
}
