// Note content is stored as TEXT in the `notes.content` column. To support real
// interactive blocks (checkboxes, strikethrough, per-block color) without a schema
// change, we serialize a block array as JSON into that same column. Legacy notes
// (plain markdown-ish text written by the old textarea) are parsed on the fly.

let idCounter = 0;
const genId = () => `blk-${Date.now()}-${idCounter++}`;

export const BLOCK_TYPES = ['text', 'heading', 'todo', 'quote', 'code'];

const makeBlock = (overrides = {}) => ({
  id: genId(),
  type: 'text',
  text: '',
  checked: false,
  color: null,
  startDate: null,
  endDate: null,
  ...overrides
});

/**
 * Parses a note's stored `content` string into an array of blocks.
 * Accepts either our own JSON format ({ v: 1, blocks: [...] }) or legacy
 * markdown-ish plain text, which is converted line by line.
 */
export function parseContent(content) {
  if (!content || typeof content !== 'string' || content.trim() === '') {
    return [makeBlock()];
  }

  const trimmed = content.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.v === 1 && Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
        return parsed.blocks.map(b => makeBlock({
          id: b.id || genId(),
          type: BLOCK_TYPES.includes(b.type) ? b.type : 'text',
          text: typeof b.text === 'string' ? b.text : '',
          checked: !!b.checked,
          color: b.color || null,
          startDate: b.startDate || null,
          endDate: b.endDate || null
        }));
      }
    } catch {
      // Not valid JSON despite looking like it — fall through to markdown parsing.
    }
  }

  const lines = content.split('\n');
  const blocks = [];
  let inCodeBlock = false;
  let codeBuffer = [];
  let lineCounter = 0;

  const flushCode = () => {
    lineCounter++;
    blocks.push(makeBlock({ id: `blk-c-${lineCounter}`, type: 'code', text: codeBuffer.join('\n') }));
    codeBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        flushCode();
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    lineCounter++;
    const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
    const todoMatch = line.match(/^[-*]\s+\[( |x|X)\]\s*(.*)$/);
    const quoteMatch = line.match(/^>\s?(.*)$/);

    if (headingMatch) {
      blocks.push(makeBlock({ id: `blk-h-${lineCounter}`, type: 'heading', text: headingMatch[1] }));
    } else if (todoMatch) {
      blocks.push(makeBlock({ id: `blk-t-${lineCounter}`, type: 'todo', text: todoMatch[2], checked: todoMatch[1].toLowerCase() === 'x' }));
    } else if (quoteMatch) {
      blocks.push(makeBlock({ id: `blk-q-${lineCounter}`, type: 'quote', text: quoteMatch[1].replace(/^\*\*Önemli Not:\*\*\s*/, '') }));
    } else if (line.trim() === '') {
      // Skip blank separator lines rather than creating empty text blocks for each one.
      continue;
    } else {
      blocks.push(makeBlock({ id: `blk-txt-${lineCounter}`, type: 'text', text: line }));
    }
  }

  if (inCodeBlock && codeBuffer.length > 0) {
    flushCode();
  }

  return blocks.length > 0 ? blocks : [makeBlock()];
}

/** Serializes a block array back into the string stored in `notes.content`. */
export function serializeBlocks(blocks) {
  const clean = (blocks && blocks.length > 0 ? blocks : [makeBlock()]).map(b => ({
    id: b.id,
    type: b.type,
    text: b.text,
    checked: !!b.checked,
    color: b.color || null,
    startDate: b.startDate || null,
    endDate: b.endDate || null
  }));
  return JSON.stringify({ v: 1, blocks: clean });
}

/** Flattens blocks into plain text, e.g. for hover previews or search matching. */
export function blocksToPlainText(blocks) {
  return blocks
    .map(b => b.text || '')
    .filter(t => t.trim() !== '')
    .join('\n');
}

export function createBlock(overrides) {
  return makeBlock(overrides);
}
