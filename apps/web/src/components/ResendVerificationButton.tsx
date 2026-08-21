'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/apiClient'

type ResendState = 'idle' | 'resending' | 'resent'

const COOLDOWN_SECONDS = 60

export function ResendVerificationButton({
  email,
  callbackPath = '/verify-email',
  onAlreadyVerified,
}: {
  email: string
  callbackPath?: string
  onAlreadyVerified?: () => void
}) {
  const [state, setState] = useState<ResendState>('idle')
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const handleClick = useCallback(async () => {
    if (cooldown > 0) return
    setState('resending')
    setError(null)
    try {
      await api.auth.resendVerificationEmail(email, `${window.location.origin}${callbackPath}`)
      setState('resent')
      setCooldown(COOLDOWN_SECONDS)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_ALREADY_VERIFIED') {
        onAlreadyVerified?.()
        setState('idle')
      } else {
        if (err instanceof ApiError && err.status === 429) {
          setError('しばらくしてから再度お試しください')
        } else {
          setError('送信に失敗しました。時間をおいて再度お試しください')
        }
        setState('idle')
        setCooldown(COOLDOWN_SECONDS)
      }
    }
  }, [email, cooldown, callbackPath, onAlreadyVerified])

  const disabled = state === 'resending' || cooldown > 0
  const label =
    state === 'resending'
      ? '送信中...'
      : cooldown > 0
        ? `確認メールを再送信（あと${cooldown}秒）`
        : '確認メールを再送信'

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={label}
        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {label}
      </button>
      {state === 'resent' && cooldown > 0 && (
        <p className="mt-2 text-sm text-green-600">再送信しました</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
