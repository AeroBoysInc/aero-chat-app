import { memo, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useServerStore } from '../../../store/serverStore';
import { useServerRoleStore } from '../../../store/serverRoleStore';
import { useDndCharacterStore } from '../../../store/dndCharacterStore';
import type { DndCharacter } from '../../../lib/serverTypes';
import { CharacterCard } from './CharacterCard';
import { CharacterSheet } from './CharacterSheet';
import { CreateCharacterModal } from './CreateCharacterModal';

export const CharactersTab = memo(function CharactersTab() {
  const user = useAuthStore(s => s.user);
  const { selectedServerId, members } = useServerStore();
  const { hasPermission } = useServerRoleStore();
  const { characters, loading, loadCharacters, subscribeRealtime } = useDndCharacterStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [inspecting, setInspecting] = useState<DndCharacter | null>(null);

  useEffect(() => {
    if (!selectedServerId) return;
    loadCharacters(selectedServerId);
    const unsub = subscribeRealtime(selectedServerId);
    return unsub;
  }, [selectedServerId]);

  const myChar = characters.find(c => c.user_id === user?.id);
  const isDm = user && selectedServerId
    ? hasPermission(selectedServerId, user.id, members, 'dungeon_master')
    : false;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--tk-border, var(--panel-divider))' }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--tk-text, var(--text-primary))', margin: 0 }}>
            Characters
          </h3>
          <p style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))', margin: '2px 0 0' }}>
            {characters.length} character{characters.length !== 1 ? 's' : ''} in this server
          </p>
        </div>
        {!myChar && (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #8B4513, #D2691E)',
              border: 'none', color: '#fff', cursor: 'pointer',
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Create Character
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && characters.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p style={{ fontSize: 12, color: 'var(--tk-text-muted, var(--text-muted))' }}>Loading characters…</p>
          </div>
        ) : characters.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div style={{ fontSize: 48, marginBottom: 8, opacity: 0.3 }}>🃏</div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tk-text, var(--text-primary))', marginBottom: 4 }}>
              No characters yet
            </p>
            <p style={{ fontSize: 11, color: 'var(--tk-text-muted, var(--text-muted))', maxWidth: 260, marginBottom: 16 }}>
              Upload your D&D Beyond character sheet PDF or create a character manually to get started.
            </p>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg, #8B4513, #D2691E)',
                border: 'none', color: '#fff', cursor: 'pointer',
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Character
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {characters.map(char => {
              const member = members.find(m => m.user_id === char.user_id);
              const charIsDm = char.user_id && selectedServerId
                ? hasPermission(selectedServerId, char.user_id, members, 'dungeon_master')
                : false;
              return (
                <CharacterCard
                  key={char.id}
                  character={char}
                  member={member}
                  isDm={charIsDm}
                  onClick={() => setInspecting(char)}
                />
              );
            })}

            {!myChar && (
              <button
                onClick={() => setCreateOpen(true)}
                className="w-full rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  padding: 14, border: '2px dashed var(--tk-border, var(--panel-divider))',
                  background: 'transparent', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, color: 'var(--tk-text-muted, var(--text-muted))',
                }}
              >
                + Create your character
              </button>
            )}
          </div>
        )}
      </div>

      {createOpen && <CreateCharacterModal onClose={() => setCreateOpen(false)} />}
      {inspecting && (
        <CharacterSheet
          character={inspecting}
          member={members.find(m => m.user_id === inspecting.user_id)}
          isDm={isDm}
          isOwn={inspecting.user_id === user?.id}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
});
