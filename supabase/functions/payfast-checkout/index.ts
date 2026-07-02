// Builds a signed PayFast redirect URL for an order and records a pending payment.
// Requires env vars (set via `supabase secrets set`): PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY,
// PAYFAST_PASSPHRASE, PAYFAST_MODE ('sandbox' | 'live'), APP_RETURN_SCHEME.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

import { corsHeaders } from '../_shared/cors.ts';

const PAYFAST_MERCHANT_ID = Deno.env.get('PAYFAST_MERCHANT_ID') ?? '';
const PAYFAST_MERCHANT_KEY = Deno.env.get('PAYFAST_MERCHANT_KEY') ?? '';
const PAYFAST_PASSPHRASE = Deno.env.get('PAYFAST_PASSPHRASE') ?? '';
const PAYFAST_MODE = Deno.env.get('PAYFAST_MODE') ?? 'sandbox';
const APP_RETURN_SCHEME = Deno.env.get('APP_RETURN_SCHEME') ?? 'rinsecustomer';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// PayFast requires fields signed in the exact order they're sent, values urlencoded with spaces as "+".
function payfastEncode(value: string): string {
  return encodeURIComponent(value.trim()).replace(/%20/g, '+');
}

function buildSignature(fields: Record<string, string>): string {
  const pairs = Object.entries(fields)
    .filter(([, value]) => value !== '' && value != null)
    .map(([key, value]) => `${key}=${payfastEncode(value)}`);
  let query = pairs.join('&');
  if (PAYFAST_PASSPHRASE) {
    query += `&passphrase=${payfastEncode(PAYFAST_PASSPHRASE)}`;
  }
  return createHash('md5').update(query).digest('hex');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (error || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const host = PAYFAST_MODE === 'live' ? 'www.payfast.co.za' : 'sandbox.payfast.co.za';

    const fields: Record<string, string> = {
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      return_url: `${APP_RETURN_SCHEME}://payment/success`,
      cancel_url: `${APP_RETURN_SCHEME}://payment/cancel`,
      notify_url: `${SUPABASE_URL}/functions/v1/payfast-webhook`,
      m_payment_id: order.id,
      amount: order.total.toFixed(2),
      item_name: `Rinse order ${order.id.slice(0, 8)}`,
    };

    const signature = buildSignature(fields);
    const params = new URLSearchParams({ ...fields, signature });

    await supabase.from('payments').insert({
      order_id: order.id,
      provider: 'payfast',
      amount: order.total,
      status: 'pending',
    });

    return new Response(JSON.stringify({ redirectUrl: `https://${host}/eng/process?${params.toString()}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
