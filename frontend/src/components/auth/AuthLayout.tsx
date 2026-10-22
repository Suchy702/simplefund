import type { ReactNode } from 'react'

interface AuthLayoutProps {
  description: string
  children: ReactNode
}

export const AuthLayout = ({ description, children }: AuthLayoutProps) => (
  <div className="flex min-h-full items-center justify-center bg-background p-4">
    <div className="w-full max-w-md rounded-lg border border-border bg-surface-elevated p-8 shadow-md">
      <h1 className="mb-2 text-center text-3xl font-bold text-brand">
        SimpleFund
      </h1>
      <p className="mb-7 text-center text-sm text-ink-3">{description}</p>
      {children}
    </div>
  </div>
)
