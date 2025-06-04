import { useState, useEffect, createContext, useContext } from "react";
import {
  signIn,
  signUp,
  signOut,
  getSession,
  getUser,
} from "@/lib/supabaseClient";
import { toast } from "@/components/ui/use-toast";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUserSession() {
      try {
        setLoading(true);
        const { data } = await getSession();

        if (data.session) {
          const currentUser = await getUser();
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Erreur lors du chargement de la session:", error);
        toast({
          title: "Erreur de session",
          description: "Impossible de charger votre session.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    loadUserSession();
  }, []);

  const login = async (email, password) => {
    try {
      const { data, error } = await signIn(email, password);

      if (error) throw error;

      setUser(data.user);
      toast({
        title: "Connexion réussie",
        description: "Vous êtes maintenant connecté.",
      });
      return { success: true };
    } catch (error) {
      console.error("Erreur de connexion:", error);
      toast({
        title: "Échec de la connexion",
        description: error.message || "Identifiants invalides.",
        variant: "destructive",
      });
      return { success: false, error };
    }
  };

  const register = async (email, password) => {
    try {
      const { data, error } = await signUp(email, password);

      if (error) throw error;

      toast({
        title: "Inscription réussie",
        description: "Vérifiez votre email pour confirmer votre compte.",
      });
      return { success: true };
    } catch (error) {
      console.error("Erreur d'inscription:", error);
      toast({
        title: "Échec de l'inscription",
        description: error.message || "Impossible de créer le compte.",
        variant: "destructive",
      });
      return { success: false, error };
    }
  };

  const logout = async () => {
    try {
      await signOut();
      setUser(null);
      toast({
        title: "Déconnexion réussie",
        description: "Vous avez été déconnecté avec succès.",
      });
    } catch (error) {
      console.error("Erreur de déconnexion:", error);
      toast({
        title: "Échec de la déconnexion",
        description: "Une erreur s'est produite lors de la déconnexion.",
        variant: "destructive",
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      "useAuth doit être utilisé à l'intérieur d'un AuthProvider"
    );
  }
  return context;
};
