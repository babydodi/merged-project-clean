import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const payload = await req.json();

  const { id, email, full_name } = payload || {};
  if (!id || !email) {
    return NextResponse.json({ error: "Missing id or email" }, { status: 400 });
  }

  // تأكد من وجود جلسة مصادقة قبل الكتابة
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // upsert في public.users
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        id,              // نفس id من auth.users
        email,           // فريد
        full_name: full_name ?? null,
        role: "unsubscribed", // افتراضي. غيّره لاحقًا لو صار عنده اشتراك
      },
      { onConflict: "email" } // يحترم unique(email)
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user: data });
}
