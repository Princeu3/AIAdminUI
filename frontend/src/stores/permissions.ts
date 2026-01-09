import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ToolType = 'read' | 'write' | 'bash' | 'browser' | 'mcp';
export type PermissionScope = 'once' | 'session' | 'always';
export type PermissionStatus = 'pending' | 'approved' | 'denied';

export interface PermissionRequest {
  id: string;
  tool: ToolType;
  path?: string;
  command?: string;
  description: string;
  timestamp: Date;
  status: PermissionStatus;
}

export interface ToolUse {
  id: string;
  tool: ToolType;
  status: 'pending' | 'running' | 'completed' | 'error';
  path?: string;
  command?: string;
  description: string;
  result?: string;
  error?: string;
  timestamp: Date;
}

// Permission key format: "tool:path" or "tool:*" for all
function getPermissionKey(tool: ToolType, path?: string): string {
  return path ? `${tool}:${path}` : `${tool}:*`;
}

interface PermissionState {
  // Pending permission requests
  pendingRequests: PermissionRequest[];

  // Session-level permissions (cleared on page refresh)
  sessionPermissions: Record<string, boolean>;

  // Persistent permissions (stored in localStorage)
  persistentPermissions: Record<string, boolean>;

  // Tool use history for the current session
  toolUses: ToolUse[];

  // Actions
  addRequest: (request: Omit<PermissionRequest, 'status'>) => void;
  resolveRequest: (id: string, allowed: boolean, scope: PermissionScope) => void;
  checkPermission: (tool: ToolType, path?: string) => boolean | null;
  addToolUse: (toolUse: Omit<ToolUse, 'timestamp'>) => void;
  updateToolUse: (id: string, updates: Partial<ToolUse>) => void;
  clearSessionPermissions: () => void;
  clearPersistentPermission: (tool: ToolType, path?: string) => void;
  clearAllPersistentPermissions: () => void;
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      pendingRequests: [],
      sessionPermissions: {},
      persistentPermissions: {},
      toolUses: [],

      addRequest: (request) =>
        set((state) => ({
          pendingRequests: [
            ...state.pendingRequests,
            { ...request, status: 'pending' as const },
          ],
        })),

      resolveRequest: (id, allowed, scope) =>
        set((state) => {
          const request = state.pendingRequests.find((r) => r.id === id);
          if (!request) return state;

          const key = getPermissionKey(request.tool, request.path);

          // Update permissions based on scope
          const updates: Partial<PermissionState> = {
            pendingRequests: state.pendingRequests.filter((r) => r.id !== id),
          };

          if (scope === 'session') {
            updates.sessionPermissions = {
              ...state.sessionPermissions,
              [key]: allowed,
            };
          } else if (scope === 'always') {
            updates.persistentPermissions = {
              ...state.persistentPermissions,
              [key]: allowed,
            };
          }
          // 'once' scope doesn't store the permission

          return updates as PermissionState;
        }),

      checkPermission: (tool, path) => {
        const state = get();
        const specificKey = getPermissionKey(tool, path);
        const wildcardKey = getPermissionKey(tool, undefined);

        // Check persistent permissions first (always)
        if (specificKey in state.persistentPermissions) {
          return state.persistentPermissions[specificKey];
        }
        if (wildcardKey in state.persistentPermissions) {
          return state.persistentPermissions[wildcardKey];
        }

        // Then check session permissions
        if (specificKey in state.sessionPermissions) {
          return state.sessionPermissions[specificKey];
        }
        if (wildcardKey in state.sessionPermissions) {
          return state.sessionPermissions[wildcardKey];
        }

        // No stored permission
        return null;
      },

      addToolUse: (toolUse) =>
        set((state) => ({
          toolUses: [
            ...state.toolUses,
            { ...toolUse, timestamp: new Date() },
          ],
        })),

      updateToolUse: (id, updates) =>
        set((state) => ({
          toolUses: state.toolUses.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      clearSessionPermissions: () =>
        set({ sessionPermissions: {}, pendingRequests: [], toolUses: [] }),

      clearPersistentPermission: (tool, path) =>
        set((state) => {
          const key = getPermissionKey(tool, path);
          const { [key]: _, ...rest } = state.persistentPermissions;
          return { persistentPermissions: rest };
        }),

      clearAllPersistentPermissions: () =>
        set({ persistentPermissions: {} }),
    }),
    {
      name: 'permissions-storage',
      partialize: (state) => ({
        persistentPermissions: state.persistentPermissions,
      }),
    }
  )
);
