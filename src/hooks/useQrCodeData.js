import { useState, useEffect, useCallback } from "react";
import supabaseRealtimeService from "@/services/supabaseRealtimeService";

export function useQrCodeData() {
  const [currentCode, setCurrentCode] = useState("");
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const fetchInitialCode = useCallback(async () => {
    // This will be handled by the service initialization now
    // but we keep the function signature for compatibility if needed elsewhere
    // The service itself will call setCurrentCode, setLastUpdate, setIsConnected
    return {
      data: { code_value: currentCode, updated_at: lastUpdate },
      error: null,
    };
  }, [currentCode, lastUpdate]);

  useEffect(() => {
    // Initialize service which fetches initial code and sets up listeners
    // Pass setters to the service so it can update our state
    supabaseRealtimeService.initialize(
      setCurrentCode,
      setLastUpdate,
      setIsConnected
    );

    const unsubscribeCodeUpdates = supabaseRealtimeService.onCodeUpdate(
      (newCode, newLastUpdate) => {
        setCurrentCode(newCode);
        setLastUpdate(newLastUpdate);
      }
    );

    const unsubscribeConnectionStatus =
      supabaseRealtimeService.onConnectionStatusChange((status) => {
        setIsConnected(status);
      });

    // Cleanup function for when the component unmounts or dependencies change
    return () => {
      unsubscribeCodeUpdates();
      unsubscribeConnectionStatus();
      // The main service cleanup will be handled in App.jsx
    };
  }, []); // Empty dependency array means this runs once on mount

  const updateCodeInSupabase = useCallback(async (newCode) => {
    // Delegate update to the service
    // The service will trigger a toast, and the realtime listener (also in service)
    // will update the local state (currentCode, lastUpdate)
    return supabaseRealtimeService.updateCode(newCode);
  }, []);

  return {
    currentCode,
    lastUpdate,
    isConnected,
    updateCodeInSupabase,
    fetchInitialCode,
  };
}
