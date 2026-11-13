import { createClient } from '@supabase/supabase-js'
import { readCaptureRequest } from '@/lib/captureRequest'

/**
 * Receives a payment notification forwarded by the phone (an automation app such as MacroDroid).
 * The phone has no session: it identifies the user with the personal capture key created in
 * Configuración. The notification is only stored in the "Por clasificar" inbox; nothing is
 * registered and no balance changes until the user decides.
 *
 * POST /api/captura
 *   Key:  header "x-capture-token: <clave>"  (or "Authorization: Bearer <clave>", or ?token=<clave>)
 *   Body: plain text, first line = app name, second line = title, the rest = text
 *         (JSON {app,title,text} and form fields app/title/text also work)
 *   Message487 (F-Droid) works as is: Bearer key, JSON {source_name,title,text,event_id}.
 */
/**
 * One log line per rejected request, so a phone that fails can be diagnosed from the Vercel logs.
 * Only shapes are logged (header names, lengths), never the key or the notification text.
 */
function logRejection(reason: string, request: Request, fields: { token: string | null; app: string; title: string; text: string }) {
  console.warn('captura rechazada', JSON.stringify({
    reason,
    contentType: request.headers.get('content-type'),
    headers: [...request.headers.keys()].filter(name => !name.startsWith('x-vercel') && !name.startsWith('x-forwarded')),
    tokenLength: fields.token?.length ?? 0,
    appLength: fields.app.length,
    titleLength: fields.title.length,
    textLength: fields.text.length,
  }))
}

export async function POST(request: Request) {
  const fields = await readCaptureRequest(request)
  const { token, app, title, text } = fields
  if (!token) {
    logRejection('missing_token', request, fields)
    return Response.json({ ok: false, error: 'missing_token' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { data, error } = await supabase.rpc('capture_notification', {
    p_token: token,
    p_app: app,
    p_title: title,
    p_text: text,
  })

  if (error) {
    const invalid = error.message.includes('invalid_token')
    const empty = error.message.includes('empty_notification')
    logRejection(invalid ? 'invalid_token' : empty ? 'empty_notification' : `server_error: ${error.code ?? ''}`, request, fields)
    // Never echo the notification content or database details back.
    return Response.json(
      { ok: false, error: invalid ? 'invalid_token' : empty ? 'empty_notification' : 'server_error' },
      { status: invalid ? 401 : empty ? 400 : 500 }
    )
  }
  // Message487 retries until it gets this exact acknowledgement for its event id. A repeated event
  // ('duplicate') is acknowledged the same way so the phone stops retrying it.
  const ack = fields.eventId ? { status: 'accepted', event_id: fields.eventId } : {}
  return Response.json({ ok: true, result: data, ...ack })
}
