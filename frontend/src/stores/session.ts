import { create } from 'zustand';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    type: 'text' | 'diff' | 'approval_request' | 'link';
    diff?: {
      filename: string;
      oldCode: string;
      newCode: string;
    };
    links?: {
      pr?: string;
      preview?: string;
    };
    approvalId?: string;
  };
}

interface SessionState {
  sessionId: string | null;
  messages: Message[];
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  isLoading: boolean;

  // Actions
  setSession: (id: string | null) => void;
  addMessage: (message: Message) => void;
  setConnectionStatus: (status: SessionState['connectionStatus']) => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  sessionId: null,
  messages: [],
  connectionStatus: 'disconnected',
  isLoading: false,

  setSession: (id) => set({ sessionId: id }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setLoading: (loading) => set({ isLoading: loading }),

  clearMessages: () => set({ messages: [] }),
}));
