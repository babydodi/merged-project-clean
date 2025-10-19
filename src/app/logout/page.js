'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

export default function LogoutPage() {
  const router = useRouter()
  const supabase = useSupabaseClient()

  useEffect(() => {
    const handleLogout = async () => {
      await supabase.auth.signOut()
      // بعد تسجيل الخروج مباشرة وديه للـ login
      router.replace('/login')
    }
    handleLogout()
  }, [supabase, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <p>Logging out...</p>
    </div>
  )
}
