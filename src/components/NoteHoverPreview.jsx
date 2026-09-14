import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { parseContent, blocksToPlainText } from '../utils/noteBlocks';

const OPEN_DELAY = 400;
const CLOSE_DELAY = 120;
const PREVIEW_WIDTH = 320;
const PREVIEW_EST_HEIGHT = 180;
const CURSOR_OFFSET_X = 16;
const CURSOR_OFFSET_Y = 18;

/**
 * Wraps a trigger element (e.g. a note title) and, after a short hover delay,
 * shows a floating preview of the note's content next to the cursor, in a
 * portal so it isn't clipped by an ancestor's `overflow: auto`/`hidden` (as
 * table/kanban containers have). Desktop (mouse) only — on touch devices
 * there is no persistent cursor position for this to follow, so it never
 * opens there.
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

  const isMouseLike = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return false;
    if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(hover: hover)').matches) return false;
    return true;
  };

  const handlePointerEnter = useCallback((e) => {
    if (!hasContent || !isMouseLike(e)) return;
    clearTimers();
    const { clientX, clientY } = e;
    openTimer.current = setTimeout(() => {
      setPos({ x: clientX + CURSOR_OFFSET_X, y: clientY + CURSOR_OFFSET_Y });
      setVisible(true);
    }, OPEN_DELAY);
  }, [hasContent]);

  const handlePointerMove = useCallback((e) => {
    if (!hasContent || !isMouseLike(e)) return;
    if (visible) {
      setPos({ x: e.clientX + CURSOR_OFFSET_X, y: e.clientY + CURSOR_OFFSET_Y });
    }
  }, [hasContent, visible]);

  const handlePointerLeave = useCallback(() => {
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
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
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
