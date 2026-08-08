import React, { useRef, useEffect, useState } from 'react';
import { Calendar, Clock, AlertCircle } from 'lucide-react';

// Basit bir string hash fonksiyonu - notların hep aynı günde kalmasını sağlamak için
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

export default function GanttView({ notes, onSelectNote }) {
  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);

  const [days, setDays] = useState([]);
  const [todayIndex, setTodayIndex] = useState(5);
  
  // Sütun genişliği
  const COL_WIDTH = 40;

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    // Bugünün tarihinden 5 gün öncesinden başlat
    startDate.setDate(today.getDate() - 5);

    const generatedDays = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      generatedDays.push(d);
    }
    setDays(generatedDays);
    
    // Sayfa açılışında bugüne doğru hafif kaydır (örnek olarak biraz sağa)
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollLeft = 2 * COL_WIDTH; 
    }
  }, []);

  const handleScroll = (e) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  const getStatusColors = (status) => {
    switch (status) {
      case 'In Progress': return { bg: 'var(--status-progress-bg)', border: 'var(--status-progress-border)', text: 'var(--status-progress-text)' };
      case 'In Review': return { bg: 'var(--status-review-bg)', border: 'var(--status-review-border)', text: 'var(--status-review-text)' };
      case 'Done': return { bg: 'var(--status-done-bg)', border: 'var(--status-done-border)', text: 'var(--status-done-text)' };
      default: return { bg: 'var(--status-todo-bg)', border: 'var(--status-todo-border)', text: 'var(--status-todo-text)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)', padding: '16px', background: 'var(--bg-main)' }}>
      
      {/* Üst Başlık & Bilgi */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Calendar size={18} style={{ color: 'var(--accent-blue)' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>Proje Zaman Çizelgesi (Gantt Chart)</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px' }}>
          <AlertCircle size={14} />
          <span>Gantt çubukları mevcut şemada tarihler olmadığı için görsel simülasyondur.</span>
        </div>
      </div>

      {/* Gantt Tablosu Ana Kapsayıcı */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid var(--border-main)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)' }}>
        
        {/* Tablo Header (Sol Görevler Başlığı + Sağ Tarihler) */}
        <div style={{ display: 'flex', height: '46px', borderBottom: '1px solid var(--border-main)', background: 'rgba(0,0,0,0.2)' }}>
          {/* Sol Sabit Başlık */}
          <div style={{ width: '280px', flexShrink: 0, borderRight: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', padding: '0 16px', fontWeight: 600, fontSize: '0.85rem' }}>
            Görev Adı
          </div>
          
          {/* Sağ Yatay Kaydırılabilir Tarih Header'ı */}
          <div ref={headerScrollRef} style={{ flex: 1, overflowX: 'hidden', display: 'flex' }}>
            <div style={{ display: 'flex', width: `${days.length * COL_WIDTH}px` }}>
              {days.map((d, i) => {
                const isToday = i === todayIndex;
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

        {/* Tablo Gövdesi (Sol Görev Listesi + Sağ Grid/Çubuklar) */}
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

              {/* Bugün İşaretçisi (Dikey Çizgi) */}
              <div style={{ 
                position: 'absolute', 
                top: 0, 
                bottom: 0, 
                left: `${todayIndex * COL_WIDTH + (COL_WIDTH / 2)}px`, 
                width: '2px', 
                background: 'rgba(56, 189, 248, 0.4)', 
                zIndex: 5, 
                pointerEvents: 'none' 
              }} />
              
              {/* Görev Satırları ve Çubukları */}
              {notes.map(note => {
                // Her görev için stabil ama rastgele görünen simüle edilmiş başlangıç ve süre
                const hash = hashString(note.id);
                // 35 günlük timeline. Rastgele başlama (0-15. günler arası)
                const startOffset = hash % 15; 
                // Süre (3 - 10 gün arası)
                const duration = (hash % 8) + 3; 

                const left = startOffset * COL_WIDTH;
                const width = duration * COL_WIDTH;
                const colors = getStatusColors(note.status);

                return (
                  <div key={note.id} style={{ height: '48px', borderBottom: '1px solid var(--border-main)', position: 'relative', zIndex: 2 }}>
                    
                    {/* Gantt Çubuğu */}
                    <div 
                      onClick={() => onSelectNote(note)}
                      style={{ 
                        position: 'absolute', 
                        top: '8px', 
                        left: `${left + 4}px`, 
                        width: `${width - 8}px`, 
                        height: '32px', 
                        background: colors.bg,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: colors.text,
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        transition: 'transform 0.1s',
                      }}
                      title={`${note.title} (${duration} gün)`}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      {note.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
