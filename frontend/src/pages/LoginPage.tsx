import { useState } from 'react'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { GoogleIcon } from '@/components/auth/GoogleIcon'
import { PasswordInput } from '@/components/auth/PasswordInput'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSignIn, useSignInWithGoogle } from '@/api/auth'

interface LoginPageProps {
  onGoToRegister: () => void
}

const LoginPage = ({ onGoToRegister }: LoginPageProps) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const signIn = useSignIn()
  const signInWithGoogle = useSignInWithGoogle()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    signIn.mutate({ email, password })
  }

  return (
    <AuthLayout description="Zaloguj się, aby zarządzać swoimi finansami">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="email"
          placeholder="Adres e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-12 rounded-md border-border bg-surface-elevated text-sm hover:border-border-strong"
        />

        <PasswordInput
          placeholder="Wpisz hasło"
          value={password}
          onChange={setPassword}
        />

        {signIn.error && (
          <p className="text-sm text-red-500">
            {(signIn.error as Error).message}
          </p>
        )}

        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full uppercase tracking-widest2"
          disabled={signIn.isPending}
        >
          {signIn.isPending ? 'Logowanie…' : 'Zaloguj się'}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-sm text-ink-3">lub</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full border-brand text-brand uppercase tracking-widest2 hover:bg-brand-soft"
        onClick={() => signInWithGoogle.mutate()}
        disabled={signInWithGoogle.isPending}
      >
        <GoogleIcon />
        Zaloguj się przez Google
      </Button>

      <p className="mt-6 text-center text-sm text-ink-3">
        Nie masz jeszcze konta?{' '}
        <button
          type="button"
          onClick={onGoToRegister}
          className="font-medium text-brand hover:underline"
        >
          Zarejestruj się
        </button>
      </p>
    </AuthLayout>
  )
}

export default LoginPage
