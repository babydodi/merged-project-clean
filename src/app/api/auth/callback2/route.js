import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  try {
    if (code) {
      const supabase = createRouteHandlerClient({ cookies })
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (exchangeError) {
        console.error('exchangeCodeForSession error', exchangeError)
      } else {
        const { data: { user }, error: getUserErr } = await supabase.auth.getUser()
        if (getUserErr) console.error('getUser after exchange error', getUserErr)
        if (user) {
          const googleName = user.user_metadata?.full_name || user.user_metadata?.name || null
          try {
            await fetch(`${requestUrl.origin}/api/auth/upsert-user`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: user.id, email: user.email, full_name: googleName }),
            })
          } catch (e) {
            console.error('upsert-user fetch error', e)
          }
        }
      }
    }
  } catch (e) {
    console.error('callback handler unexpected error', e)
  }

  return NextResponse.redirect(`${requestUrl.origin}/dashboard`)
}
