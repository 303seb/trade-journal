import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://vxbtxspkaraibjfvrzit.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4YnR4c3BrYXJhaWJqZnZyeml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNDcyNDYsImV4cCI6MjA5NzkyMzI0Nn0.QFEP_fFTZd2yQPxCuSbcjS2vxu-XeBIBDMj-KObAmoY'
)
