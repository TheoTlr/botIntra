import React, { useState } from "react";
import { motion } from "framer-motion";
import { QrCode, Scan, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import supabaseRealtimeService from "@/services/supabaseRealtimeService";

export function HomeScreen({ onModeChange, currentCode, lastUpdate }) {
  const { user } = useAuth();

  const handleScannerClick = async () => {
    if (user) {
      try {
        // Mettre à jour la présence dans Supabase (l'utilisateur est sur place)
        await supabaseRealtimeService.updateUserPresence(user.id, true);
        // Changer le mode vers scanner
        onModeChange("scanner");
      } catch (error) {
        console.error("Erreur lors de la mise à jour de la présence:", error);
        // Changer quand même le mode en cas d'erreur
        onModeChange("scanner");
      }
    } else {
      console.error("Aucun utilisateur connecté");
      onModeChange("scanner");
    }
  };

  const handleDisplayClick = async () => {
    if (user) {
      try {
        // Mettre à jour la présence dans Supabase (l'utilisateur est à distance)
        await supabaseRealtimeService.updateUserPresence(user.id, false);
        // Changer le mode vers display
        onModeChange("display");
      } catch (error) {
        console.error("Erreur lors de la mise à jour de la présence:", error);
        // Changer quand même le mode en cas d'erreur
        onModeChange("display");
      }
    } else {
      console.error("Aucun utilisateur connecté");
      onModeChange("display");
    }
  };

  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="space-y-4">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={handleScannerClick}
            className="w-full h-20 glass-effect text-white border-white/20 hover:bg-white/20 transition-all duration-300"
            variant="outline"
          >
            <div className="flex flex-col items-center gap-2">
              <Scan className="w-8 h-8" />
              <span className="text-lg font-semibold">Scanner QR Code</span>
            </div>
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={handleDisplayClick}
            className="w-full h-20 glass-effect text-white border-white/20 hover:bg-white/20 transition-all duration-300"
            variant="outline"
          >
            <div className="flex flex-col items-center gap-2">
              <QrCode className="w-8 h-8" />
              <span className="text-lg font-semibold">Afficher Code</span>
            </div>
          </Button>
        </motion.div>
      </div>

      {currentCode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect rounded-xl p-6 text-white"
        >
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Dernier Code
          </h3>
          <div className="bg-white/10 rounded-lg p-4 mb-3">
            <p className="text-2xl font-mono text-center break-all">
              {currentCode}
            </p>
          </div>
          {lastUpdate && (
            <p className="text-sm text-white/70 text-center">
              Mis à jour: {formatDate(lastUpdate)}
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
