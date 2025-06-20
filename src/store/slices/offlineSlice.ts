import { StateCreator } from "zustand";

export interface OfflineState {
  syncStatus: "idle" | "syncing" | "synced" | "error";
  lastSyncTime: number | null;
  pendingSync: boolean;
  offlineData: any[];

  // Actions
  getOfflineData: () => Promise<any[]>;
  syncOfflineData: (
    data: any[],
  ) => Promise<{ success: boolean; error?: string }>;
  updateSyncStatus: (status: "idle" | "syncing" | "synced" | "error") => void;
  addOfflineData: (data: any) => Promise<void>;
  clearOfflineData: () => Promise<void>;
}

const OFFLINE_STORAGE_KEY = "lc-report-offline-data";

interface BackgroundSyncRegistration extends ServiceWorkerRegistration {
  sync: {
    register: (tag: string) => Promise<void>;
  };
}

export const createOfflineSlice: StateCreator<OfflineState> = (set, get) => ({
  syncStatus: "idle",
  lastSyncTime: null,
  pendingSync: false,
  offlineData: [],

  getOfflineData: async () => {
    try {
      // Try to get data from localStorage
      const storedData = localStorage.getItem(OFFLINE_STORAGE_KEY);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        set({ offlineData: parsedData });
        return parsedData;
      }
      return [];
    } catch (error) {
      console.error("Error getting offline data:", error);
      return [];
    }
  },

  syncOfflineData: async (data) => {
    try {
      set({ pendingSync: true });

      // Attempt to sync each piece of offline data
      for (const item of data) {
        try {
          const response = await fetch(item.endpoint, {
            method: item.method || "POST",
            headers: {
              "Content-Type": "application/json",
              ...item.headers,
            },
            body: JSON.stringify(item.data),
          });

          if (!response.ok) {
            throw new Error(`Failed to sync item: ${response.statusText}`);
          }

          // Remove successfully synced item from storage
          const currentData = get().offlineData.filter((d) => d.id !== item.id);
          localStorage.setItem(
            OFFLINE_STORAGE_KEY,
            JSON.stringify(currentData),
          );
          set({ offlineData: currentData });
        } catch (error) {
          console.error("Error syncing item:", error);
          // Continue with other items even if one fails
        }
      }

      set({
        pendingSync: false,
        lastSyncTime: Date.now(),
      });

      return { success: true };
    } catch (error) {
      set({ pendingSync: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
      };
    }
  },

  updateSyncStatus: (status) => {
    set({ syncStatus: status });
  },

  addOfflineData: async (data) => {
    try {
      const currentData = get().offlineData;
      const newData = [
        ...currentData,
        {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          ...data,
        },
      ];

      localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(newData));
      set({ offlineData: newData });

      // Register for background sync if available
      if ("serviceWorker" in navigator) {
        const registration = (await navigator.serviceWorker
          .ready) as BackgroundSyncRegistration;
        if ("sync" in registration) {
          await registration.sync.register("sync-offline-data");
        }
      }
    } catch (error) {
      console.error("Error adding offline data:", error);
      throw error;
    }
  },

  clearOfflineData: async () => {
    try {
      localStorage.removeItem(OFFLINE_STORAGE_KEY);
      set({ offlineData: [] });
    } catch (error) {
      console.error("Error clearing offline data:", error);
      throw error;
    }
  },
});
