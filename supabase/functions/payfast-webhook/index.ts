// Handles PayFast's server-to-server ITN (Instant Transaction Notification).
// Verifies the signature, re-validates with PayFast directly, then updates payment/order status.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

const PAYFAST_PASSPHRASE = Deno.env.get('PAYFAST_PASSPHRASE') ?? '';
const PAYFAST_MODE = Deno.env.get('PAYFAST_MODE') ?? 'sandbox';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function payfastEncode(value: string): string {
  return encodeURIComponent(value.trim()).replace(/%20/g, '+');
}

function verifySignature(fields: Record<string, string>, signature: string): boolean {
  const pairs = Object.entries(fields)
    .filter(([key]) => key !== 'signature')
    .map(([key, value]) => `${key}=${payfastEncode(value)}`);
  let query = pairs.join('&');
  if (PAYFAST_PASSPHRASE) {
    query += `&passphrase=${payfastEncode(PAYFAST_PASSPHRASE)}`;
  }
  return createHash('md5').update(query).digest('hex') === signature;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.text();
  const fields: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(body)) {
    fields[key] = value;
  }

  if (!fields.signature || !verifySignature(fields, fields.signature)) {
    return new Response('Invalid signature', { status: 400 });
  }

  // PayFast's recommended second check: echo the raw ITN back to them and require "VALID".
  const validateHost = PAYFAST_MODE === 'live' ? 'www.payfast.co.za' : 'sandbox.payfast.co.za';
  const validation = await fetch(`https://${validateHost}/eng/query/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if ((await validation.text()).trim() !== 'VALID') {
    return new Response('Could not validate with PayFast', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const orderId = fields.m_payment_id;
  const isComplete = fields.payment_status === 'COMPLETE';

  await supabase
    .from('payments')
    .update({
      status: isComplete ? 'paid' : 'failed',
      provider_reference: fields.pf_payment_id,
      method: fields.payment_method?.toLowerCase().includes('eft') ? 'eft' : 'card',
      raw_itn: fields,
    })
    .eq('order_id', orderId)
    .eq('status', 'pending');

  await supabase
    .from('orders')
    .update({ payment_status: isComplete ? 'paid' : 'failed' })
    .eq('id', orderId);

  return new Response('OK', { status: 200 });
});
