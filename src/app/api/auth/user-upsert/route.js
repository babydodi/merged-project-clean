import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST(req) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const payload = await req.json()
    const { id, email, full_name } = payload || {}

    if (!id || !email) {
      return NextResponse.json({ error: 'Missing id or email' }, { status: 400 })
    }

    const { data: { user }, error: getUserErr } = await supabase.auth.getUser()
    if (getUserErr) {
      console.error('auth.getUser error in upsert', getUserErr)
      return NextResponse.json({ error: 'Auth getUser failed' }, { status: 401 })
    }
    if (!user || user.id !== id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('users')
      .upsert({ id, email, full_name: full_name ?? null, role: 'unsubscribed' }, { onConflict: 'email' })
      .select()
      .single()

    if (error) {
      console.error('upsert error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, user: data })
  } catch (e) {
    console.error('upsert route unexpected error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
