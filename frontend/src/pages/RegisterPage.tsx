import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSignUp, useSignInWithGoogle } from '@/api/auth';

interface RegisterPageProps {
  onGoToLogin: () => void;
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function PasswordInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="h-12 rounded-md border-border bg-surface-elevated pr-10 text-sm hover:border-border-strong"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-brand"
        aria-label={show ? 'Ukryj hasło' : 'Pokaż hasło'}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export default function RegisterPage({ onGoToLogin }: RegisterPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [validationError, setValidationError] = useState('');

  const signUp = useSignUp();
  const signInWithGoogle = useSignInWithGoogle();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setValidationError('Hasła nie są identyczne.');
      return;
    }
    setValidationError('');
    signUp.mutate({ email, password });
  };

  const isConfirmationSent = signUp.isSuccess && !signUp.data?.session;

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface-elevated p-8 shadow-md">
        <h1 className="mb-2 text-center text-3xl font-bold text-brand">SimpleFund</h1>
        <p className="mb-7 text-center text-sm text-ink-3">
          Utwórz konto, aby rozpocząć zarządzanie swoimi finansami
        </p>

        {isConfirmationSent ? (
          <p className="rounded-md bg-brand-soft p-4 text-center text-sm text-brand">
            Sprawdź skrzynkę — wysłaliśmy link potwierdzający na <strong>{email}</strong>.
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

            <PasswordInput placeholder="Wpisz hasło" value={password} onChange={setPassword} />
            <PasswordInput placeholder="Potwierdź hasło" value={confirm} onChange={setConfirm} />

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
      </div>
    </div>
  );
}
