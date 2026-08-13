import { create } from 'zustand';

export interface Session {
  id: string;
  hostId?: string;
  label: string;
  connected: boolean;
}

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  setActive: (id: string | null) => void;
  setConnected: (id: string, connected: boolean) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  activeSessionId: null,

  addSession: (session) =>
    set((s) => ({
      sessions: [...s.sessions, session],
      activeSessionId: session.id,
    })),

  removeSession: (id) =>
    set((s) => {
      const sessions = s.sessions.filter((sess) => sess.id !== id);
      const activeSessionId =
        s.activeSessionId === id
          ? sessions.length > 0
            ? sessions[sessions.length - 1].id
            : null
          : s.activeSessionId;
      return { sessions, activeSessionId };
    }),

  setActive: (id) => set({ activeSessionId: id }),

  setConnected: (id, connected) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, connected } : sess
      ),
    })),
}));
