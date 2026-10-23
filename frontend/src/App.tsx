import { useEffect, useState } from 'react'
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query'

import AdminPage from '@/pages/AdminPage'
import DashboardPage from '@/pages/DashboardPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/api/auth'
import { useProfileRole } from '@/api/admin'

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
  const [page, setPage] = useState<'dashboard' | 'admin'>('dashboard')
  const { data: session, isLoading } = useSession()
  const { data: role } = useProfileRole()
  const qc = useQueryClient()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      qc.setQueryData(['auth', 'session'], session)
      if (!session) {
        setPage('dashboard')
        qc.removeQueries({ queryKey: ['portfolio'] })
        qc.removeQueries({ queryKey: ['admin'] })
        qc.removeQueries({ queryKey: ['auth', 'role'] })
      }
    })
    return () => subscription.unsubscribe()
  }, [qc])

  if (isLoading) return null

  if (session) {
    if (page === 'admin' && role === 'admin') {
      return <AdminPage onBack={() => setPage('dashboard')} />
    }
    return (
      <DashboardPage
        isAdmin={role === 'admin'}
        onOpenAdmin={() => setPage('admin')}
      />
    )
  }

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
