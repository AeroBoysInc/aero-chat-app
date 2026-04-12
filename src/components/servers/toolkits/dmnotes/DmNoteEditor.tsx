// src/components/servers/toolkits/dmnotes/DmNoteEditor.tsx
import { memo, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, Heading1, Heading2, Heading3, Link as LinkIcon,
  ArrowLeft, Trash2,
} from 'lucide-react';
import type { DndDmNote } from '../../../../lib/serverTypes';

export const DmNoteEditor = memo(function DmNoteEditor({
  note,
  onTitleChange,
  onContentChange,
  onBack,
  onDelete,
}: {
  note: DndDmNote;
  onTitleChange: (title: string) => void;
  onContentChange: (html: string) => void;
  onBack: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const titleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset title when switching notes
  useEffect(() => { setTitle(note.title); }, [note.id]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: note.content || '<p></p>',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (contentDebounce.current) clearTimeout(contentDebounce.current);
      contentDebounce.current = setTimeout(() => {
        onContentChange(html);
      }, 500);
    },
  }, [note.id]);

  // Keep editor content in sync when note switches
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== (note.content || '<p></p>')) {
      editor.commands.setContent(note.content || '<p></p>', { emitUpdate: false });
    }
  }, [note.id, editor]);

  useEffect(() => () => {
    if (titleDebounce.current) clearTimeout(titleDebounce.current);
    if (contentDebounce.current) clearTimeout(contentDebounce.current);
  }, []);

  const handleTitleInput = (v: string) => {
    setTitle(v);
    if (titleDebounce.current) clearTimeout(titleDebounce.current);
    titleDebounce.current = setTimeout(() => {
      onTitleChange(v.trim() || 'Untitled');
    }, 500);
  };

  const setLink = () => {
    const prev = editor?.getAttributes('link').href ?? '';
    const url = window.prompt('URL', prev);
    if (url === null) return;
    if (url === '') { editor?.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: 6, borderRadius: 8,
    background: active ? 'rgba(255,215,0,0.18)' : 'transparent',
    border: `1px solid ${active ? 'rgba(255,215,0,0.35)' : 'transparent'}`,
    color: active ? '#FFD700' : '#c9b78a', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  return (
    <div className="flex h-full flex-col" style={{ background: 'linear-gradient(180deg, rgba(30,22,12,0.50), rgba(20,14,8,0.50))' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(139,69,19,0.25)' }}>
        <button
          onClick={onBack}
          className="rounded-md p-1.5 transition-colors hover:bg-white/5"
          style={{ border: 'none', background: 'transparent', color: '#c9b78a', cursor: 'pointer' }}
          title="Back to notes"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <input
          value={title}
          onChange={e => handleTitleInput(e.target.value)}
          placeholder="Untitled"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700,
            color: 'var(--tk-gold, #FFD700)',
          }}
        />
        <button
          onClick={onDelete}
          title="Delete note"
          className="rounded-md p-1.5 transition-colors hover:bg-red-500/10"
          style={{ border: 'none', background: 'transparent', color: '#c9b78a', cursor: 'pointer' }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Toolbar */}
      {editor && (
        <div className="flex items-center gap-1 px-3 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(139,69,19,0.18)', background: 'rgba(0,0,0,0.22)' }}>
          <button style={btnStyle(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><Bold className="h-3.5 w-3.5" /></button>
          <button style={btnStyle(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><Italic className="h-3.5 w-3.5" /></button>
          <button style={btnStyle(editor.isActive('underline'))} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><UnderlineIcon className="h-3.5 w-3.5" /></button>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />
          <button style={btnStyle(editor.isActive('heading', { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="H1"><Heading1 className="h-3.5 w-3.5" /></button>
          <button style={btnStyle(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="H2"><Heading2 className="h-3.5 w-3.5" /></button>
          <button style={btnStyle(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="H3"><Heading3 className="h-3.5 w-3.5" /></button>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />
          <button style={btnStyle(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list"><List className="h-3.5 w-3.5" /></button>
          <button style={btnStyle(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><ListOrdered className="h-3.5 w-3.5" /></button>
          <button style={btnStyle(editor.isActive('link'))} onClick={setLink} title="Link"><LinkIcon className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-y-auto px-6 py-5" style={{ background: 'rgba(245,228,188,0.02)' }}>
        <div
          className="dm-note-prose"
          style={{
            minHeight: '100%',
            fontFamily: 'Georgia, serif',
            fontSize: 14, lineHeight: 1.7, color: '#e8dfc8',
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
});
