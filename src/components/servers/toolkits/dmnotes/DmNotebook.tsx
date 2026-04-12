// src/components/servers/toolkits/dmnotes/DmNotebook.tsx
import { memo, useEffect, useState, lazy, Suspense } from 'react';
import { Plus, FileText } from 'lucide-react';
import { useAuthStore } from '../../../../store/authStore';
import { useServerStore } from '../../../../store/serverStore';
import { useDndDmNotesStore } from '../../../../store/dndDmNotesStore';

const DmNoteEditor = lazy(() => import('./DmNoteEditor').then(m => ({ default: m.DmNoteEditor })));

function stripHtml(html: string): string {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
}

export const DmNotebook = memo(function DmNotebook() {
  const user = useAuthStore(s => s.user);
  const { selectedServerId } = useServerStore();
  const { notes, loading, loadNotes, createNote, updateNote, deleteNote, reset } = useDndDmNotesStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedServerId) return;
    loadNotes(selectedServerId);
    return () => { reset(); setActiveId(null); };
  }, [selectedServerId]);

  const activeNote = notes.find(n => n.id === activeId) ?? null;

  const handleCreate = async () => {
    if (!selectedServerId || !user) return;
    const { note } = await createNote({ server_id: selectedServerId, created_by: user.id, title: 'Untitled' });
    if (note) setActiveId(note.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this note? This cannot be undone.')) return;
    await deleteNote(id);
    setActiveId(null);
  };

  // Editor view
  if (activeNote) {
    return (
      <Suspense fallback={<div className="flex h-full items-center justify-center"><p style={{ fontSize: 12, color: 'var(--tk-text-muted, var(--text-muted))' }}>Loading editor…</p></div>}>
        <DmNoteEditor
          note={activeNote}
          onTitleChange={(title) => updateNote(activeNote.id, { title })}
          onContentChange={(content) => updateNote(activeNote.id, { content })}
          onBack={() => setActiveId(null)}
          onDelete={() => handleDelete(activeNote.id)}
        />
      </Suspense>
    );
  }

  // List view
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--tk-border, var(--panel-divider))' }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--tk-gold, #FFD700)', margin: 0, fontFamily: 'Georgia, serif' }}>
            DM Notebook
          </h3>
          <p style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))', margin: '2px 0 0' }}>
            {notes.length} note{notes.length !== 1 ? 's' : ''} · visible only to DMs
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97]"
          style={{
            background: 'linear-gradient(135deg, #8B4513, #D2691E)',
            border: 'none', color: '#fff', cursor: 'pointer',
          }}
        >
          <Plus className="h-3.5 w-3.5" /> New Note
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && notes.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p style={{ fontSize: 12, color: 'var(--tk-text-muted, var(--text-muted))' }}>Loading notes…</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div style={{ fontSize: 48, marginBottom: 8, opacity: 0.3 }}>📖</div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tk-text, var(--text-primary))', marginBottom: 4, fontFamily: 'Georgia, serif' }}>
              No notes yet
            </p>
            <p style={{ fontSize: 11, color: 'var(--tk-text-muted, var(--text-muted))', maxWidth: 260 }}>
              Keep private plot threads, NPC backstories, and session prep in one place.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {notes.map(note => {
              const preview = stripHtml(note.content);
              return (
                <button
                  key={note.id}
                  onClick={() => setActiveId(note.id)}
                  className="w-full text-left rounded-[14px] transition-all active:scale-[0.99] hover:brightness-110"
                  style={{
                    padding: 14,
                    background: 'linear-gradient(145deg, rgba(245,228,188,0.06), rgba(139,69,19,0.05))',
                    border: '1px solid rgba(139,69,19,0.25)',
                    cursor: 'pointer',
                    display: 'block',
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--tk-gold, #FFD700)', marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{
                        margin: 0, fontSize: 13, fontWeight: 700,
                        color: 'var(--tk-text, var(--text-primary))',
                        fontFamily: 'Georgia, serif',
                      }}>
                        {note.title}
                      </h4>
                      {preview && (
                        <p style={{
                          margin: '4px 0 0',
                          fontSize: 11, lineHeight: 1.5,
                          color: 'var(--tk-text-muted, var(--text-muted))',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {preview}
                        </p>
                      )}
                      <p style={{ margin: '6px 0 0', fontSize: 9, color: 'rgba(201,183,138,0.55)', fontWeight: 600 }}>
                        Updated {new Date(note.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
