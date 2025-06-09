import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  QrCode,
  Clock,
  Check,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import supabaseRealtimeService from "@/services/supabaseRealtimeService";

export function DisplayScreen({ onModeChange, currentCode, lastUpdate }) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [hasPointed, setHasPointed] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [confirmStep, setConfirmStep] = useState(0); // 0: êtes-vous prêt?, 1: confirmer, 2: annuler
  const { user } = useAuth();
  const prevCodeRef = useRef(null);
  const notificationSound = useRef(null);
  const [isRecent, setIsRecent] = useState(false);

  useEffect(() => {
    // Créer l'élément audio pour la notification
    notificationSound.current = new Audio("/notification.mp3");

    return () => {
      // Nettoyer la référence
      notificationSound.current = null;
    };
  }, []);

  useEffect(() => {
    // Notifier si un nouveau code arrive (différent du précédent)
    if (currentCode && prevCodeRef.current !== currentCode) {
      notifyNewCode();
      prevCodeRef.current = currentCode;
    }
  }, [currentCode]);

  useEffect(() => {
    // Vérifier si la mise à jour est récente (moins de 15 secondes)
    if (!lastUpdate) {
      setIsRecent(false);
      return;
    }

    const checkIfRecent = () => {
      const now = new Date();
      const updateTime = new Date(lastUpdate);
      const diffInSeconds = (now - updateTime) / 1000;
      setIsRecent(diffInSeconds < 15);
    };

    // Vérifier immédiatement
    checkIfRecent();

    // Puis vérifier toutes les secondes
    const interval = setInterval(checkIfRecent, 1000);

    return () => clearInterval(interval);
  }, [lastUpdate]);

  // Fonction pour jouer son et vibration quand un nouveau code arrive
  const notifyNewCode = () => {
    // Jouer le son
    if (notificationSound.current) {
      notificationSound.current
        .play()
        .catch((err) =>
          console.error("Erreur lors de la lecture du son:", err)
        );
    }

    // Faire vibrer si l'API est disponible
    if (navigator.vibrate) {
      navigator.vibrate(300);
    }
  };

  useEffect(() => {
    // Vérifier le statut de pointage et ready de l'utilisateur au chargement
    const checkUserStatus = async () => {
      if (!user) return;

      try {
        const { a_pointe } =
          await supabaseRealtimeService.getUserPointageStatus(user.id);

        if (a_pointe) {
          // Si déjà pointé, passer à l'étape d'annulation
          setHasPointed(true);
          setConfirmStep(2);
        } else {
          // Sinon, commencer par "Êtes-vous prêt?"
          setHasPointed(false);

          // Mettre ready à false au chargement initial
          await supabaseRealtimeService.setUserReady(user.id, false);
          setIsReady(false);
          setConfirmStep(0);
        }
      } catch (error) {
        console.error("Erreur lors de la vérification des statuts:", error);
      }
    };

    checkUserStatus();

    // S'abonner aux mises à jour de présence
    const unsubscribe = supabaseRealtimeService.onPresenceUpdate(() => {
      if (user) {
        // Vérifier le statut de pointage
        supabaseRealtimeService
          .getUserPointageStatus(user.id)
          .then(({ a_pointe }) => {
            setHasPointed(a_pointe);
            if (a_pointe) {
              setConfirmStep(2);
            }
          })
          .catch((error) =>
            console.error("Erreur lors de la mise à jour du statut:", error)
          );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  const handleCopy = async () => {
    if (currentCode) {
      try {
        await navigator.clipboard.writeText(currentCode);
        setCopied(true);

        // Utiliser une promesse au lieu d'un timeout arbitraire
        await new Promise((resolve) => {
          // On garde un délai minimal pour l'UX
          setTimeout(resolve, 1500);
        });
        setCopied(false);
      } catch (error) {
        console.error("Erreur lors de la copie:", error);
        setCopied(false);
      }
    }
  };

  const handleConfirmPointage = async () => {
    if (!user) return;

    setConfirming(true);
    try {
      if (confirmStep === 0) {
        // Première étape: l'utilisateur confirme qu'il est prêt
        await supabaseRealtimeService.setUserReady(user.id, true);
        setIsReady(true);
        setConfirmStep(1);
        setConfirming(false);
        return;
      } else if (confirmStep === 1) {
        // Deuxième étape: confirmer le pointage
        await supabaseRealtimeService.confirmUserPointage(user.id);
        setHasPointed(true);
        setConfirmStep(2);
        setConfirming(false);
      } else if (confirmStep === 2) {
        // Troisième étape: annuler le pointage
        await supabaseRealtimeService.cancelUserPointage(user.id);
        await supabaseRealtimeService.setUserReady(user.id, false);
        setHasPointed(false);
        setIsReady(false);
        setConfirmStep(0);
        setConfirming(false);
      }
    } catch (error) {
      console.error("Erreur lors de la gestion du pointage:", error);
      setConfirming(false);
    }
  };

  const getButtonText = () => {
    if (confirming) {
      return "Confirmation en cours...";
    }

    switch (confirmStep) {
      case 0:
        return "Êtes-vous prêt ?";
      case 1:
        return "Confirmer ma présence";
      case 2:
        return "Annuler ma présence";
      default:
        return "Êtes-vous prêt ?";
    }
  };

  const getButtonIcon = () => {
    if (confirming) {
      return null;
    }

    switch (confirmStep) {
      case 0:
        return <AlertTriangle className="w-5 h-5" />;
      case 1:
        return <CheckCircle className="w-5 h-5" />;
      case 2:
        return <XCircle className="w-5 h-5" />;
      default:
        return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const getButtonClass = () => {
    switch (confirmStep) {
      case 0:
        return "bg-yellow-600 hover:bg-yellow-700 border-yellow-500/20";
      case 1:
        return "bg-green-600 hover:bg-green-700 border-green-500/20";
      case 2:
        return "bg-red-600 hover:bg-red-700 border-red-500/20";
      default:
        return "bg-yellow-600 hover:bg-yellow-700 border-yellow-500/20";
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
                <p
                  className={`text-lg font-mono ${
                    isRecent
                      ? "px-2 py-1 rounded-md bg-green-500/20 border border-green-500/50 inline-block"
                      : "px-2 py-1 rounded-md bg-red-500/20 border border-red-500/50 inline-block"
                  }`}
                >
                  {formatDate(lastUpdate)}
                </p>
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

      <Button
        onClick={handleConfirmPointage}
        disabled={confirming || !user}
        className={`w-full  ${getButtonClass()} text-white h-14`}
      >
        {confirming ? (
          <div className="flex items-center justify-center gap-2">
            <span className="animate-pulse">Confirmation en cours...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            {getButtonIcon()}
            <span>{getButtonText()}</span>
          </div>
        )}
      </Button>

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
