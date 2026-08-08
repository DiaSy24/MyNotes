import React, { useRef, useState } from 'react';
import { X, Cloud, Download, Upload, Trash2, LogOut, Loader2, User } from 'lucide-react';
import { exportDataJSON, importDataJSON, clearAllData } from '../services/storageService';
import { supabase } from '../services/supabaseClient';

export default function AuthModal({ 
  isOpen, 
  onClose, 
  session, 
  onDisconnectDrive // We will rename this concept to onLogout later, but keep prop name for compatibility
}) {
  const fileInputRef = useRef(null);
  
  const [authMode, setAuthMode] = useState('signin'); // 'signin' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const formattedEmail = email.trim().includes('@') ? email.trim() : `${email.trim()}@mynotes.app`;

    try {
      if (authMode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formattedEmail,
          password: password,
        });
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setErrorMsg('Kullanıcı adı veya şifre hatalı. Hesabınız yoksa "Kayıt Ol" sekmesini deneyin.');
          } else {
            setErrorMsg(error.message);
          }
        } else {
          onClose();
        }
      } else {
        // Sign up mode
        if (password.length < 6) {
          setErrorMsg('Şifreniz en az 6 karakter olmalıdır.');
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: formattedEmail,
          password: password,
        });

        if (error) {
          setErrorMsg(error.message);
        } else if (data.user && !data.session) {
          setErrorMsg('Kayıt başarılı! Ancak Supabase e-posta onayı gerektiriyor olabilir.');
        } else {
          // Logged in via signup
          onClose();
        }
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        await importDataJSON(file);
        alert('Yedek veriler başarıyla yüklendi!');
        window.location.reload();
      } catch (err) {
        alert('Yedek yüklenirken hata oluştu: ' + err.message);
      }
    }
  };

  const handleResetData = () => {
    if (window.confirm('Tüm notlarınız ve verileriniz sıfırlanacak. Emin misiniz?')) {
      clearAllData();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <Cloud size={18} style={{ color: '#8b5cf6' }} />
            <span>Bulut Senkronizasyonu (Supabase)</span>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Auth Section */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-main)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={16} style={{ color: '#8b5cf6' }} />
            Kullanıcı Hesabı
          </div>

          {session ? (
            <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img 
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`} 
                    alt="Avatar" 
                    style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#202020' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#a78bfa' }}>
                      Bağlı Hesap
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {session.user.email.replace('@mynotes.app', '')}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={async () => {
                    await supabase.auth.signOut();
                    if (onDisconnectDrive) onDisconnectDrive();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <LogOut size={13} /> Çıkış Yap
                </button>
              </div>

              <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '8px' }}>
                ✓ Supabase veritabanı aktif. Verileriniz canlı senkronize ediliyor.
              </div>
            </div>
          ) : (
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Tab Selector */}
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(0, 0, 0, 0.2)', padding: '3px', borderRadius: '6px' }}>
                <button 
                  type="button"
                  onClick={() => { setAuthMode('signin'); setErrorMsg(''); }}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: '4px',
                    border: 'none',
                    background: authMode === 'signin' ? '#8b5cf6' : 'transparent',
                    color: authMode === 'signin' ? '#fff' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Giriş Yap
                </button>
                <button 
                  type="button"
                  onClick={() => { setAuthMode('signup'); setErrorMsg(''); }}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: '4px',
                    border: 'none',
                    background: authMode === 'signup' ? '#8b5cf6' : 'transparent',
                    color: authMode === 'signup' ? '#fff' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Kayıt Ol
                </button>
              </div>

              {errorMsg && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '8px 10px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  {errorMsg}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Kullanıcı Adı veya E-posta</label>
                <input 
                  type="text" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Kullanıcı adınız..."
                  required
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-main)',
                    color: 'var(--text-main)',
                    padding: '10px',
                    borderRadius: '6px',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Şifre {authMode === 'signup' && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(en az 6 karakter)</span>}
                </label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-main)',
                    color: 'var(--text-main)',
                    padding: '10px',
                    borderRadius: '6px',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  background: '#8b5cf6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  marginTop: '4px'
                }}
              >
                {loading ? <Loader2 size={16} className="spin-loader" /> : (authMode === 'signin' ? 'Giriş Yap' : 'Kayıt Ol ve Giriş Yap')}
              </button>
            </form>
          )}
        </div>

        {/* Data Backup / Export / Import / Reset */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-main)', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '10px' }}>
            Yerel Yedekleme & Veri Yönetimi
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={exportDataJSON}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-main)',
                borderRadius: '6px',
                padding: '8px',
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              <Download size={14} /> Dışa Aktar
            </button>

            <button 
              onClick={() => fileInputRef.current?.click()}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-main)',
                borderRadius: '6px',
                padding: '8px',
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              <Upload size={14} /> İçe Aktar
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportFile} 
              accept=".json" 
              style={{ display: 'none' }} 
            />
          </div>

          <button 
            onClick={handleResetData}
            style={{
              marginTop: '10px',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '6px',
              padding: '6px',
              fontSize: '0.78rem',
              cursor: 'pointer'
            }}
          >
            <Trash2 size={13} /> Tüm Verileri Temizle & Sıfırla
          </button>
        </div>
      </div>
    </div>
  );
}
