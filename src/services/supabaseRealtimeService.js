import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/use-toast";

class SupabaseRealtimeService {
  channel = null;
  codeUpdateCallbacks = [];
  connectionStatusCallbacks = [];
  presenceCallbacks = [];

  initialize(
    initialCodeSetter,
    initialLastUpdateSetter,
    initialConnectionSetter
  ) {
    this.fetchInitialCode(
      initialCodeSetter,
      initialLastUpdateSetter,
      initialConnectionSetter
    );
    this.setupCodeListener(
      initialCodeSetter,
      initialLastUpdateSetter,
      initialConnectionSetter
    );
  }

  async fetchInitialCode(codeSetter, lastUpdateSetter, connectionSetter) {
    try {
      const { data, error, count } = await supabase
        .from("code")
        .select("code_value, updated_at", { count: "exact" })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("RealtimeService: Error fetching initial code:", error);
        toast({
          title: "Erreur de chargement initial",
          description: "Impossible de récupérer le code via le service.",
          variant: "destructive",
        });
        connectionSetter(false);
        return;
      }

      if (data) {
        codeSetter(data.code_value);
        lastUpdateSetter(new Date(data.updated_at));
        connectionSetter(true);
      } else if (count === 0 || (error && error.code === "PGRST116")) {
        const { data: insertData, error: insertError } = await supabase
          .from("code")
          .insert({
            id: 1,
            code_value: "INITIAL_CODE",
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error(
            "RealtimeService: Error inserting initial code:",
            insertError
          );
          toast({
            title: "Erreur d'initialisation du code",
            description: "Impossible de créer le code initial via le service.",
            variant: "destructive",
          });
          connectionSetter(false);
          return;
        }
        if (insertData) {
          codeSetter(insertData.code_value);
          lastUpdateSetter(new Date(insertData.updated_at));
          connectionSetter(true);
        }
      }
    } catch (err) {
      console.error("RealtimeService: Catch fetching initial code:", err);
      connectionSetter(false);
      toast({
        title: "Erreur critique (Service)",
        description:
          "Une erreur inattendue s'est produite lors du chargement initial.",
        variant: "destructive",
      });
    }
  }

  setupCodeListener(codeSetter, lastUpdateSetter, connectionSetter) {
    if (this.channel) {
      this.cleanup();
    }

    setTimeout(() => {
      this.setupNewChannel(codeSetter, lastUpdateSetter, connectionSetter);
    }, 100);
  }

  setupNewChannel(codeSetter, lastUpdateSetter, connectionSetter) {
    if (this.channel) {
      console.log("Channel already exists, skipping creation");
      return;
    }

    this.channel = supabase
      .channel(`realtime:code`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "code",
          config: {
            broadcast: {
              self: true,
            },
          },
        },
        (payload) => {
          if (payload.new) {
            console.log(
              "RealtimeService: Code updated via channel",
              payload.new
            );
            codeSetter(payload.new.code_value);
            lastUpdateSetter(new Date(payload.new.updated_at));
            this.codeUpdateCallbacks.forEach((cb) =>
              cb(payload.new.code_value, new Date(payload.new.updated_at))
            );
            if (payload.new.code_value) {
              toast({
                title: "Code mis à jour (Service)!",
                description: `Nouveau code: ${payload.new.code_value}`,
              });
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "presence",
          config: {
            broadcast: {
              self: true,
            },
          },
        },
        (payload) => {
          console.log("RealtimeService: Présence mise à jour:", payload);
          console.log(
            "RealtimeService: Nombre de callbacks à notifier:",
            this.presenceCallbacks.length
          );
          this.presenceCallbacks.forEach((cb) => {
            console.log("RealtimeService: Exécution d'un callback de présence");
            cb(payload);
          });
        }
      );

    if (!this.channel.subscribed) {
      this.channel.subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.log(
            "RealtimeService: Successfully subscribed to code updates channel!"
          );
          connectionSetter(true);
          this.connectionStatusCallbacks.forEach((cb) => cb(true));
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(
            "RealtimeService: Channel error or timeout:",
            status,
            err
          );
          connectionSetter(false);
          this.connectionStatusCallbacks.forEach((cb) => cb(false));
          toast({
            title: "Erreur connexion temps réel (Service)",
            description: `La connexion a échoué: ${status}.`,
            variant: "destructive",
          });
          setTimeout(() => {
            this.cleanup();
            this.setupCodeListener(
              codeSetter,
              lastUpdateSetter,
              connectionSetter
            );
          }, 5000);
        } else if (status === "CLOSED") {
          console.log("RealtimeService: Channel closed.");
          connectionSetter(false);
          this.connectionStatusCallbacks.forEach((cb) => cb(false));
          setTimeout(() => {
            this.cleanup();
            this.setupCodeListener(
              codeSetter,
              lastUpdateSetter,
              connectionSetter
            );
          }, 5000);
        }
      });
    }
  }

  onCodeUpdate(callback) {
    this.codeUpdateCallbacks.push(callback);
    return () => {
      this.codeUpdateCallbacks = this.codeUpdateCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  onConnectionStatusChange(callback) {
    this.connectionStatusCallbacks.push(callback);
    return () => {
      this.connectionStatusCallbacks = this.connectionStatusCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  onPresenceUpdate(callback) {
    console.log(
      "RealtimeService: Enregistrement d'un nouveau callback de présence"
    );
    this.presenceCallbacks.push(callback);
    console.log(
      "RealtimeService: Nombre de callbacks de présence:",
      this.presenceCallbacks.length
    );
    return () => {
      console.log("RealtimeService: Suppression d'un callback de présence");
      this.presenceCallbacks = this.presenceCallbacks.filter(
        (cb) => cb !== callback
      );
      console.log(
        "RealtimeService: Nombre de callbacks de présence restants:",
        this.presenceCallbacks.length
      );
    };
  }

  async updateCode(newCode) {
    try {
      const { data, error } = await supabase
        .from("code")
        .update({ code_value: newCode, updated_at: new Date().toISOString() })
        .eq("id", 1)
        .select()
        .single();

      if (error) {
        console.error("RealtimeService: Error updating code:", error);
        toast({
          title: "Erreur de mise à jour (Service)",
          description: "Impossible de mettre à jour le code.",
          variant: "destructive",
        });
        return null;
      }
      toast({
        title: "Mise à jour demandée (Service)",
        description: `Code ${newCode} envoyé.`,
      });
      return data;
    } catch (err) {
      console.error("RealtimeService: Catch updating code:", err);
      toast({
        title: "Erreur critique MàJ (Service)",
        description: "Une erreur inattendue lors de la mise à jour.",
        variant: "destructive",
      });
      return null;
    }
  }

  async updateUserPresence(userId, isPresent) {
    try {
      console.log(
        "Mise à jour de la présence pour:",
        userId,
        "Présent:",
        isPresent
      );

      // Vérifier d'abord si l'utilisateur existe déjà dans la table presence
      const { data: existingUser, error: checkError } = await supabase
        .from("presence")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      let result;

      if (existingUser) {
        // Si l'utilisateur existe, mettre à jour sa présence
        console.log("Utilisateur existant, mise à jour...");
        const { data, error } = await supabase
          .from("presence")
          .update({
            present: isPresent,
            a_pointe: false,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .select();

        if (error) {
          console.error("RealtimeService: Error updating presence:", error);
          throw error;
        }

        result = data;
      } else {
        // Si l'utilisateur n'existe pas, l'insérer
        console.log("Nouvel utilisateur, insertion...");
        const { data, error } = await supabase
          .from("presence")
          .insert({
            user_id: userId,
            nom: "Utilisateur", // Valeur par défaut pour respecter la contrainte NOT NULL
            present: isPresent,
            a_pointe: false,
            updated_at: new Date().toISOString(),
          })
          .select();

        if (error) {
          console.error("RealtimeService: Error inserting presence:", error);
          throw error;
        }

        result = data;
      }

      // Vérifier que les données ont été retournées
      console.log("Réponse Supabase pour la présence:", result);

      toast({
        title: "Présence mise à jour",
        description: isPresent
          ? "Vous êtes marqué comme présent."
          : "Vous êtes marqué comme absent.",
      });

      return result;
    } catch (err) {
      console.error("RealtimeService: Catch updating presence:", err);
      toast({
        title: "Erreur critique présence",
        description:
          "Une erreur inattendue s'est produite lors de la mise à jour de votre présence.",
        variant: "destructive",
      });
      return null;
    }
  }

  async confirmUserPointage(userId) {
    try {
      console.log("Confirmation du pointage pour:", userId);

      // Mettre à jour a_pointe à true
      const { data, error } = await supabase
        .from("presence")
        .update({
          a_pointe: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select();

      if (error) {
        console.error("RealtimeService: Error confirming pointage:", error);
        toast({
          title: "Erreur de confirmation",
          description: "Impossible de confirmer votre pointage.",
          variant: "destructive",
        });
        return null;
      }

      // Vérifier que les données ont été retournées
      console.log("Réponse Supabase pour le pointage:", data);

      toast({
        title: "Pointage confirmé",
        description: "Votre présence a été confirmée avec succès.",
      });

      return data;
    } catch (err) {
      console.error("RealtimeService: Catch confirming pointage:", err);
      toast({
        title: "Erreur critique pointage",
        description:
          "Une erreur inattendue s'est produite lors de la confirmation de votre pointage.",
        variant: "destructive",
      });
      return null;
    }
  }

  async getPresenceData() {
    try {
      const { data, error } = await supabase
        .from("presence")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("RealtimeService: Error fetching presence data:", error);
        toast({
          title: "Erreur de chargement",
          description: "Impossible de récupérer les données de présence.",
          variant: "destructive",
        });
        return null;
      }

      return data;
    } catch (err) {
      console.error("RealtimeService: Catch fetching presence data:", err);
      toast({
        title: "Erreur critique (Service)",
        description:
          "Une erreur inattendue s'est produite lors du chargement des données de présence.",
        variant: "destructive",
      });
      return null;
    }
  }

  async getRemoteUsersCount() {
    try {
      const { data, error, count } = await supabase
        .from("presence")
        .select("*", { count: "exact" })
        .eq("present", false);

      if (error) {
        console.error("RealtimeService: Error counting remote users:", error);
        return { count: 0, error };
      }

      return { count: count || 0, data };
    } catch (err) {
      console.error("RealtimeService: Catch counting remote users:", err);
      return { count: 0, error: err };
    }
  }

  async getRemoteUsersWithPointage() {
    try {
      const { data, error, count } = await supabase
        .from("presence")
        .select("*", { count: "exact" })
        .eq("present", false)
        .eq("a_pointe", true);

      if (error) {
        console.error(
          "RealtimeService: Error counting remote users with pointage:",
          error
        );
        return { count: 0, error };
      }

      return { count: count || 0, data };
    } catch (err) {
      console.error(
        "RealtimeService: Catch counting remote users with pointage:",
        err
      );
      return { count: 0, error: err };
    }
  }

  async getRemoteUsersReady() {
    try {
      // Récupérer les utilisateurs à distance qui sont prêts (present=false, ready=true)
      const {
        data: readyData,
        error: readyError,
        count: readyCount,
      } = await supabase
        .from("presence")
        .select("*", { count: "exact" })
        .eq("present", false)
        .eq("ready", true);

      // Récupérer les utilisateurs à distance qui ne sont pas prêts (present=false, ready=false)
      const {
        data: notReadyData,
        error: notReadyError,
        count: notReadyCount,
      } = await supabase
        .from("presence")
        .select("*", { count: "exact" })
        .eq("present", false)
        .eq("ready", false);

      if (readyError || notReadyError) {
        console.error(
          "RealtimeService: Error counting remote users ready status:",
          readyError || notReadyError
        );
        return {
          readyCount: 0,
          notReadyCount: 0,
          error: readyError || notReadyError,
        };
      }

      console.log(
        "RealtimeService: Utilisateurs prêts:",
        readyCount,
        "Non prêts:",
        notReadyCount
      );

      return {
        readyCount: readyCount || 0,
        notReadyCount: notReadyCount || 0,
        data: readyData,
      };
    } catch (err) {
      console.error(
        "RealtimeService: Catch counting remote users ready status:",
        err
      );
      return { readyCount: 0, notReadyCount: 0, error: err };
    }
  }

  async getUserPointageStatus(userId) {
    try {
      console.log("Vérification du statut de pointage pour:", userId);

      const { data, error } = await supabase
        .from("presence")
        .select("a_pointe")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error(
          "RealtimeService: Error checking pointage status:",
          error
        );
        return { a_pointe: false, error };
      }

      return { a_pointe: data?.a_pointe || false, data };
    } catch (err) {
      console.error("RealtimeService: Catch checking pointage status:", err);
      return { a_pointe: false, error: err };
    }
  }

  async cancelUserPointage(userId) {
    try {
      console.log("Annulation du pointage pour:", userId);

      // Mettre à jour a_pointe à false
      const { data, error } = await supabase
        .from("presence")
        .update({
          a_pointe: false,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select();

      if (error) {
        console.error("RealtimeService: Error canceling pointage:", error);
        toast({
          title: "Erreur d'annulation",
          description: "Impossible d'annuler votre pointage.",
          variant: "destructive",
        });
        return null;
      }

      // Vérifier que les données ont été retournées
      console.log("Réponse Supabase pour l'annulation du pointage:", data);

      toast({
        title: "Pointage annulé",
        description:
          "L'annulation de votre présence a été effectuée avec succès.",
      });

      return data;
    } catch (err) {
      console.error("RealtimeService: Catch canceling pointage:", err);
      toast({
        title: "Erreur critique d'annulation",
        description:
          "Une erreur inattendue s'est produite lors de l'annulation de votre pointage.",
        variant: "destructive",
      });
      return null;
    }
  }

  async setUserReady(userId, isReady) {
    try {
      console.log(
        "Mise à jour du statut 'ready' pour:",
        userId,
        "Ready:",
        isReady
      );

      const { data, error } = await supabase
        .from("presence")
        .update({
          ready: isReady,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select();

      if (error) {
        console.error("RealtimeService: Error updating ready status:", error);
        toast({
          title: "Erreur de mise à jour",
          description:
            "Impossible de mettre à jour votre statut de préparation.",
          variant: "destructive",
        });
        return null;
      }

      // Vérifier que les données ont été retournées
      console.log("Réponse Supabase pour le statut 'ready':", data);

      toast({
        title: isReady ? "Vous êtes prêt" : "Statut mis à jour",
        description: isReady
          ? "Votre statut de préparation a été confirmé."
          : "Votre statut a été mis à jour.",
      });

      return data;
    } catch (err) {
      console.error("RealtimeService: Catch updating ready status:", err);
      toast({
        title: "Erreur critique",
        description:
          "Une erreur inattendue s'est produite lors de la mise à jour de votre statut.",
        variant: "destructive",
      });
      return null;
    }
  }

  async getUserReadyStatus(userId) {
    try {
      console.log("Vérification du statut 'ready' pour:", userId);

      const { data, error } = await supabase
        .from("presence")
        .select("ready")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("RealtimeService: Error checking ready status:", error);
        return { ready: false, error };
      }

      return { ready: data?.ready || false, data };
    } catch (err) {
      console.error("RealtimeService: Catch checking ready status:", err);
      return { ready: false, error: err };
    }
  }

  cleanup() {
    if (this.channel) {
      try {
        if (this.channel.state === "SUBSCRIBED") {
          supabase.removeChannel(this.channel);
        }
      } catch (error) {
        console.error("Error during channel cleanup:", error);
      } finally {
        this.channel = null;
      }
    }
    this.codeUpdateCallbacks = [];
    this.connectionStatusCallbacks = [];
    this.presenceCallbacks = [];
    console.log("RealtimeService: Cleaned up.");
  }
}

const supabaseRealtimeService = new SupabaseRealtimeService();
export default supabaseRealtimeService;
