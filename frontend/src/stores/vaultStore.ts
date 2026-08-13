import { create } from 'zustand';

export interface VaultEntry {
  id: string;
  title: string;
  username: string;
  password_enc: string;
  url: string;
  notes_enc: string;
  category: string;
}

interface VaultState {
  entries: VaultEntry[];
  setEntries: (entries: VaultEntry[]) => void;
  addEntry: (entry: VaultEntry) => void;
  updateEntry: (entry: VaultEntry) => void;
  removeEntry: (id: string) => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  entries: [],
  setEntries: (entries) => set({ entries }),
  addEntry: (entry) => set((s) => ({ entries: [...s.entries, entry] })),
  updateEntry: (entry) =>
    set((s) => ({
      entries: s.entries.map((e) => (e.id === entry.id ? entry : e)),
    })),
  removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
}));
