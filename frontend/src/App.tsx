import { useEffect, useState } from 'react'
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query'

import AdminPage from '@/pages/AdminPage'
import DashboardPage from '@/pages/DashboardPage'
import LoginPage from '@/pages/LoginPage'
import LandingPage from '@/pages/LandingPage'
import RegisterPage from '@/pages/RegisterPage'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/api/auth'
import { useProfileRole } from '@/api/admin'

type AuthPage = 'home' | 'login' | 'register'

const publicPaths: Record<AuthPage, string> = {
  home: '/',
  login: '/login',
  register: '/register',
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
})

const AppContent = () => {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [page, setPage] = useState<'dashboard' | 'admin'>('dashboard')
  const { data: session, isLoading } = useSession()
  const { data: role } = useProfileRole()
  const qc = useQueryClient()

  const navigatePublic = (next: AuthPage) => {
    const path = publicPaths[next]
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path)
    }
    setPathname(path)
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname)
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (
      session &&
      (pathname === publicPaths.login || pathname === publicPaths.register)
    ) {
      window.history.replaceState(null, '', publicPaths.home)
      setPathname(publicPaths.home)
      window.scrollTo(0, 0)
    }
  }, [session, pathname])

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

  if (pathname === publicPaths.login) {
    return <LoginPage onGoToRegister={() => navigatePublic('register')} />
  }
  if (pathname === publicPaths.register) {
    return <RegisterPage onGoToLogin={() => navigatePublic('login')} />
  }
  return (
    <LandingPage
      onGoToLogin={() => navigatePublic('login')}
      onGoToRegister={() => navigatePublic('register')}
    />
  )
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppContent />
  </QueryClientProvider>
)

export default App
