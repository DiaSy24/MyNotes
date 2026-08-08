import React, { useState } from 'react';
import { X, UserPlus, Loader2, UserMinus } from 'lucide-react';
import { addWorkspaceMember, removeWorkspaceMember } from '../services/storageService';

export default function MembersModal({ 
  isOpen, 
  onClose, 
  workspaceName, 
  workspaceId, 
  members, 
  refreshMembers 
}) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleAdd = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!email.trim() || !workspaceId) return;

    setIsSubmitting(true);
    const result = await addWorkspaceMember(workspaceId, email.trim());
    setIsSubmitting(false);

    if (result.success) {
      setSuccessMsg(`${email} çalışma alanına eklendi!`);
      setEmail('');
      refreshMembers(); // Refresh the parent's list
      setTimeout(() => setSuccessMsg(''), 3000);
    } else {
      setErrorMsg(result.error || 'Eklenemedi.');
    }
  };

  const handleRemove = async (memberId) => {
    if (window.confirm('Bu üyeyi çalışma alanından çıkarmak istediğinize emin misiniz?')) {
      const success = await removeWorkspaceMember(memberId);
      if (success) {
        refreshMembers();
      } else {
        alert('Üye çıkarılırken bir hata oluştu.');
      }
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '450px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Üyeleri Yönet: {workspaceName}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <input 
            type="email" 
            placeholder="Kullanıcı E-Posta Adresi" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-main)',
              color: 'var(--text-main)',
              padding: '8px 12px',
              borderRadius: '6px',
              outline: 'none',
              fontSize: '0.9rem'
            }}
          />
          <button 
            type="submit"
            disabled={isSubmitting}
            style={{
              background: '#2eaadc',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '0 16px',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isSubmitting ? <Loader2 size={16} className="spin-loader" /> : <UserPlus size={16} />}
            Ekle
          </button>
        </form>

        {errorMsg && <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '16px', background: 'rgba(248, 113, 113, 0.1)', padding: '8px', borderRadius: '4px' }}>{errorMsg}</div>}
        {successMsg && <div style={{ color: '#4ade80', fontSize: '0.85rem', marginBottom: '16px', background: 'rgba(74, 222, 128, 0.1)', padding: '8px', borderRadius: '4px' }}>{successMsg}</div>}

        <div>
          <h3 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>Mevcut Üyeler ({members.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {members.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
                    {m.email[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: '0.9rem' }}>{m.email}</span>
                </div>
                <button 
                  className="icon-btn" 
                  title="Üyeyi Çıkar"
                  onClick={() => handleRemove(m.id)}
                  style={{ color: '#f87171' }}
                >
                  <UserMinus size={16} />
                </button>
              </div>
            ))}
            {members.length === 0 && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Bu çalışma alanına henüz kimse eklenmedi.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
