import { createClient } from '@supabase/supabase-js'

// Remplace par tes infos Supabase ici
const supabaseUrl = 'https://cygjsfmwmcvmvqdmouog.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5Z2pzZm13bWN2bXZxZG1vdW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NTc0OTcsImV4cCI6MjA2NDUzMzQ5N30.8RgNPYKZkH_bLzY1AZ6ojDwBNAl3T7hKWfjx1r7xqOo'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
