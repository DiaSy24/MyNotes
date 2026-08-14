import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import PetCompanion from './components/PetCompanion.jsx';

const params = new URLSearchParams(window.location.search);
const isPetMode = params.get('mode') === 'pet';

if (isPetMode) {
  document.documentElement.classList.add('desktop-pet-window');
  document.body.classList.add('desktop-pet-window');
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <PetCompanion isDesktopWindow={true} />
    </StrictMode>
  );
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
