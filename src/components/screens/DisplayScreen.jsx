import React, { useState } from "react";
import { motion } from "framer-motion";
import { QrCode, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export function DisplayScreen({ onModeChange, currentCode, lastUpdate }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (currentCode) {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div
      key="display"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="glass-effect rounded-xl p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-6">Code Actuel</h2>

        {currentCode ? (
          <motion.div
            key={currentCode}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <div
              onClick={handleCopy}
              className="bg-white rounded-xl p-8 shadow-2xl cursor-pointer hover:bg-gray-50 transition-colors relative group"
            >
              <p className="text-4xl font-mono text-gray-800 break-all leading-tight">
                {currentCode}
              </p>
              {copied && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-2 right-2 flex items-center gap-1 text-green-600 text-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>Copié !</span>
                </motion.div>
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-sm text-gray-500">Cliquez pour copier</p>
              </div>
            </div>

            {lastUpdate && (
              <div className="text-white/80">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Dernière mise à jour
                  </span>
                </div>
                <p className="text-lg font-mono">{formatDate(lastUpdate)}</p>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="text-white/60 py-12">
            <QrCode className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Aucun code disponible</p>
            <p className="text-sm mt-2">
              Le code apparaîtra ici une fois disponible
            </p>
          </div>
        )}
      </div>

      <div className="glass-effect rounded-xl p-4">
        <div className="flex items-center justify-center gap-3 text-white">
          <div className="w-3 h-3 bg-green-400 rounded-full pulse-blue"></div>
          <span className="text-sm font-medium">Écoute temps réel active</span>
        </div>
      </div>

      <Button
        onClick={() => onModeChange("home")}
        className="w-full glass-effect text-white border-white/20 hover:bg-white/20"
        variant="outline"
      >
        Retour
      </Button>
    </motion.div>
  );
}
