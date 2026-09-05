import React, { useState, useEffect, useRef } from 'react';
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
  Palette,
  GripVertical
} from 'lucide-react';
import { parseContent, serializeBlocks, createBlock } from '../utils/noteBlocks';

const COLOR_PALETTE = [
  { name: 'Kırmızı', value: '#ef4444' },
  { name: 'Turuncu', value: '#f59e0b' },
  { name: 'Sarı', value: '#eab308' },
  { name: 'Yeşil', value: '#22c55e' },
  { name: 'Mavi', value: '#2eaadc' },
  { name: 'Mor', value: '#a855f7' }
];

const autoResize = (el) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

export default function NoteDetailDrawer({
  note,
  onClose,
  onSave,
  onDelete
}) {
  const [title, setTitle] = useState(note?.title || '');
  const [blocks, setBlocks] = useState(() => parseContent(note?.content));
  const [isSaved, setIsSaved] = useState(false);
  const [focusedId, setFocusedId] = useState(null);
  const [lastFocusedIndex, setLastFocusedIndex] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingFocusId, setPendingFocusId] = useState(null);

  const blockRefs = useRef({});

  useEffect(() => {
    if (!note) return;
    setTitle(note.title);
    setBlocks(parseContent(note.content));
    setIsSaved(false);
    setFocusedId(null);
    setLastFocusedIndex(null);
    setSelectedIds(new Set());
    setPaletteOpen(false);
  }, [note]);

  useEffect(() => {
    if (!note) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [note, onClose]);

  useEffect(() => {
    if (pendingFocusId && blockRefs.current[pendingFocusId]) {
      blockRefs.current[pendingFocusId].focus();
      setPendingFocusId(null);
    }
  }, [pendingFocusId, blocks]);

  const registerRef = (id, el) => {
    if (el) {
      blockRefs.current[id] = el;
      autoResize(el);
    } else {
      delete blockRefs.current[id];
    }
  };

  const handleTitleChange = (value) => {
    setTitle(value);
    setIsSaved(false);
  };

  const handleBlockChange = (id, value, el) => {
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, text: value } : b)));
    setIsSaved(false);
    if (el) autoResize(el);
  };

  const toggleChecked = (id) => {
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, checked: !b.checked } : b)));
    setIsSaved(false);
  };

  const addBlockAfter = (afterId, type = 'text') => {
    setBlocks(prev => {
      const index = afterId ? prev.findIndex(b => b.id === afterId) : prev.length - 1;
      const newBlock = createBlock({ type });
      const copy = [...prev];
      copy.splice(index + 1, 0, newBlock);
      setPendingFocusId(newBlock.id);
      return copy;
    });
    setIsSaved(false);
  };

  const deleteBlock = (id) => {
    setBlocks(prev => {
      if (prev.length <= 1) return prev; // always keep at least one block
      const index = prev.findIndex(b => b.id === id);
      const copy = prev.filter(b => b.id !== id);
      const focusIndex = Math.max(0, index - 1);
      setPendingFocusId(copy[focusIndex]?.id || null);
      return copy;
    });
    setIsSaved(false);
  };

  const handleBlockKeyDown = (e, block) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBlockAfter(block.id);
    } else if (e.key === 'Backspace' && block.text === '' && blocks.length > 1) {
      e.preventDefault();
      deleteBlock(block.id);
    }
  };

  const handleFocusBlock = (id, index) => {
    setFocusedId(id);
    setLastFocusedIndex(index);
    setSelectedIds(new Set([id]));
  };

  const handleGutterClick = (e, id, index) => {
    if (e.shiftKey && lastFocusedIndex !== null) {
      const [start, end] = [lastFocusedIndex, index].sort((a, b) => a - b);
      const rangeIds = blocks.slice(start, end + 1).map(b => b.id);
      setSelectedIds(new Set(rangeIds));
    } else {
      setSelectedIds(new Set([id]));
      setLastFocusedIndex(index);
    }
  };

  const handleDragStartBlock = (e, id) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDropBlock = (e, targetId) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === targetId) return;
    setBlocks(prev => {
      const from = prev.findIndex(b => b.id === draggedId);
      const to = prev.findIndex(b => b.id === targetId);
      if (from < 0 || to < 0) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
    setIsSaved(false);
  };

  const applyColor = (value) => {
    setBlocks(prev => prev.map(b => (selectedIds.has(b.id) ? { ...b, color: value } : b)));
    setIsSaved(false);
    setPaletteOpen(false);
  };

  const handleManualSave = () => {
    const updatedNote = {
      ...note,
      title,
      content: serializeBlocks(blocks),
      updatedAt: new Date().toISOString()
    };
    onSave(updatedNote);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  if (!note) return null;

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="note-modal-card" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
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
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Not Başlığı..."
          />

          {/* Editor Quick Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 0', borderBottom: '1px solid var(--border-main)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '6px' }}>Hızlı Blok:</span>
            <button className="icon-btn" title="Başlık Ekle" onClick={() => addBlockAfter(focusedId, 'heading')}>
              <Heading size={14} />
            </button>
            <button className="icon-btn" title="Kontrol Listesi" onClick={() => addBlockAfter(focusedId, 'todo')}>
              <ListChecks size={14} />
            </button>
            <button className="icon-btn" title="Vurgu Kutusu" onClick={() => addBlockAfter(focusedId, 'quote')}>
              <Quote size={14} />
            </button>
            <button className="icon-btn" title="Kod Bloku" onClick={() => addBlockAfter(focusedId, 'code')}>
              <Code size={14} />
            </button>
            <div style={{ position: 'relative' }}>
              <button
                className="icon-btn"
                title="Seçili Blokların Rengi"
                onClick={() => { if (selectedIds.size > 0) setPaletteOpen(o => !o); }}
              >
                <Palette size={14} />
              </button>
              {paletteOpen && (
                <div className="note-color-palette">
                  <button className="note-color-swatch none" title="Renksiz" onClick={() => applyColor(null)} />
                  {COLOR_PALETTE.map(c => (
                    <button
                      key={c.value}
                      className="note-color-swatch"
                      style={{ background: c.value }}
                      title={c.name}
                      onClick={() => applyColor(c.value)}
                    />
                  ))}
                </div>
              )}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
              Renk için satıra tıklayın, Shift+tıkla ile aralık seçin
            </span>
          </div>

          {/* Blocks Editor */}
          <div className="note-blocks-container">
            {blocks.map((block, index) => {
              const isSelected = selectedIds.size > 1 && selectedIds.has(block.id);
              return (
                <div
                  key={block.id}
                  className={`note-block-row type-${block.type}${isSelected ? ' selected' : ''}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropBlock(e, block.id)}
                >
                  <div
                    className="note-block-drag-handle"
                    draggable
                    onDragStart={(e) => handleDragStartBlock(e, block.id)}
                    onClick={(e) => handleGutterClick(e, block.id, index)}
                    title="Sürükle veya Shift+Tıkla ile aralık seç"
                  >
                    <GripVertical size={13} />
                  </div>

                  {block.type === 'todo' && (
                    <input
                      type="checkbox"
                      className="note-block-checkbox"
                      checked={block.checked}
                      onChange={() => toggleChecked(block.id)}
                    />
                  )}

                  <textarea
                    ref={(el) => registerRef(block.id, el)}
                    rows={1}
                    className={`note-block-input${block.checked ? ' checked' : ''}`}
                    style={block.color ? { color: block.color } : undefined}
                    value={block.text}
                    placeholder={
                      block.type === 'heading' ? 'Başlık' :
                      block.type === 'quote' ? 'Alıntı' :
                      block.type === 'code' ? '// kod' :
                      'Yazın...'
                    }
                    onChange={(e) => handleBlockChange(block.id, e.target.value, e.target)}
                    onKeyDown={(e) => handleBlockKeyDown(e, block)}
                    onFocus={() => handleFocusBlock(block.id, index)}
                  />

                  <div className="note-block-delete" title="Bloğu Sil" onClick={() => deleteBlock(block.id)}>
                    <X size={13} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
