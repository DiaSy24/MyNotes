import React from 'react';
import { Trash2, RotateCcw, AlertTriangle, Sparkles } from 'lucide-react';

export default function TrashView({ 
  trashNotes, 
  onRestoreNote, 
  onPermanentlyDeleteNote, 
  onEmptyTrash 
}) {
  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: 'calc(100vh - 70px)' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trash2 size={20} style={{ color: '#ef4444' }} />
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>Geri Dönüşüm Kutusu</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Silinen notlar burada saklanır. İstediğiniz zaman geri yükleyebilir veya kalıcı olarak silebilirsiniz.
              </p>
            </div>
          </div>

          {trashNotes.length > 0 && (
            <button 
              onClick={onEmptyTrash}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Trash2 size={14} /> Çöpü Tamamen Temizle ({trashNotes.length})
            </button>
          )}
        </div>

        {trashNotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', border: '1px dashed var(--border-main)', borderRadius: '8px' }}>
            <Sparkles size={32} style={{ marginBottom: '10px', color: 'var(--text-muted)' }} />
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Geri Dönüşüm Kutusu Boş</div>
            <div style={{ fontSize: '0.8rem' }}>Silinen herhangi bir not bulunmuyor.</div>
          </div>
        ) : (
          <table className="notion-table">
            <thead>
              <tr>
                <th style={{ width: '45%' }}>Silinen Öğe</th>
                <th style={{ width: '20%' }}>Silinme Tarihi</th>
                <th style={{ width: '15%' }}>Tür</th>
                <th style={{ width: '20%', textAlign: 'right' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {trashNotes.map((note) => (
                <tr key={note.id}>
                  <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                    {note.type === 'workspace' && <span style={{ marginRight: '6px' }}>{note.icon || '📁'}</span>}
                    {note.title || note.name}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {note.deletedAt ? new Date(note.deletedAt).toLocaleString('tr-TR') : 'Bilinmiyor'}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.78rem', background: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                      {note.type === 'workspace' ? 'Çalışma Alanı' : 'Not'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      <button 
                        onClick={() => onRestoreNote(note.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'rgba(34, 197, 94, 0.15)',
                          color: '#4ade80',
                          border: '1px solid rgba(34, 197, 94, 0.3)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <RotateCcw size={13} /> Geri Yükle
                      </button>

                      <button 
                        onClick={() => onPermanentlyDeleteNote(note.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={13} /> Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
