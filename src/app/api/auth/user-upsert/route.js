import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies })
  const { id, email, full_name } = await req.json()

  if (!id || !email) {
    return NextResponse.json({ error: 'Missing id or email' }, { status: 400 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        id,
        email,
        full_name: full_name ?? null,
        role: 'unsubscribed',
      },
      { onConflict: 'email' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, user: data })
}
