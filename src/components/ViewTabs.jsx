import React from 'react';
import { Columns3, Star, BarChart3 } from 'lucide-react';

/**
 * The "Duruma Göre / Tüm Projeler / Gantt" view switcher shown at the top
 * of every view. Extracted so the topbar isn't hand-copied in three places
 * (TableView, and the by-status/gantt branches in App.jsx) — each copy used
 * to need the same mobile-iconization fix applied three times over.
 *
 * Labels are wrapped in `.view-tab-label` so mobile CSS (index.css) can hide
 * the text and keep only the icon, and `title` carries the label for anyone
 * who hovers/long-presses.
 */
export default function ViewTabs({ activeView, setActiveView }) {
  return (
    <div className="notion-views-tab">
      <button
        className={`view-tab-btn ${activeView === 'by-status' ? 'active' : ''}`}
        onClick={() => setActiveView('by-status')}
        title="Duruma Göre"
      >
        <Columns3 size={14} />
        <span className="view-tab-label">Duruma Göre</span>
      </button>

      <button
        className={`view-tab-btn ${activeView === 'all-projects' ? 'active' : ''}`}
        onClick={() => setActiveView('all-projects')}
        title="Tüm Projeler"
      >
        <Star size={14} style={{ fill: '#eab308', color: '#eab308' }} />
        <span className="view-tab-label">Tüm Projeler</span>
      </button>

      <button
        className={`view-tab-btn ${activeView === 'gantt' ? 'active' : ''}`}
        onClick={() => setActiveView('gantt')}
        title="Gantt"
      >
        <BarChart3 size={14} />
        <span className="view-tab-label">Gantt</span>
      </button>
    </div>
  );
}
