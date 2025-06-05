import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import QrScanner from "qr-scanner";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/utils";
import supabaseRealtimeService from "@/services/supabaseRealtimeService";

export function ScannerScreen({
  onModeChange,
  currentCode,
  lastUpdate,
  updateCodeInSupabase,
  fetchInitialCode,
}) {
  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const lastScanTime = useRef(0);
  const SCAN_COOLDOWN = 2000; // 2 secondes entre chaque scan
  const [remoteUsers, setRemoteUsers] = useState({ total: 0, pointed: 0 });
  const [allPointedStatus, setAllPointedStatus] = useState(false);

  const initQrScanner = async () => {
    if (videoRef.current && !qrScannerRef.current) {
      try {
        qrScannerRef.current = new QrScanner(
          videoRef.current,
          async (result) => {
            const now = Date.now();
            if (now - lastScanTime.current < SCAN_COOLDOWN) {
              return; // Ignorer le scan si pas assez de temps s'est écoulé
            }
            lastScanTime.current = now;

            if (result) {
              try {
                const url = new URL(result.data);
                const token = url.searchParams.get("token");

                if (token) {
                  const { data: currentDBData } = await fetchInitialCode();
                  const currentValue = currentDBData
                    ? currentDBData.code_value
                    : currentCode;

                  if (token !== currentValue) {
                    console.log(token, currentValue);
                    await updateCodeInSupabase(token);
                    toast({
                      title: "Code mis à jour",
                      description:
                        "Le nouveau code a été enregistré avec succès",
                      variant: "default",
                    });
                  }
                } else {
                  toast({
                    title: "Format invalide",
                    description: "Le QR code ne contient pas de token valide",
                    variant: "destructive",
                  });
                }
              } catch (error) {
                toast({
                  title: "Format invalide",
                  description: "Le QR code n'est pas une URL valide",
                  variant: "destructive",
                });
              }
            }
          },
          {
            highlightScanRegion: true,
            highlightCodeOutline: true,
            willReadFrequently: true,
          }
        );

        await qrScannerRef.current.start();
        setIsScanning(true);
      } catch (error) {
        toast({
          title: "Erreur Caméra",
          description:
            "Impossible d'accéder à la caméra. Vérifiez les permissions.",
          variant: "destructive",
        });
      }
    }
  };

  const stopQrScanner = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    setIsScanning(false);
  };

  const fetchPresenceData = useCallback(async () => {
    try {
      const remoteUsersData =
        await supabaseRealtimeService.getRemoteUsersCount();
      const remoteUsersPointedData =
        await supabaseRealtimeService.getRemoteUsersWithPointage();

      if (remoteUsersData && remoteUsersPointedData) {
        const newRemoteUsers = {
          total: remoteUsersData.count,
          pointed: remoteUsersPointedData.count,
        };

        setRemoteUsers(newRemoteUsers);

        // Tous les utilisateurs à distance ont pointé
        const newAllPointedStatus =
          remoteUsersData.count > 0 &&
          remoteUsersData.count === remoteUsersPointedData.count;

        setAllPointedStatus(newAllPointedStatus);
      }
    } catch (error) {
      console.error(
        "ScannerScreen: Erreur lors de la récupération des données de présence:",
        error
      );
    }
  }, []);

  useEffect(() => {
    initQrScanner();

    // Récupération initiale des données de présence
    fetchPresenceData();

    // S'abonner aux mises à jour de présence
    const unsubscribe = supabaseRealtimeService.onPresenceUpdate(() => {
      fetchPresenceData();
    });

    // Rafraîchir les données de présence toutes les 5 secondes
    const refreshInterval = setInterval(() => {
      fetchPresenceData();
    }, 5000);

    return () => {
      stopQrScanner();
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [fetchPresenceData]);

  return (
    <motion.div
      key="scanner"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="glass-effect rounded-xl p-6">
        <div className="relative aspect-square bg-black/20 rounded-xl overflow-hidden scanner-overlay">
          <video
            ref={videoRef}
            id="qr-video"
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          {isScanning && (
            <div className="absolute inset-4 border-2 border-white/50 rounded-xl">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg"></div>
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg"></div>
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg"></div>
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg"></div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
              isScanning
                ? "bg-green-500/20 text-green-300"
                : "bg-yellow-500/20 text-yellow-300"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isScanning ? "bg-green-400 pulse-blue" : "bg-yellow-400"
              }`}
            ></div>
            <span className="text-sm font-medium">
              {isScanning ? "Scan en cours..." : "Initialisation..."}
            </span>
          </div>
        </div>
      </div>

      {/* Affichage des utilisateurs à distance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl p-6 text-white ${
          allPointedStatus && remoteUsers.total > 0
            ? "border-2 border-green-500 bg-green-500"
            : "glass-effect"
        }`}
      >
        <h3 className="text-lg font-semibold mb-3">Utilisateurs à distance</h3>
        <div className="flex justify-between items-center bg-white/10 rounded-lg p-4 mb-3">
          <div>
            <p className="text-sm text-white/70">Total:</p>
            <p className="text-xl font-semibold">{remoteUsers.total}</p>
          </div>
          <div>
            <p className="text-sm text-white/70">Ont pointé:</p>
            <p className="text-xl font-semibold">{remoteUsers.pointed}</p>
          </div>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              allPointedStatus && remoteUsers.total > 0
                ? "bg-green-600 text-white"
                : "bg-yellow-500/50 text-white/70"
            }`}
          >
            {allPointedStatus && remoteUsers.total > 0 ? "✓" : "!"}
          </div>
        </div>
        <p className="text-sm text-center">
          {remoteUsers.total === 0
            ? "Aucun utilisateur à distance"
            : allPointedStatus
            ? "Tous les utilisateurs à distance ont pointé"
            : `${remoteUsers.pointed}/${remoteUsers.total} utilisateurs ont pointé`}
        </p>
      </motion.div>

      {currentCode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect rounded-xl p-6 text-white"
        >
          <h3 className="text-lg font-semibold mb-3">
            Code Actuel (Base de données)
          </h3>
          <div className="bg-white/10 rounded-lg p-4 mb-3">
            <p className="text-xl font-mono text-center break-all">
              {currentCode}
            </p>
          </div>
          {lastUpdate && (
            <p className="text-sm text-white/70 text-center">
              Dernière màj: {formatDate(lastUpdate)}
            </p>
          )}
        </motion.div>
      )}

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
