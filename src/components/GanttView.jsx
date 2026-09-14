import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Calendar, 
  Info, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Hash, 
  X, 
  Layers
} from 'lucide-react';
import { parseContent } from '../utils/noteBlocks';

// Tarihleri gün ortasına (12:00) sabitleyen yardımcı — saat dilimi (timezone/DST) kaymalarını önler
const normalizeDate = (d) => {
  const res = new Date(d);
  res.setHours(12, 0, 0, 0);
  return res;
};

const getOffsetDays = (d1, d2) => {
  return Math.round((d1.getTime() - d2.getTime()) / 86400000);
};

export default function GanttView({ notes, onSelectNote, onUpdateDates, onUpdateHeadingDates }) {
  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);
  const dragRef = useRef(null);

  const [days, setDays] = useState([]);
  const [timelineStart, setTimelineStart] = useState(() => normalizeDate(new Date()));
  
  // Yatay sütun genişliği (Varsayılan olarak 90px: tek günlük notlar rahatça okunabilsin)
  const [colWidth, setColWidth] = useState(90);

  // Açılıp kapanabilir notlar (Set of note IDs)
  const [expandedNotes, setExpandedNotes] = useState(new Set());

  // Sürükleme UI durumu (preview)
  const [draggingItem, setDraggingItem] = useState(null);
  const [previewDates, setPreviewDates] = useState(null);

  // Notları başlıklarıyla (`heading` blokları) birlikte parse et
  const notesWithHeadings = useMemo(() => {
    return notes.map(note => {
      const blocks = parseContent(note.content);
      const headings = blocks.filter(b => b.type === 'heading');
      return {
        ...note,
        headings
      };
    });
  }, [notes]);

  // Takvim günlerini hesapla (Tüm notların ve başlıkların tarihlerini kapsayacak şekilde dinamik)
  useEffect(() => {
    const today = normalizeDate(new Date());

    let minDate = new Date(today);
    minDate.setDate(minDate.getDate() - 7);

    let maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 45);

    notes.forEach(n => {
      const start = normalizeDate(n.startDate || n.createdAt || today);
      if (start < minDate) minDate = new Date(start);

      if (n.endDate) {
        const end = normalizeDate(n.endDate);
        if (end > maxDate) maxDate = new Date(end);
      }

      // Başlık tarihlerini de sınır kontrolüne dahil et
      const blocks = parseContent(n.content);
      blocks.forEach(b => {
        if (b.type === 'heading') {
          if (b.startDate) {
            const hs = normalizeDate(b.startDate);
            if (hs < minDate) minDate = new Date(hs);
          }
          if (b.endDate) {
            const he = normalizeDate(b.endDate);
            if (he > maxDate) maxDate = new Date(he);
          }
        }
      });
    });

    // Başlangıca ve sona rahat kaydırma payı
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 20);

    const diffDays = Math.max(60, getOffsetDays(maxDate, minDate));
    const generatedDays = [];
    for (let i = 0; i < diffDays; i++) {
      const d = new Date(minDate);
      d.setDate(minDate.getDate() + i);
      generatedDays.push(d);
    }

    setTimelineStart(minDate);
    setDays(generatedDays);
    
    // Açılışta bugüne doğru yumuşakça kaydır
    if (bodyScrollRef.current) {
      const todayOffsetDays = getOffsetDays(today, minDate);
      bodyScrollRef.current.scrollLeft = Math.max(0, (todayOffsetDays - 2) * colWidth);
    }
  }, [notes.length]);

  // Ctrl + MouseWheel ile timeline üzerinde yakınlaştırma/uzaklaştırma
  useEffect(() => {
    const el = bodyScrollRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          setColWidth(w => Math.min(160, w + 8));
        } else {
          setColWidth(w => Math.max(40, w - 8));
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const handleScroll = (e) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  const getStatusColors = (status) => {
    switch (status) {
      case 'Devam Ediyor': return { bg: 'var(--status-progress-bg)', border: 'var(--status-progress-border)', text: 'var(--status-progress-text)' };
      case 'İnceleniyor': return { bg: 'var(--status-review-bg)', border: 'var(--status-review-border)', text: 'var(--status-review-text)' };
      case 'Tamamlandı': return { bg: 'var(--status-done-bg)', border: 'var(--status-done-border)', text: 'var(--status-done-text)' };
      default: return { bg: 'var(--status-todo-bg)', border: 'var(--status-todo-border)', text: 'var(--status-todo-text)' };
    }
  };

  const getNoteDates = useCallback((note) => {
    const start = normalizeDate(note.startDate || note.createdAt || new Date());
    const end = note.endDate ? normalizeDate(note.endDate) : new Date(start);
    if (end < start) end.setTime(start.getTime()); 
    return { start, end };
  }, []);

  const getHeadingDates = useCallback((heading, parentNote) => {
    if (heading.startDate) {
      const start = normalizeDate(heading.startDate);
      const end = heading.endDate ? normalizeDate(heading.endDate) : new Date(start);
      if (end < start) end.setTime(start.getTime());
      return { start, end, hasDate: true };
    }
    // Tarih henüz ayarlanmamışsa ana notun başlangıç gününü temel al
    const parentDates = getNoteDates(parentNote);
    return { start: parentDates.start, end: parentDates.start, hasDate: false };
  }, [getNoteDates]);

  // Açma / Kapama (Expand / Collapse)
  const toggleExpand = (noteId) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const toggleExpandAll = () => {
    const withHeadings = notesWithHeadings.filter(n => n.headings.length > 0);
    if (expandedNotes.size >= withHeadings.length) {
      setExpandedNotes(new Set());
    } else {
      setExpandedNotes(new Set(withHeadings.map(n => n.id)));
    }
  };

  // Optimize Edilmiş Sürükleme Başlatıcı (Mouse Move & Up window event listener ile)
  const handleDragStart = (e, item, type, isHeading = false, parentNote = null) => {
    e.preventDefault();
    e.stopPropagation();

    let start, end;
    if (isHeading) {
      const hd = getHeadingDates(item, parentNote);
      start = hd.start;
      end = hd.end;
    } else {
      const nd = getNoteDates(item);
      start = nd.start;
      end = nd.end;
    }

    const noteId = isHeading ? parentNote.id : item.id;
    const headingId = isHeading ? item.id : null;
    const isNew = isHeading && !item.startDate;

    const dragData = {
      type: isHeading ? 'heading' : 'note',
      noteId,
      headingId,
      startX: e.clientX,
      origStart: new Date(start),
      origEnd: new Date(end),
      currentStart: new Date(start),
      currentEnd: new Date(end),
      dragType: type, // 'start' | 'end' | 'move' | 'create'
      isNew,
      hasMoved: false
    };

    dragRef.current = dragData;

    setDraggingItem({
      type: dragData.type,
      noteId,
      headingId,
      dragType: type
    });

    setPreviewDates({
      type: dragData.type,
      noteId,
      headingId,
      start: new Date(start),
      end: new Date(end)
    });

    document.body.style.userSelect = 'none';
    document.body.style.cursor = type === 'move' ? 'grabbing' : 'ew-resize';

    const onMouseMove = (moveEvent) => {
      if (!dragRef.current) return;
      const current = dragRef.current;
      const deltaX = moveEvent.clientX - current.startX;

      if (Math.abs(deltaX) > 2) {
        current.hasMoved = true;
      }

      const deltaDays = Math.round(deltaX / colWidth);
      const newStart = new Date(current.origStart);
      const newEnd = new Date(current.origEnd);

      if (current.dragType === 'start') {
        newStart.setDate(current.origStart.getDate() + deltaDays);
        // Bitiş tarihini geçemez
        if (newStart > newEnd) {
          newStart.setTime(newEnd.getTime());
        }
        // Takvim başlangıcından önce olamaz
        if (newStart < timelineStart) {
          newStart.setTime(timelineStart.getTime());
        }
      } else if (current.dragType === 'end') {
        newEnd.setDate(current.origEnd.getDate() + deltaDays);
        // Başlangıç tarihinden önce olamaz
        if (newEnd < newStart) {
          newEnd.setTime(newStart.getTime());
        }
      } else if (current.dragType === 'move') {
        const durationDays = getOffsetDays(current.origEnd, current.origStart);
        newStart.setDate(current.origStart.getDate() + deltaDays);
        if (newStart < timelineStart) {
          newStart.setTime(timelineStart.getTime());
        }
        newEnd.setTime(newStart.getTime() + durationDays * 86400000);
      } else if (current.dragType === 'create') {
        if (deltaDays >= 0) {
          newEnd.setDate(current.origStart.getDate() + deltaDays);
        } else {
          newStart.setDate(current.origStart.getDate() + deltaDays);
          if (newStart < timelineStart) {
            newStart.setTime(timelineStart.getTime());
          }
        }
      }

      current.currentStart = newStart;
      current.currentEnd = newEnd;

      setPreviewDates({
        type: current.type,
        noteId: current.noteId,
        headingId: current.headingId,
        start: newStart,
        end: newEnd
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      const current = dragRef.current;
      if (current) {
        if (current.hasMoved) {
          const startIso = current.currentStart.toISOString();
          const endIso = current.currentEnd.toISOString();

          if (current.type === 'note' && onUpdateDates) {
            onUpdateDates(current.noteId, startIso, endIso);
          } else if (current.type === 'heading' && onUpdateHeadingDates) {
            onUpdateHeadingDates(current.noteId, current.headingId, startIso, endIso);
          }
        } else if (current.isNew) {
          // Hayalet çubuğa tek tıklamada 1 günlük varsayılan tarih ata
          const startIso = current.currentStart.toISOString();
          const endIso = current.currentEnd.toISOString();
          if (current.type === 'heading' && onUpdateHeadingDates) {
            onUpdateHeadingDates(current.noteId, current.headingId, startIso, endIso);
          }
        }
      }

      dragRef.current = null;
      setDraggingItem(null);
      setPreviewDates(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Bugüne Kaydır
  const scrollToToday = () => {
    if (!bodyScrollRef.current) return;
    const today = normalizeDate(new Date());
    const todayOffsetDays = getOffsetDays(today, timelineStart);
    bodyScrollRef.current.scrollTo({
      left: Math.max(0, (todayOffsetDays - 2) * colWidth),
      behavior: 'smooth'
    });
  };

  // Ay gruplarını hesapla (Header için)
  const monthGroups = useMemo(() => {
    const groups = [];
    if (days.length === 0) return groups;

    let currentMonth = -1;
    let currentYear = -1;
    let count = 0;
    let label = '';

    days.forEach((d) => {
      const m = d.getMonth();
      const y = d.getFullYear();
      if (m !== currentMonth || y !== currentYear) {
        if (count > 0) {
          groups.push({ label, count });
        }
        currentMonth = m;
        currentYear = y;
        count = 1;
        label = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
      } else {
        count++;
      }
    });

    if (count > 0) {
      groups.push({ label, count });
    }

    return groups;
  }, [days]);

  return (
    <>
    <div className="gantt-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)', padding: '16px', background: 'var(--bg-main)' }}>

      {/* Üst Başlık, Bilgi & Yakınlaştırma Araç Çubuğu */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        
        {/* Sol Başlık & Bilgi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={19} style={{ color: 'var(--accent-blue)' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>Proje Zaman Çizelgesi (Gantt)</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '4px 10px', borderRadius: '6px' }}>
            <Info size={13} />
            <span>Çubukların kenarlarından süreyi uzatabilir, ortasından tutup ileri-geri taşıyabilirsiniz.</span>
          </div>
        </div>

        {/* Sağ Kontroller: Tümünü Aç/Kapa, Bugüne Git & Zoom Kontrolleri */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          
          {/* Tümünü Genişlet/Daralt Butonu */}
          <button
            onClick={toggleExpandAll}
            className="gantt-zoom-btn"
            style={{ width: 'auto', padding: '0 10px', fontSize: '0.78rem', gap: '5px' }}
            title="Tüm not başlıklarını genişlet veya daralt"
          >
            <Layers size={13} />
            <span>{expandedNotes.size > 0 ? 'Tümünü Daralt' : 'Tümünü Genişlet'}</span>
          </button>

          {/* Bugüne Git Butonu */}
          <button
            onClick={scrollToToday}
            className="gantt-zoom-btn"
            style={{ width: 'auto', padding: '0 10px', fontSize: '0.78rem' }}
            title="Zaman çizelgesinde bugünün tarihine odaklan"
          >
            Bugün
          </button>

          <div style={{ width: '1px', height: '18px', background: 'var(--border-main)', margin: '0 2px' }} />

          {/* Zoom Kontrolleri */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '2px 4px', borderRadius: '8px', border: '1px solid var(--border-main)' }}>
            <button
              onClick={() => setColWidth(w => Math.max(40, w - 12))}
              className="gantt-zoom-btn"
              title="Uzaklaştır (-)"
              disabled={colWidth <= 40}
              style={{ opacity: colWidth <= 40 ? 0.4 : 1 }}
            >
              <ZoomOut size={14} />
            </button>

            <input
              type="range"
              min="40"
              max="160"
              step="5"
              value={colWidth}
              onChange={(e) => setColWidth(Number(e.target.value))}
              style={{ width: '64px', cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
              title={`Görünüm Genişliği: ${colWidth}px (${Math.round((colWidth / 90) * 100)}%)`}
            />

            <button
              onClick={() => setColWidth(w => Math.min(160, w + 12))}
              className="gantt-zoom-btn"
              title="Yakınlaştır (+)"
              disabled={colWidth >= 160}
              style={{ opacity: colWidth >= 160 ? 0.4 : 1 }}
            >
              <ZoomIn size={14} />
            </button>

            <button
              onClick={() => setColWidth(90)}
              className="gantt-zoom-btn"
              title="Varsayılan Boyuta Sıfırla (90px)"
            >
              <RotateCcw size={12} />
            </button>

            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: '36px', textAlign: 'center', userSelect: 'none' }}>
              {Math.round((colWidth / 90) * 100)}%
            </span>
          </div>

        </div>

      </div>

      {/* Gantt Tablosu Ana Kapsayıcı */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid var(--border-main)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)' }}>
        
        {/* Tablo Header */}
        <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-main)', background: 'rgba(0,0,0,0.25)' }}>
          
          {/* Üst Ay Satırı */}
          <div style={{ display: 'flex', height: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width: '300px', flexShrink: 0, borderRight: '1px solid var(--border-main)', padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Görev & Alt Başlıklar
            </div>
            
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
              <div style={{ display: 'flex', width: `${days.length * colWidth}px`, transform: `translateX(-${headerScrollRef.current?.scrollLeft || 0}px)` }}>
                {monthGroups.map((mg, mi) => (
                  <div key={mi} style={{
                    width: `${mg.count * colWidth}px`,
                    flexShrink: 0,
                    borderRight: '1px solid var(--border-main)',
                    padding: '0 10px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.015)'
                  }}>
                    {mg.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Gün Satırı */}
          <div style={{ display: 'flex', height: '38px' }}>
            <div style={{ width: '300px', flexShrink: 0, borderRight: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', padding: '0 16px', fontWeight: 600, fontSize: '0.85rem' }}>
              İsim
            </div>
            
            <div ref={headerScrollRef} style={{ flex: 1, overflowX: 'hidden', display: 'flex' }}>
              <div style={{ display: 'flex', width: `${days.length * colWidth}px` }}>
                {days.map((d, i) => {
                  const today = normalizeDate(new Date());
                  const isToday = d.toDateString() === today.toDateString();
                  const isWeekend = [0, 6].includes(d.getDay());
                  return (
                    <div key={i} style={{ 
                      width: `${colWidth}px`, 
                      flexShrink: 0, 
                      borderRight: '1px solid var(--border-main)', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      background: isToday ? 'rgba(56, 189, 248, 0.15)' : (isWeekend ? 'rgba(255,255,255,0.02)' : 'transparent') 
                    }}>
                      <span style={{ fontSize: '0.65rem', color: isToday ? '#38bdf8' : 'var(--text-muted)' }}>
                        {d.toLocaleDateString('tr-TR', { weekday: 'short' })}
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: isToday ? 700 : 500, color: isToday ? '#38bdf8' : 'var(--text-main)' }}>
                        {d.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* Tablo Gövdesi */}
        <div style={{ flex: 1, display: 'flex', overflowY: 'auto' }}>
          
          {/* Sol Sabit Görev & Başlık Listesi (Accordion / Tree Yapısı) */}
          <div style={{ width: '300px', flexShrink: 0, borderRight: '1px solid var(--border-main)', background: 'var(--bg-card)', zIndex: 10 }}>
            {notesWithHeadings.map(note => {
              const hasHeadings = note.headings && note.headings.length > 0;
              const isExpanded = expandedNotes.has(note.id);

              return (
                <React.Fragment key={note.id}>
                  {/* Ana Görev Satırı (Detay bu satıra tıklanınca açılır) */}
                  <div 
                    style={{ 
                      height: '44px', 
                      borderBottom: '1px solid var(--border-main)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '0 12px', 
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      gap: '6px'
                    }}
                    className="hover-bg-subtle"
                    title={`${note.title} (Detayları açmak için tıklayın)`}
                  >
                    {/* Genişletme / Daraltma Oku */}
                    {hasHeadings ? (
                      <button
                        className="gantt-expand-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(note.id);
                        }}
                        title={isExpanded ? 'Başlıkları gizle' : `${note.headings.length} başlığı göster`}
                      >
                        <ChevronRight 
                          size={14} 
                          style={{ 
                            transform: isExpanded ? 'rotate(90deg)' : 'none', 
                            transition: 'transform 0.15s ease' 
                          }} 
                        />
                      </button>
                    ) : (
                      <div style={{ width: '20px', flexShrink: 0 }} />
                    )}

                    {/* Not Başlığı */}
                    <div 
                      onClick={() => onSelectNote(note)}
                      style={{ 
                        flex: 1, 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        fontWeight: 500 
                      }}
                    >
                      {note.title}
                    </div>

                    {/* Başlık Sayısı Rozeti */}
                    {hasHeadings && (
                      <span style={{ 
                        fontSize: '0.68rem', 
                        padding: '2px 6px', 
                        borderRadius: '10px', 
                        background: 'rgba(255,255,255,0.06)', 
                        color: 'var(--text-muted)' 
                      }}>
                        {note.headings.length}
                      </span>
                    )}
                  </div>

                  {/* Açılmış Başlık Alt Satırları */}
                  {isExpanded && hasHeadings && note.headings.map((heading) => (
                    <div
                      key={heading.id}
                      onClick={() => onSelectNote(note)}
                      style={{
                        height: '34px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 12px 0 38px',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        gap: '6px',
                        background: 'rgba(0,0,0,0.1)'
                      }}
                      className="hover-bg-subtle"
                      title={`Başlık: ${heading.text || 'Başlıksız'}`}
                    >
                      <Hash size={13} style={{ color: '#a855f7', opacity: 0.7, flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {heading.text || 'Başlıksız Bölüm'}
                      </span>
                      {heading.startDate && (
                        <span style={{ fontSize: '0.68rem', color: '#c4b5fd', opacity: 0.7 }}>
                          {new Date(heading.startDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  ))}
                </React.Fragment>
              );
            })}

            {notes.length === 0 && (
              <div style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Henüz görev bulunmuyor.
              </div>
            )}
          </div>

          {/* Sağ Yatay Kaydırılabilir Grid ve Çubuklar */}
          <div 
            ref={bodyScrollRef} 
            onScroll={handleScroll} 
            style={{ flex: 1, overflowX: 'auto', position: 'relative' }}
          >
            <div style={{ width: `${days.length * colWidth}px`, minHeight: '100%', position: 'relative' }}>
              
              {/* Arka Plan Grid Çizgileri */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', pointerEvents: 'none', zIndex: 0 }}>
                {days.map((d, i) => (
                  <div key={i} style={{ 
                    width: `${colWidth}px`, 
                    flexShrink: 0, 
                    borderRight: '1px solid var(--border-main)', 
                    background: [0, 6].includes(d.getDay()) ? 'rgba(255,255,255,0.015)' : 'transparent' 
                  }} />
                ))}
              </div>

              {/* Bugün İşaretçisi Çizgisi */}
              {(() => {
                const today = normalizeDate(new Date());
                const offsetDays = getOffsetDays(today, timelineStart);
                if (offsetDays >= 0 && offsetDays < days.length) {
                  return (
                    <div style={{ 
                      position: 'absolute', 
                      top: 0, 
                      bottom: 0, 
                      left: `${offsetDays * colWidth + (colWidth / 2)}px`, 
                      width: '2px', 
                      background: 'rgba(56, 189, 248, 0.45)', 
                      zIndex: 5, 
                      pointerEvents: 'none' 
                    }} />
                  );
                }
                return null;
              })()}
              
              {/* Görev ve Başlık Satırları */}
              {notesWithHeadings.map(note => {
                const isDraggingNote = previewDates && previewDates.type === 'note' && previewDates.noteId === note.id;
                
                const currentNoteStart = isDraggingNote ? previewDates.start : getNoteDates(note).start;
                const currentNoteEnd = isDraggingNote ? previewDates.end : getNoteDates(note).end;
                
                const noteStartOffset = getOffsetDays(currentNoteStart, timelineStart);
                const noteDuration = Math.max(1, getOffsetDays(currentNoteEnd, currentNoteStart) + 1);

                const noteLeft = noteStartOffset * colWidth;
                const noteWidth = noteDuration * colWidth;
                const colors = getStatusColors(note.status);

                const hasHeadings = note.headings && note.headings.length > 0;
                const isExpanded = expandedNotes.has(note.id);

                return (
                  <React.Fragment key={note.id}>
                    {/* Ana Görev Timeline Satırı */}
                    <div style={{ height: '44px', borderBottom: '1px solid var(--border-main)', position: 'relative', zIndex: isDraggingNote ? 12 : 2 }}>
                      
                      {/* Ana Görev Gantt Çubuğu — NOT: Tıklayınca not açılmaz; yalnızca sürükleme ve boyutlandırma yapılır */}
                      <div 
                        style={{ 
                          position: 'absolute', 
                          top: '6px', 
                          left: `${noteLeft + 3}px`, 
                          width: `${Math.max(colWidth - 6, noteWidth - 6)}px`, 
                          height: '32px', 
                          background: colors.bg,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: colors.text,
                          boxShadow: isDraggingNote ? '0 8px 24px rgba(0,0,0,0.5)' : '0 2px 6px rgba(0,0,0,0.15)',
                          transition: isDraggingNote ? 'none' : 'box-shadow 0.15s',
                          opacity: isDraggingNote ? 0.95 : 1,
                          userSelect: 'none'
                        }}
                        title={`${note.title} (${noteDuration} gün)\nBaşlangıç: ${currentNoteStart.toLocaleDateString('tr-TR')}\nBitiş: ${currentNoteEnd.toLocaleDateString('tr-TR')}`}
                      >
                        {/* Sol Yeniden Boyutlandırma Kolu (Başlangıç Tarihi) */}
                        <div 
                          onMouseDown={(e) => handleDragStart(e, note, 'start', false)}
                          style={{ 
                            width: '12px', 
                            height: '100%', 
                            cursor: 'ew-resize', 
                            flexShrink: 0, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            opacity: 0.5, 
                            background: 'rgba(255,255,255,0.15)', 
                            borderRadius: '5px 0 0 5px',
                            transition: 'opacity 0.15s, background 0.15s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.35)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                          title="Başlangıç tarihini değiştirmek için sürükleyin"
                        >
                          <div style={{ width: '2px', height: '14px', background: 'rgba(255,255,255,0.6)', borderRadius: '1px' }} />
                        </div>

                        {/* Görev Başlığı ve Taşıma Alanı (İleri-Geri Tarih Taşıma) */}
                        <div 
                          onMouseDown={(e) => handleDragStart(e, note, 'move', false)}
                          style={{ 
                            padding: '0 8px', 
                            whiteSpace: 'nowrap', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            flex: 1, 
                            cursor: 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            height: '100%'
                          }}
                          title="Görevi ileri veya geri taşımak için sürükleyin"
                        >
                          <span style={{ pointerEvents: 'none' }}>{note.title}</span>
                        </div>

                        {/* Sağ Yeniden Boyutlandırma Kolu (Bitiş Tarihi) */}
                        <div 
                          onMouseDown={(e) => handleDragStart(e, note, 'end', false)}
                          style={{ 
                            width: '12px', 
                            height: '100%', 
                            cursor: 'ew-resize', 
                            flexShrink: 0, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            opacity: 0.5, 
                            background: 'rgba(255,255,255,0.15)', 
                            borderRadius: '0 5px 5px 0',
                            transition: 'opacity 0.15s, background 0.15s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.35)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                          title="Bitiş tarihini değiştirmek için sürükleyin"
                        >
                          <div style={{ width: '2px', height: '14px', background: 'rgba(255,255,255,0.6)', borderRadius: '1px' }} />
                        </div>

                        {/* Sürükleme Anındaki Anlık Tarih Rozeti */}
                        {isDraggingNote && (
                          <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginBottom: '6px',
                            padding: '3px 8px',
                            background: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#ffffff',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            zIndex: 50
                          }}>
                            {currentNoteStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} - {currentNoteEnd.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ({noteDuration} gün)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Açılmış Başlıklar Timeline Satırları */}
                    {isExpanded && hasHeadings && note.headings.map(heading => {
                      const isDraggingThisHeading = previewDates && previewDates.type === 'heading' && previewDates.headingId === heading.id;
                      
                      const headingDates = getHeadingDates(heading, note);
                      const currentHStart = isDraggingThisHeading ? previewDates.start : headingDates.start;
                      const currentHEnd = isDraggingThisHeading ? previewDates.end : headingDates.end;

                      const hStartOffset = getOffsetDays(currentHStart, timelineStart);
                      const hDuration = Math.max(1, getOffsetDays(currentHEnd, currentHStart) + 1);

                      const hLeft = hStartOffset * colWidth;
                      const hWidth = hDuration * colWidth;

                      const hasAssignedDate = headingDates.hasDate || isDraggingThisHeading;

                      return (
                        <div 
                          key={heading.id} 
                          style={{ 
                            height: '34px', 
                            borderBottom: '1px solid rgba(255,255,255,0.05)', 
                            position: 'relative', 
                            zIndex: isDraggingThisHeading ? 12 : 2,
                            background: 'rgba(0,0,0,0.08)'
                          }}
                        >
                          {hasAssignedDate ? (
                            /* Başlık Gantt Çubuğu (Tarihi Belirlenmiş) */
                            <div
                              className="gantt-heading-bar"
                              style={{
                                top: '5px',
                                left: `${hLeft + 3}px`,
                                width: `${Math.max(colWidth - 6, hWidth - 6)}px`,
                                boxShadow: isDraggingThisHeading ? '0 6px 18px rgba(168, 85, 247, 0.5)' : '0 2px 5px rgba(0,0,0,0.2)',
                                transition: isDraggingThisHeading ? 'none' : 'box-shadow 0.15s',
                                opacity: isDraggingThisHeading ? 0.95 : 1,
                                userSelect: 'none'
                              }}
                              title={`Başlık: ${heading.text || 'Başlıksız'}\n${currentHStart.toLocaleDateString('tr-TR')} - ${currentHEnd.toLocaleDateString('tr-TR')}`}
                            >
                              {/* Sol Kol */}
                              <div
                                onMouseDown={(e) => handleDragStart(e, heading, 'start', true, note)}
                                style={{ width: '10px', height: '100%', cursor: 'ew-resize', flexShrink: 0, opacity: 0.5, background: 'rgba(255,255,255,0.3)', borderRadius: '5px 0 0 5px' }}
                                title="Başlangıç tarihini ayarla"
                              />

                              {/* Orta Taşıma & Metin */}
                              <div
                                onMouseDown={(e) => handleDragStart(e, heading, 'move', true, note)}
                                style={{ padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, cursor: 'grab', display: 'flex', alignItems: 'center', gap: '4px' }}
                                title="Başlığı ileri veya geri taşımak için sürükleyin"
                              >
                                <Hash size={11} style={{ opacity: 0.7, pointerEvents: 'none' }} />
                                <span style={{ pointerEvents: 'none' }}>{heading.text || 'Başlık'}</span>
                              </div>

                              {/* Tarihi Sıfırla (Temizle) Butonu */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onUpdateHeadingDates) {
                                    onUpdateHeadingDates(note.id, heading.id, null, null);
                                  }
                                }}
                                style={{ padding: '0 5px', cursor: 'pointer', opacity: 0.6, display: 'flex', alignItems: 'center' }}
                                title="Bu başlığın tarihini temizle"
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                              >
                                <X size={12} />
                              </div>

                              {/* Sağ Kol */}
                              <div
                                onMouseDown={(e) => handleDragStart(e, heading, 'end', true, note)}
                                style={{ width: '10px', height: '100%', cursor: 'ew-resize', flexShrink: 0, opacity: 0.5, background: 'rgba(255,255,255,0.3)', borderRadius: '0 5px 5px 0' }}
                                title="Bitiş tarihini ayarla"
                              />

                              {/* Sürükleme Anındaki Anlık Tarih Rozeti */}
                              {isDraggingThisHeading && (
                                <div style={{
                                  position: 'absolute',
                                  bottom: '100%',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  marginBottom: '6px',
                                  padding: '2px 8px',
                                  background: 'rgba(15, 23, 42, 0.95)',
                                  border: '1px solid rgba(168, 85, 247, 0.4)',
                                  color: '#e9d5ff',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  whiteSpace: 'nowrap',
                                  pointerEvents: 'none',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                  zIndex: 50
                                }}>
                                  {currentHStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} - {currentHEnd.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ({hDuration} gün)
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Hayalet Çubuk (Tarih Atanmamış: Sürükleyerek Tarih Belirle) */
                            <div
                              className="gantt-ghost-bar"
                              style={{
                                top: '5px',
                                left: `${noteLeft + 3}px`,
                                width: `${Math.max(colWidth - 6, Math.min(colWidth * 2, noteWidth - 6))}px`,
                              }}
                              onMouseDown={(e) => handleDragStart(e, heading, 'create', true, note)}
                              title="Tarih aralığı belirlemek için sürükleyin veya tıklayın"
                            >
                              <span style={{ fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                                + {heading.text ? `"${heading.text}" Tarihi Belirle` : 'Tarih Belirle'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}

            </div>
          </div>
          
        </div>
      </div>
    </div>

    {/* Mobil Uyarısı */}
    <div className="gantt-mobile-notice" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100dvh - 70px)', padding: '24px', textAlign: 'center', color: 'var(--text-muted)', gap: '10px' }}>
      <Calendar size={28} style={{ color: 'var(--text-muted)' }} />
      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Gantt görünümü küçük ekranlarda kullanılamıyor</div>
      <div style={{ fontSize: '0.85rem', maxWidth: '280px' }}>Zaman çizelgesini görüntülemek için lütfen tablet veya masaüstü kullanın.</div>
    </div>
    </>
  );
}
