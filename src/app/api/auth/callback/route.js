import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    // Exchange code and set Supabase session cookie
    await supabase.auth.exchangeCodeForSession(code)

    // Get the logged-in user
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const googleName = user.user_metadata?.full_name || user.user_metadata?.name || null

      // Best-effort upsert: call your upsert API to ensure a public.users row exists
      try {
        await fetch(`${requestUrl.origin}/api/auth/upsert-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            email: user.email,
            full_name: googleName,
          }),
        })
      } catch (e) {
        // swallow to avoid breaking redirect flow
      }
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}/dashboard`)
}
