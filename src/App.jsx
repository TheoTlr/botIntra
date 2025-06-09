import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, Loader2, LogOut } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { useQrCodeData } from "@/hooks/useQrCodeData";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { ScannerScreen } from "@/components/screens/ScannerScreen";
import { DisplayScreen } from "@/components/screens/DisplayScreen";
import { LoginScreen } from "@/components/screens/LoginScreen";
import { useAuth } from "@/hooks/useAuth.jsx";
import { Button } from "@/components/ui/button";
import supabaseRealtimeService from "@/services/supabaseRealtimeService";

function App() {
  const [mode, setMode] = useState("home"); // 'home', 'scanner', 'display'
  const {
    currentCode,
    lastUpdate,
    isConnected,
    updateCodeInSupabase,
    fetchInitialCode,
  } = useQrCodeData();
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading: authLoading, logout } = useAuth();

  useEffect(() => {
    // Vérifier les paramètres URL pour le mode
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get("mode");

    if (modeParam && ["home", "scanner", "display"].includes(modeParam)) {
      setMode(modeParam);
      // Nettoyer l'URL après avoir récupéré le paramètre
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    // The useQrCodeData hook now handles its own initialization via the service
    // We just need to manage the global loading state
    const initializeApp = async () => {
      setIsLoading(true);
      // fetchInitialCode is now more of a getter or a way to ensure service is up
      // The actual data fetching and listener setup is in useQrCodeData's useEffect
      // which calls supabaseRealtimeService.initialize
      await fetchInitialCode(); // This call might be redundant if service handles all initial state
      setIsLoading(false);
    };

    // N'initialiser l'app que si l'utilisateur est connecté
    if (user) {
      initializeApp();
    } else if (!authLoading) {
      setIsLoading(false);
    }

    // Global cleanup for the service when App unmounts
    return () => {
      supabaseRealtimeService.cleanup();
    };
  }, [user, authLoading, fetchInitialCode]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
  };

  // Show loading indicator until the service confirms connection OR initial data is fetched
  useEffect(() => {
    if (user && !isConnected && currentCode === "") {
      // Still waiting for initial load / connection
      setIsLoading(true);
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [isConnected, currentCode, user, authLoading]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex flex-col items-center justify-center text-white">
        <Loader2 className="w-16 h-16 animate-spin mb-4 text-blue-300" />
        <p className="text-xl">Chargement de l'application...</p>
      </div>
    );
  }

  // Si l'utilisateur n'est pas connecté, afficher l'écran de connexion
  if (!user) {
    return (
      <div className="min-h-screen gradient-bg">
        <div className="container mx-auto px-4 py-6 max-w-md">
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl font-bold text-white mb-2">INTRA SCAN</h1>
            <p className="text-white/70">
              Veuillez vous connecter pour accéder à l'application
            </p>
          </motion.div>

          <LoginScreen />
        </div>
        <Toaster />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      <div className="container mx-auto px-4 py-6 max-w-md">
        <motion.div
          className="text-center mb-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-3xl font-bold text-white">INTRA SCAN</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center justify-center gap-2 text-white/80">
            {isConnected ? (
              <>
                <div className=" rounded-xl p-4">
                  <div className="flex items-center justify-center gap-3 text-white">
                    <div className="w-3 h-3 bg-green-400 rounded-full pulse-blue"></div>
                    <span className="text-sm font-medium">En Direct</span>
                  </div>
                </div>
              </>
            ) : (
              <div className=" rounded-xl p-4">
                <div className="flex items-center justify-center gap-3 text-white">
                  <div className="w-3 h-3 bg-red-400 rounded-full pulse-blue"></div>
                  <span className="text-sm font-medium">Pas en direct</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {mode === "home" && (
            <HomeScreen
              onModeChange={handleModeChange}
              currentCode={currentCode}
              lastUpdate={lastUpdate}
            />
          )}
          {mode === "scanner" && (
            <ScannerScreen
              onModeChange={handleModeChange}
              currentCode={currentCode}
              lastUpdate={lastUpdate}
              updateCodeInSupabase={updateCodeInSupabase}
              fetchInitialCode={fetchInitialCode}
            />
          )}
          {mode === "display" && (
            <DisplayScreen
              onModeChange={handleModeChange}
              currentCode={currentCode}
              lastUpdate={lastUpdate}
            />
          )}
        </AnimatePresence>
      </div>
      <Toaster />
    </div>
  );
}

export default App;
