import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rqiwnxcexsccguruiteq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxaXdueGNleHNjY2d1cnVpdGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3Njc5MzcsImV4cCI6MjA3NTM0MzkzN30.Dl05zPQDtPVpmvn_Y-JokT3wDq0Oh9uF3op5xcHZpkY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface PlayerAccount {
  id: string
  phone: string
  name: string
  email?: string
  avatar_url?: string
  location?: string
  birth_date?: string
  gender?: 'male' | 'female' | 'other'
  bio?: string
  preferred_hand?: 'right' | 'left' | 'ambidextrous'
  court_position?: 'right' | 'left' | 'both'
  game_type?: 'competitive' | 'friendly' | 'both'
  preferred_time?: 'morning' | 'afternoon' | 'evening' | 'all_day'
  availability?: Record<string, { start: string; end: string }>
  level?: number
  points?: number
  wins?: number
  losses?: number
  created_at: string
}

export interface Tournament {
  id: string
  name: string
  description?: string
  date: string
  end_date?: string
  start_time?: string
  end_time?: string
  location: string
  format: string
  status: string
  category?: string
  image_url?: string
  created_at: string
}

export interface Match {
  id: string
  tournament_id: string
  team1_id: string
  team2_id: string
  team1_score?: number
  team2_score?: number
  court_number?: number
  scheduled_time?: string
  status: string
  round?: string
  winner_id?: string
}
