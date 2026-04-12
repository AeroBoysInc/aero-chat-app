// src/components/servers/toolkits/worldmap/WorldMapTab.tsx
import { memo, useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useAuthStore } from '../../../../store/authStore';
import { useServerStore } from '../../../../store/serverStore';
import { useServerRoleStore } from '../../../../store/serverRoleStore';
import { useDndMapStore } from '../../../../store/dndMapStore';
import type { DndMapPin } from '../../../../lib/serverTypes';
import type { PinTypePreset } from '../../../../lib/pinTypePresets';
import { MapViewer } from './MapViewer';
import { MapSwitcher } from './MapSwitcher';
import { MapManager } from './MapManager';
import { PinPopup } from './PinPopup';

// Lazy load PinEditor (includes heavy Tiptap deps)
const PinEditor = lazy(() => import('./PinEditor').then(m => ({ default: m.PinEditor })));

export const WorldMapTab = memo(function WorldMapTab() {
  const user = useAuthStore(s => s.user);
  const { selectedServerId, members } = useServerStore();
  const { hasPermission } = useServerRoleStore();
  const {
    visibleMaps, pins, activeMapId, loading,
    loadMaps, loadPins, setActiveMap, deletePin, updatePin, subscribeRealtime, reset,
  } = useDndMapStore();

  const isDm = user && selectedServerId
    ? hasPermission(selectedServerId, user.id, members, 'dungeon_master')
    : false;

  const userRoleIds = user && selectedServerId
    ? members.filter(m => m.user_id === user.id).map(m => m.role_id)
    : [];

  // Load maps + subscribe realtime
  useEffect(() => {
    if (!selectedServerId || !user) return;
    loadMaps(selectedServerId, user.id, isDm, userRoleIds);
    const unsub = subscribeRealtime(selectedServerId);
    return () => { unsub(); reset(); };
  }, [selectedServerId, user?.id]);

  // Load pins when active map changes
  useEffect(() => {
    if (activeMapId) loadPins(activeMapId);
  }, [activeMapId]);

  const activeMap = visibleMaps.find(m => m.id === activeMapId);
  const activePins = (activeMapId ? pins[activeMapId] : null) ?? [];

  // UI state
  const [popupPin, setPopupPin] = useState<DndMapPin | null>(null);
  const [editorState, setEditorState] = useState<{
    pin?: DndMapPin;
    coords?: { x: number; y: number };
    preset?: PinTypePreset;
  } | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);

  const handlePinClick = useCallback((pin: DndMapPin) => setPopupPin(pin), []);

  const handleAddPin = useCallback((x: number, y: number, preset: PinTypePreset) => {
    setEditorState({ coords: { x, y }, preset });
  }, []);

  const handleEditPin = useCallback((pin: DndMapPin) => {
    setPopupPin(null);
    setEditorState({ pin });
  }, []);

  const handleDeletePin = useCallback(async (pin: DndMapPin) => {
    await deletePin(pin.id);
    setPopupPin(null);
  }, [deletePin]);

  const handlePinMove = useCallback((pin: DndMapPin, newX: number, newY: number) => {
    updatePin(pin.id, { x: newX, y: newY });
  }, [updatePin]);

  // Empty state — no maps yet
  if (!loading && visibleMaps.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div style={{ fontSize: 48, marginBottom: 8, opacity: 0.3 }}>🗺️</div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tk-text, var(--text-primary))', marginBottom: 4 }}>
          No maps yet
        </p>
        <p style={{ fontSize: 11, color: 'var(--tk-text-muted, var(--text-muted))', maxWidth: 260, marginBottom: 16 }}>
          {isDm ? 'Upload a world map to get started.' : 'The DM hasn\'t uploaded any maps yet.'}
        </p>
        {isDm && (
          <button
            onClick={() => setManagerOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #8B4513, #D2691E)',
              border: 'none', color: '#fff', cursor: 'pointer',
            }}
          >
            Upload Map
          </button>
        )}
        {managerOpen && selectedServerId && (
          <MapManager serverId={selectedServerId} maps={[]} onClose={() => setManagerOpen(false)} />
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p style={{ fontSize: 12, color: 'var(--tk-text-muted, var(--text-muted))' }}>Loading maps…</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {activeMap && (
        <MapViewer
          imageUrl={activeMap.image_url}
          pins={activePins}
          isDm={isDm}
          onPinClick={handlePinClick}
          onAddPin={handleAddPin}
          onPinMove={handlePinMove}
        />
      )}

      {/* Map switcher — HUD overlay */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 16 }}>
        <div style={{ pointerEvents: 'all' }}>
          <MapSwitcher
            maps={visibleMaps}
            activeMapId={activeMapId}
            isDm={isDm}
            onSelectMap={setActiveMap}
            onOpenManager={() => setManagerOpen(true)}
          />
        </div>
      </div>

      {/* Pin popup */}
      {popupPin && (
        <PinPopup
          pin={popupPin}
          isDm={isDm}
          onClose={() => setPopupPin(null)}
          onEdit={handleEditPin}
          onDelete={handleDeletePin}
        />
      )}

      {/* Pin editor (lazy loaded) */}
      {editorState && selectedServerId && activeMapId && (
        <Suspense fallback={null}>
          <PinEditor
            mapId={activeMapId}
            serverId={selectedServerId}
            coords={editorState.coords}
            preset={editorState.preset}
            existingPin={editorState.pin}
            onClose={() => setEditorState(null)}
          />
        </Suspense>
      )}

      {/* Map manager modal */}
      {managerOpen && selectedServerId && (
        <MapManager
          serverId={selectedServerId}
          maps={visibleMaps}
          onClose={() => setManagerOpen(false)}
        />
      )}
    </div>
  );
});
