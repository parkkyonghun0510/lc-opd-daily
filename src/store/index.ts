import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createOfflineSlice, OfflineState } from "./slices/offlineSlice";

// Define the store type
export interface StoreState extends OfflineState {}

// Create the store
export const useStore = create<StoreState>()(
  persist(
    (...a) => ({
      ...createOfflineSlice(...a),
    }),
    {
      name: "offline-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        offlineData: state.offlineData,
        lastSyncTime: state.lastSyncTime,
      }),
    },
  ),
);
