import { create } from 'zustand';

export interface Snippet {
  id: string;
  label: string;
  command: string;
  description: string;
}

interface SnippetState {
  snippets: Snippet[];
  setSnippets: (snippets: Snippet[]) => void;
  addSnippet: (snippet: Snippet) => void;
  removeSnippet: (id: string) => void;
}

export const useSnippetStore = create<SnippetState>((set) => ({
  snippets: [],
  setSnippets: (snippets) => set({ snippets }),
  addSnippet: (snippet) => set((s) => ({ snippets: [...s.snippets, snippet] })),
  removeSnippet: (id) => set((s) => ({ snippets: s.snippets.filter((sn) => sn.id !== id) })),
}));
