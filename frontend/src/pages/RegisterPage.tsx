import { useState } from 'react'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { GoogleIcon } from '@/components/auth/GoogleIcon'
import { PasswordInput } from '@/components/auth/PasswordInput'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSignUp, useSignInWithGoogle } from '@/api/auth'

interface RegisterPageProps {
  onGoToLogin: () => void
}

const RegisterPage = ({ onGoToLogin }: RegisterPageProps) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [validationError, setValidationError] = useState('')

  const signUp = useSignUp()
  const signInWithGoogle = useSignInWithGoogle()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setValidationError('Hasła nie są identyczne.')
      return
    }
    setValidationError('')
    signUp.mutate({ email, password })
  }

  const isConfirmationSent = signUp.isSuccess && !signUp.data?.session

  return (
    <AuthLayout description="Utwórz konto, aby rozpocząć zarządzanie swoimi finansami">
      {isConfirmationSent ? (
        <p className="rounded-md bg-brand-soft p-4 text-center text-sm text-brand">
          Sprawdź skrzynkę — wysłaliśmy link potwierdzający na{' '}
          <strong>{email}</strong>.
        </p>
      ) : (
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
          <PasswordInput
            placeholder="Potwierdź hasło"
            value={confirm}
            onChange={setConfirm}
          />

          {(validationError || signUp.error) && (
            <p className="text-sm text-red-500">
              {validationError || (signUp.error as Error).message}
            </p>
          )}

          <Button
            type="submit"
            variant="brand"
            size="lg"
            className="w-full uppercase tracking-widest2"
            disabled={signUp.isPending}
          >
            {signUp.isPending ? 'Rejestracja…' : 'Zarejestruj się'}
          </Button>
        </form>
      )}

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
        Zarejestruj się przez Google
      </Button>

      <p className="mt-6 text-center text-sm text-ink-3">
        Masz już konto?{' '}
        <button
          type="button"
          onClick={onGoToLogin}
          className="font-medium text-brand hover:underline"
        >
          Zaloguj się
        </button>
      </p>
    </AuthLayout>
  )
}

export default RegisterPage
