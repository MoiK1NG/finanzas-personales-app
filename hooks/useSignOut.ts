'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/** Signs out with a pending state (no double submits) and an error message if it fails. */
export function useSignOut() {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const signOut = useCallback(async () => {
    if (signingOut) return
    setSigningOut(true)
    setSignOutError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      setSigningOut(false)
      setSignOutError('No se pudo cerrar la sesión. Intenta de nuevo.')
      return
    }
    router.replace('/login')
    router.refresh()
  }, [router, signingOut])

  return { signOut, signingOut, signOutError }
}
