import { create } from 'zustand';

export interface SSHKey {
  id: string;
  label: string;
  public_key: string;
  created_at: string;
}

interface KeyState {
  keys: SSHKey[];
  setKeys: (keys: SSHKey[]) => void;
  addKey: (key: SSHKey) => void;
  removeKey: (id: string) => void;
}

export const useKeyStore = create<KeyState>((set) => ({
  keys: [],
  setKeys: (keys) => set({ keys }),
  addKey: (key) => set((s) => ({ keys: [...s.keys, key] })),
  removeKey: (id) => set((s) => ({ keys: s.keys.filter((k) => k.id !== id) })),
}));
