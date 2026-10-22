import { useEffect, useState } from 'react'
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query'

import DashboardPage from '@/pages/DashboardPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/api/auth'

type AuthPage = 'login' | 'register'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
})

const AppContent = () => {
  const [authPage, setAuthPage] = useState<AuthPage>('login')
  const { data: session, isLoading } = useSession()
  const qc = useQueryClient()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      qc.invalidateQueries({ queryKey: ['auth'] })
    })
    return () => subscription.unsubscribe()
  }, [qc])

  if (isLoading) return null

  if (session) return <DashboardPage />

  if (authPage === 'login') {
    return <LoginPage onGoToRegister={() => setAuthPage('register')} />
  }
  return <RegisterPage onGoToLogin={() => setAuthPage('login')} />
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppContent />
  </QueryClientProvider>
)

export default App
