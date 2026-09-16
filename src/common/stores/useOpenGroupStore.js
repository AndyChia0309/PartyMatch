import { create } from 'zustand';

export const useOpenGroupStore = create((set) => ({
  hostOpenGroupId: null,
  setHostOpenGroupId: (id) => set({ hostOpenGroupId: id }),
}));
