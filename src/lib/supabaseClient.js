import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ngdifvjpwogsxkcsfzny.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZGlmdmpwd29nc3hrY3Nmem55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MDU4MDYsImV4cCI6MjA2NDM4MTgwNn0.O8b7FlkOpZGwv2e864mBfKK8kvV-2UdbJs4bDpPW-4s";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const signIn = async (email, password) => {
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
};

export const signUp = async (email, password) => {
  return await supabase.auth.signUp({
    email,
    password,
  });
};

export const signOut = async () => {
  return await supabase.auth.signOut();
};

export const getSession = async () => {
  return await supabase.auth.getSession();
};

export const getUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
};
