import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    console.log('🔔 Webhook:', body);

    // أمثلة حقول محتملة من MyFatoorah webhook
    const {
      InvoiceId,
      InvoiceStatus,
      CustomerEmail,
      InvoiceValue,
      CustomerReference, // مررناه: userId
      UserDefinedField,  // مررناه: plan
      CreatedDate,
      ExpiryDate
    } = body;

    const plan = UserDefinedField; // يجيك "basic" أو "premium" من initiate

    const userId = CustomerReference || null;

    // نحفظ السجل دائماً للمرجعية
    const baseInsert = {
      user_id: userId,
      plan,
      status: InvoiceStatus === 'Paid' ? 'active' : (InvoiceStatus || 'pending').toLowerCase(),
      is_active: InvoiceStatus === 'Paid',
      invoice_id: `${InvoiceId}`,
      amount: InvoiceValue,
      customer_email: CustomerEmail,
      raw_response: body
    };

    if (InvoiceStatus === 'Paid') {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 50);

      const { error } = await supabase.from('subscriptions').insert([{
        ...baseInsert,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      }]);

      if (error) {
        console.error('Supabase insert error:', error);
        return NextResponse.json({ error: 'DB insert failed' }, { status: 500 });
      }

      // اختياري: ترقي دور المستخدم إلى subscriber
      if (userId) {
        const { error: userErr } = await supabase
          .from('users')
          .update({ role: 'subscriber' })
          .eq('id', userId);
        if (userErr) console.warn('Role update warning:', userErr);
      }

      return NextResponse.json({ message: 'Subscription activated' });
    } else {
      const { error } = await supabase.from('subscriptions').insert([baseInsert]);
      if (error) {
        console.error('Supabase insert error (non-paid):', error);
        return NextResponse.json({ error: 'DB insert failed' }, { status: 500 });
      }
      return NextResponse.json({ message: 'Subscription recorded (non-paid)' });
    }
  } catch (e) {
    console.error('webhook error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
