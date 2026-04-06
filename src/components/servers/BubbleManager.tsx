// src/components/servers/BubbleManager.tsx
import { memo, useState, useCallback } from 'react';
import { Plus, Trash2, Lock, Unlock, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useServerStore } from '../../store/serverStore';
import { useServerRoleStore } from '../../store/serverRoleStore';

export const BubbleManager = memo(function BubbleManager() {
  const { selectedServerId, bubbles, loadServerData } = useServerStore();
  const { roles } = useServerRoleStore();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#00d4ff');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Non-owner roles (owner always has access, no need to toggle)
  const assignableRoles = roles.filter(r => !r.is_owner_role);

  const handleCreate = async () => {
    if (!selectedServerId || !newName.trim()) return;
    await supabase.from('bubbles').insert({
      server_id: selectedServerId, name: newName.trim(), color: newColor, restricted_to_roles: [],
    });
    await loadServerData(selectedServerId);
    setNewName('');
  };

  const handleDelete = async (bubbleId: string) => {
    await supabase.from('bubbles').delete().eq('id', bubbleId);
    if (selectedServerId) await loadServerData(selectedServerId);
  };

  const toggleRoleAccess = useCallback(async (bubbleId: string, roleId: string, currentRestrictions: string[]) => {
    setSaving(bubbleId);
    let updated: string[];
    if (currentRestrictions.length === 0) {
      // Currently open to all — switching to restricted: include all assignable roles EXCEPT the toggled one
      updated = assignableRoles.filter(r => r.id !== roleId).map(r => r.id);
    } else if (currentRestrictions.includes(roleId)) {
      // Remove this role
      updated = currentRestrictions.filter(id => id !== roleId);
    } else {
      // Add this role
      updated = [...currentRestrictions, roleId];
    }
    // If all assignable roles are included, revert to [] (open to all)
    if (updated.length >= assignableRoles.length) {
      updated = [];
    }
    await supabase.from('bubbles').update({ restricted_to_roles: updated }).eq('id', bubbleId);
    if (selectedServerId) await loadServerData(selectedServerId);
    setSaving(null);
  }, [assignableRoles, selectedServerId]);

  const isRoleAllowed = (bubble: { restricted_to_roles: string[] }, roleId: string): boolean => {
    // Empty array = open to all
    return bubble.restricted_to_roles.length === 0 || bubble.restricted_to_roles.includes(roleId);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-aero px-3 py-1.5 text-xs"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', outline: 'none' }}
          placeholder="New bubble name..."
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 28, height: 28, border: 'none', cursor: 'pointer' }} />
        <button
          onClick={handleCreate}
          disabled={!newName.trim()}
          className="flex items-center gap-1 rounded-aero px-3 py-1.5 text-xs disabled:opacity-40"
          style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {bubbles.map(bubble => {
        const isExpanded = expandedId === bubble.id;
        const isRestricted = bubble.restricted_to_roles.length > 0;
        const isSaving = saving === bubble.id;

        return (
          <div key={bubble.id} className="overflow-hidden" style={{ borderRadius: 10, border: '1px solid var(--panel-divider)' }}>
            {/* Bubble row */}
            <div className="flex items-center gap-3 px-3 py-2">
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: bubble.color, flexShrink: 0 }} />
              <span className="flex-1 text-xs truncate" style={{ color: 'var(--text-primary)' }}>{bubble.name}</span>

              {/* Lock indicator */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : bubble.id)}
                className="flex items-center gap-1 rounded-aero px-2 py-1 text-xs transition-opacity hover:opacity-70"
                style={{
                  color: isRestricted ? '#f0a020' : 'var(--text-muted)',
                  background: isRestricted ? 'rgba(240,160,32,0.08)' : 'transparent',
                }}
                title={isRestricted ? 'Restricted to specific roles' : 'Open to all roles'}
              >
                {isRestricted ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                <span style={{ fontSize: 10 }}>
                  {isRestricted ? `${bubble.restricted_to_roles.length} role${bubble.restricted_to_roles.length !== 1 ? 's' : ''}` : 'All'}
                </span>
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              <button onClick={() => handleDelete(bubble.id)} className="transition-opacity hover:opacity-70" style={{ color: '#ff5032' }}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Expanded role access panel */}
            {isExpanded && (
              <div
                className="animate-fade-in"
                style={{
                  padding: '8px 12px 12px',
                  borderTop: '1px solid var(--panel-divider)',
                  background: 'rgba(0,0,0,0.1)',
                }}
              >
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                  {isRestricted
                    ? 'Only selected roles can access this bubble. Owner always has access.'
                    : 'All roles can access this bubble. Toggle a role to restrict access.'}
                </p>
                <div className="flex flex-col gap-1.5">
                  {/* Owner role — always shown as enabled, not toggleable */}
                  {roles.filter(r => r.is_owner_role).map(role => (
                    <div
                      key={role.id}
                      className="flex items-center gap-2.5 rounded-aero px-2.5 py-1.5"
                      style={{ opacity: 0.5 }}
                    >
                      <div style={{
                        width: 16, height: 16, borderRadius: 4,
                        border: `1.5px solid ${role.color}`,
                        background: `${role.color}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5L4.5 7.5L8 3" stroke={role.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: role.color }} />
                      <span style={{ fontSize: 11, color: role.color, fontWeight: 500 }}>{role.name}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>always</span>
                    </div>
                  ))}

                  {/* Toggleable roles */}
                  {assignableRoles.map(role => {
                    const allowed = isRoleAllowed(bubble, role.id);
                    return (
                      <button
                        key={role.id}
                        onClick={() => toggleRoleAccess(bubble.id, role.id, bubble.restricted_to_roles)}
                        disabled={isSaving}
                        className="flex items-center gap-2.5 rounded-aero px-2.5 py-1.5 transition-all hover:opacity-80 disabled:opacity-40"
                        style={{
                          background: allowed ? `${role.color}08` : 'transparent',
                          textAlign: 'left',
                        }}
                      >
                        {/* Checkbox */}
                        <div style={{
                          width: 16, height: 16, borderRadius: 4,
                          border: `1.5px solid ${allowed ? role.color : 'var(--panel-divider)'}`,
                          background: allowed ? `${role.color}30` : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {allowed && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5L4.5 7.5L8 3" stroke={role.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: role.color }} />
                        <span style={{ fontSize: 11, color: allowed ? role.color : 'var(--text-muted)', fontWeight: 500 }}>
                          {role.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
