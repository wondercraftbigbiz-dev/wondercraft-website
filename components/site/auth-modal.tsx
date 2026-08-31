'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertIcon, SpinnerIcon } from './icons'
import { ModalShell } from './modal-shell'

type Mode = 'signin' | 'signup'

export function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    setError(null)
    setConfirmationSent(false)

    try {
      const supabase = createClient()
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo:
              process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
              `${window.location.origin}/auth/callback`,
          },
        })
        if (error) throw error
        if (!data.session) {
          setConfirmationSent(true)
          return
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
      onClose()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Нещо се обърка. Опитайте отново.'
      setError(translateAuthError(message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell
      title={mode === 'signin' ? 'Вход' : 'Регистрация'}
      onClose={onClose}
    >
      <form
        id="auth-form"
        onSubmit={handleSubmit}
        noValidate
        className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-charcoal-soft">
            {confirmationSent
              ? 'Изпратихме ви линк за потвърждение. Проверете имейла си, за да активирате профила.'
              : mode === 'signin'
                ? 'Влезте в профила си, за да продължите към плащане.'
                : 'Създайте профил, за да поръчате къщичката.'}
          </p>

          <div>
            <label className="mb-1.5 block font-sans text-sm font-semibold text-charcoal">
              Имейл
            </label>
            <input
              ref={emailRef}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="modal-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block font-sans text-sm font-semibold text-charcoal">
              Парола
            </label>
            <input
              name="password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={6}
              className="modal-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-error bg-salmon-soft px-4 py-3 text-sm leading-relaxed text-charcoal"
            >
              <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          {!confirmationSent && <button
            type="submit"
            form="auth-form"
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border-soft bg-salmon px-6 py-3 font-sans text-base font-semibold text-charcoal shadow-soft transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:bg-salmon-hover hover:shadow-soft-lg active:scale-[0.96] active:duration-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {loading && <SpinnerIcon className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {loading ? 'Моля, изчакайте…' : mode === 'signin' ? 'Вход' : 'Регистрация'}
          </button>}

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError(null)
            }}
            className="text-center font-sans text-sm font-semibold text-jade-ink underline decoration-jade-ink decoration-2 underline-offset-4"
          >
            {mode === 'signin'
              ? 'Нямате профил? Регистрирайте се'
              : 'Имате профил? Влезте'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

/**
 * Map Supabase auth error messages to Bulgarian so the customer is not shown
 * raw English API text.
 */
function translateAuthError(message: string): string {
  if (/invalid login credentials/i.test(message))
    return 'Невалиден имейл или парола.'
  if (/user already registered/i.test(message))
    return 'Вече има регистриран профил с този имейл. Влезте вместо да се регистрирате.'
  if (/password should be at least|weak password/i.test(message))
    return 'Паролата трябва да е поне 6 символа.'
  if (/invalid email|email_address_invalid/i.test(message))
    return 'Въведете валиден имейл адрес.'
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(message))
    return 'Опитите са твърде много. Изчакайте малко и опитайте отново.'
  if (/email not confirmed/i.test(message))
    return 'Потвърдете имейла си от полученото съобщение, преди да влезете.'
  return 'Нещо се обърка. Опитайте отново.'
}
