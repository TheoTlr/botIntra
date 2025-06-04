import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/use-toast";

class SupabaseRealtimeService {
  channel = null;
  codeUpdateCallbacks = [];
  connectionStatusCallbacks = [];

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

    this.channel = supabase.channel(`realtime:code`).on(
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
          console.log("RealtimeService: Code updated via channel", payload.new);
          codeSetter(payload.new.code_value);
          lastUpdateSetter(new Date(payload.new.updated_at));
          this.codeUpdateCallbacks.forEach((cb) =>
            cb(payload.new.code_value, new Date(payload.new.updated_at))
          );
          toast({
            title: "Code mis à jour (Service)!",
            description: `Nouveau code: ${payload.new.code_value}`,
          });
        }
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
    console.log("RealtimeService: Cleaned up.");
  }
}

const supabaseRealtimeService = new SupabaseRealtimeService();
export default supabaseRealtimeService;
