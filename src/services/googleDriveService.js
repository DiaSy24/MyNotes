// Google Drive API & OAuth2 Account Connection Service

export const openGoogleOAuthPopup = () => {
  return new Promise((resolve, reject) => {
    const width = 500;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // Use a placeholder client ID so it opens the REAL Google OAuth screen
    // (This will trigger the 401 error screen exactly as the user requested to see)
    const clientId = '123456789-placeholder.apps.googleusercontent.com';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(window.location.origin)}&` +
      `response_type=token&` +
      `scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile')}&` +
      `prompt=select_account`;

    const req = window.nodeRequire || (typeof window !== 'undefined' && window.require);
    if (req) {
      try {
        const { shell } = req('electron');
        if (shell && shell.openExternal) {
          shell.openExternal(authUrl);
          resolve({ openedExternally: true });
          return;
        }
      } catch (e) {
        console.warn('Could not load electron shell:', e);
      }
    }

    const popup = window.open(
      authUrl,
      'Google Account Selection',
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`
    );

    if (!popup) {
      reject(new Error('Popup engellendi.'));
      return;
    }

    // Since it goes to a 401 error page, the user can't actually authorize. 
    // We just watch for popup closure to resolve to avoid infinite hanging.
    const checkTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkTimer);
        
        // As requested previously, if they just close the 401 window, we simulate a connection
        // for testing purposes so they can see the app working.
        resolve({
          isConnected: true,
          user: { name: 'Bağlı Google Hesabı', email: 'ysaid4894@gmail.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ysaid4894' },
          lastSynced: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        });
      }
    }, 500);
  });
};
