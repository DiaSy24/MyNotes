import React, { useRef, useEffect, useState } from 'react';
import { Calendar, Clock, AlertCircle, Info } from 'lucide-react';

export default function GanttView({ notes, onSelectNote, onUpdateDates }) {
  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);

  const [days, setDays] = useState([]);
  const [timelineStart, setTimelineStart] = useState(new Date());
  
  const [draggingNote, setDraggingNote] = useState(null);
  const [dragType, setDragType] = useState(null);
  const [previewDates, setPreviewDates] = useState(null);

  // Sütun genişliği
  const COL_WIDTH = 40;

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let minDate = new Date(today);
    minDate.setDate(minDate.getDate() - 5);

    notes.forEach(n => {
      const d = new Date(n.startDate || n.createdAt);
      if (d < minDate) {
        minDate = new Date(d);
        minDate.setHours(0, 0, 0, 0);
      }
    });

    // Padding before the first task
    minDate.setDate(minDate.getDate() - 3);
    setTimelineStart(minDate);

    // 60 günlük bir takvim oluştur
    const generatedDays = [];
    for (let i = 0; i < 60; i++) {
      const d = new Date(minDate);
      d.setDate(minDate.getDate() + i);
      generatedDays.push(d);
    }
    setDays(generatedDays);
    
    // Sayfa açılışında bugüne doğru hafif kaydır
    if (bodyScrollRef.current) {
      const todayOffsetDays = Math.floor((today.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
      bodyScrollRef.current.scrollLeft = Math.max(0, (todayOffsetDays - 3) * COL_WIDTH);
    }
  }, [notes.length]); // Sadece not sayısı değiştiğinde veya ilk yüklemede takvimi kur

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

  const getNoteDates = (note) => {
    const start = new Date(note.startDate || note.createdAt);
    start.setHours(0, 0, 0, 0);
    
    const end = note.endDate ? new Date(note.endDate) : new Date(start);
    end.setHours(0, 0, 0, 0);
    if (end < start) end.setTime(start.getTime()); 
    
    return { start, end };
  };

  const handleEdgeMouseDown = (e, note, type) => {
    // Prevent selecting text while dragging
    e.preventDefault();
    e.stopPropagation();
    const { start, end } = getNoteDates(note);
    setDraggingNote({
      id: note.id,
      startX: e.clientX,
      originalStart: start,
      originalEnd: end
    });
    setDragType(type);
    setPreviewDates({
      id: note.id,
      start: start,
      end: end
    });
  };

  useEffect(() => {
    if (!draggingNote || !dragType) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - draggingNote.startX;
      const deltaDays = Math.round(deltaX / COL_WIDTH);
      
      const newStart = new Date(draggingNote.originalStart);
      const newEnd = new Date(draggingNote.originalEnd);
      
      if (dragType === 'start') {
        newStart.setDate(newStart.getDate() + deltaDays);
        if (newStart > newEnd) newStart.setTime(newEnd.getTime());
      } else if (dragType === 'end') {
        newEnd.setDate(newEnd.getDate() + deltaDays);
        if (newEnd < newStart) newEnd.setTime(newStart.getTime());
      }
      
      setPreviewDates({
        id: draggingNote.id,
        start: newStart,
        end: newEnd
      });
    };

    const handleMouseUp = () => {
      if (previewDates && previewDates.id === draggingNote.id) {
         if (onUpdateDates) {
           onUpdateDates(draggingNote.id, previewDates.start.toISOString(), previewDates.end.toISOString());
         }
      }
      setDraggingNote(null);
      setDragType(null);
      setPreviewDates(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingNote, dragType, previewDates, onUpdateDates]);

  return (
    <>
    <div className="gantt-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)', padding: '16px', background: 'var(--bg-main)' }}>

      {/* Üst Başlık & Bilgi */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Calendar size={18} style={{ color: 'var(--accent-blue)' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>Proje Zaman Çizelgesi (Gantt Chart)</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px' }}>
          <Info size={14} />
          <span>Gantt çubuklarının sağ veya sol kenarlarından tutarak uzatıp kısaltabilirsiniz.</span>
        </div>
      </div>

      {/* Gantt Tablosu Ana Kapsayıcı */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid var(--border-main)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)' }}>
        
        {/* Tablo Header */}
        <div style={{ display: 'flex', height: '46px', borderBottom: '1px solid var(--border-main)', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ width: '280px', flexShrink: 0, borderRight: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', padding: '0 16px', fontWeight: 600, fontSize: '0.85rem' }}>
            Görev Adı
          </div>
          
          <div ref={headerScrollRef} style={{ flex: 1, overflowX: 'hidden', display: 'flex' }}>
            <div style={{ display: 'flex', width: `${days.length * COL_WIDTH}px` }}>
              {days.map((d, i) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isToday = d.getTime() === today.getTime();
                const isWeekend = [0, 6].includes(d.getDay());
                return (
                  <div key={i} style={{ 
                    width: `${COL_WIDTH}px`, 
                    flexShrink: 0, 
                    borderRight: '1px solid var(--border-main)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    background: isToday ? 'rgba(56, 189, 248, 0.15)' : (isWeekend ? 'rgba(255,255,255,0.02)' : 'transparent') 
                  }}>
                    <span style={{ fontSize: '0.65rem', color: isToday ? '#38bdf8' : 'var(--text-muted)' }}>{d.toLocaleDateString('tr-TR', { weekday: 'short' })}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: isToday ? 600 : 500, color: isToday ? '#38bdf8' : 'var(--text-main)' }}>{d.getDate()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tablo Gövdesi */}
        <div style={{ flex: 1, display: 'flex', overflowY: 'auto' }}>
          
          {/* Sol Sabit Görev Listesi */}
          <div style={{ width: '280px', flexShrink: 0, borderRight: '1px solid var(--border-main)', background: 'var(--bg-card)', zIndex: 10 }}>
            {notes.map(note => (
              <div 
                key={note.id} 
                onClick={() => onSelectNote(note)}
                style={{ 
                  height: '48px', 
                  borderBottom: '1px solid var(--border-main)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '0 16px', 
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                className="hover-bg-subtle"
                title={note.title}
              >
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                  {note.title}
                </div>
              </div>
            ))}
            {notes.length === 0 && (
               <div style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Henüz görev bulunmuyor.</div>
            )}
          </div>

          {/* Sağ Yatay Kaydırılabilir Grid ve Çubuklar */}
          <div 
            ref={bodyScrollRef} 
            onScroll={handleScroll} 
            style={{ flex: 1, overflowX: 'auto', position: 'relative' }}
          >
            <div style={{ width: `${days.length * COL_WIDTH}px`, height: '100%', position: 'relative' }}>
              
              {/* Arka Plan Grid Çizgileri */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', pointerEvents: 'none', zIndex: 0 }}>
                {days.map((d, i) => (
                  <div key={i} style={{ 
                    width: `${COL_WIDTH}px`, 
                    flexShrink: 0, 
                    borderRight: '1px solid var(--border-main)', 
                    background: [0, 6].includes(d.getDay()) ? 'rgba(255,255,255,0.015)' : 'transparent' 
                  }} />
                ))}
              </div>

              {/* Bugün İşaretçisi */}
              {(() => {
                const today = new Date();
                today.setHours(0,0,0,0);
                const offsetDays = Math.floor((today.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24));
                if (offsetDays >= 0 && offsetDays < days.length) {
                  return (
                    <div style={{ 
                      position: 'absolute', 
                      top: 0, 
                      bottom: 0, 
                      left: `${offsetDays * COL_WIDTH + (COL_WIDTH / 2)}px`, 
                      width: '2px', 
                      background: 'rgba(56, 189, 248, 0.4)', 
                      zIndex: 5, 
                      pointerEvents: 'none' 
                    }} />
                  );
                }
                return null;
              })()}
              
              {/* Görev Satırları ve Çubukları */}
              {notes.map(note => {
                const isDraggingThis = previewDates && previewDates.id === note.id;
                
                const currentStart = isDraggingThis ? previewDates.start : getNoteDates(note).start;
                const currentEnd = isDraggingThis ? previewDates.end : getNoteDates(note).end;
                
                const startOffsetDays = Math.floor((currentStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24));
                const durationDays = Math.max(1, Math.floor((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

                const left = startOffsetDays * COL_WIDTH;
                const width = durationDays * COL_WIDTH;
                const colors = getStatusColors(note.status);

                return (
                  <div key={note.id} style={{ height: '48px', borderBottom: '1px solid var(--border-main)', position: 'relative', zIndex: isDraggingThis ? 10 : 2 }}>
                    
                    {/* Gantt Çubuğu */}
                    <div 
                      onClick={(e) => {
                        // Eğer sürükleme olmadıysa (sadece tıklama) detay panelini aç
                        if (!draggingNote) onSelectNote(note);
                      }}
                      style={{ 
                        position: 'absolute', 
                        top: '8px', 
                        left: `${left + 4}px`, 
                        width: `${Math.max(COL_WIDTH - 8, width - 8)}px`, 
                        height: '32px', 
                        background: colors.bg,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: colors.text,
                        cursor: 'pointer',
                        boxShadow: isDraggingThis ? '0 8px 20px rgba(0,0,0,0.3)' : '0 2px 5px rgba(0,0,0,0.1)',
                        transition: isDraggingThis ? 'none' : 'transform 0.1s, left 0.2s, width 0.2s',
                        opacity: isDraggingThis ? 0.9 : 1
                      }}
                      title={`${note.title} (${durationDays} gün)\nBaşlangıç: ${currentStart.toLocaleDateString('tr-TR')}\nBitiş: ${currentEnd.toLocaleDateString('tr-TR')}`}
                      onMouseEnter={(e) => !draggingNote && (e.currentTarget.style.transform = 'scale(1.02)')}
                      onMouseLeave={(e) => !draggingNote && (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      {/* Left Resize Handle */}
                      <div 
                        onMouseDown={(e) => handleEdgeMouseDown(e, note, 'start')}
                        style={{ width: '8px', height: '100%', cursor: 'ew-resize', flexShrink: 0, opacity: 0.5, background: 'rgba(255,255,255,0.2)' }}
                      />

                      <div style={{ padding: '0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, pointerEvents: 'none' }}>
                        {note.title}
                      </div>

                      {/* Right Resize Handle */}
                      <div 
                        onMouseDown={(e) => handleEdgeMouseDown(e, note, 'end')}
                        style={{ width: '8px', height: '100%', cursor: 'ew-resize', flexShrink: 0, opacity: 0.5, background: 'rgba(255,255,255,0.2)' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
        </div>
      </div>
    </div>

    {/* Shown instead of the chart below 768px — a mouse-drag timeline doesn't fit a phone screen */}
    <div className="gantt-mobile-notice" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100dvh - 70px)', padding: '24px', textAlign: 'center', color: 'var(--text-muted)', gap: '10px' }}>
      <Calendar size={28} style={{ color: 'var(--text-muted)' }} />
      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Gantt görünümü küçük ekranlarda kullanılamıyor</div>
      <div style={{ fontSize: '0.85rem', maxWidth: '280px' }}>Zaman çizelgesini görüntülemek için lütfen tablet veya masaüstü kullanın.</div>
    </div>
    </>
  );
}
