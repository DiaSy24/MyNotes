import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { parseContent, blocksToPlainText } from '../utils/noteBlocks';

const OPEN_DELAY = 400;
const CLOSE_DELAY = 120;
const PREVIEW_WIDTH = 320;
const PREVIEW_EST_HEIGHT = 180;

/**
 * Wraps a trigger element (e.g. a note title) and, after a short hover delay,
 * shows a floating preview of the note's content in a portal so it isn't
 * clipped by an ancestor's `overflow: auto`/`hidden` (as table/kanban containers have).
 */
export default function NoteHoverPreview({ note, children }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const openTimer = useRef(null);
  const closeTimer = useRef(null);

  const previewText = note ? blocksToPlainText(parseContent(note.content)).slice(0, 600) : '';
  const hasContent = previewText.trim() !== '';

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const handleMouseEnter = useCallback((e) => {
    if (!hasContent) return;
    clearTimers();
    const rect = e.currentTarget.getBoundingClientRect();
    openTimer.current = setTimeout(() => {
      setPos({ x: rect.left, y: rect.bottom + 8 });
      setVisible(true);
    }, OPEN_DELAY);
  }, [hasContent]);

  const handleMouseLeave = useCallback(() => {
    clearTimers();
    closeTimer.current = setTimeout(() => setVisible(false), CLOSE_DELAY);
  }, []);

  let left = pos.x;
  let top = pos.y;
  if (typeof window !== 'undefined') {
    if (left + PREVIEW_WIDTH > window.innerWidth - 12) left = window.innerWidth - PREVIEW_WIDTH - 12;
    if (left < 12) left = 12;
    if (top + PREVIEW_EST_HEIGHT > window.innerHeight - 12) top = pos.y - PREVIEW_EST_HEIGHT - 24;
  }

  return (
    <span
      style={{ display: 'contents' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && hasContent && createPortal(
        <div className="note-hover-preview" style={{ left, top }}>
          <div className="note-hover-preview-title">{note.title}</div>
          <div className="note-hover-preview-body">{previewText}</div>
        </div>,
        document.body
      )}
    </span>
  );
}
