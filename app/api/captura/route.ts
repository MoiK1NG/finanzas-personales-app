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
 */
export async function POST(request: Request) {
  const { token, app, title, text } = await readCaptureRequest(request)
  if (!token) return Response.json({ ok: false, error: 'missing_token' }, { status: 401 })

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
    // Never echo the notification content or database details back.
    return Response.json(
      { ok: false, error: invalid ? 'invalid_token' : empty ? 'empty_notification' : 'server_error' },
      { status: invalid ? 401 : empty ? 400 : 500 }
    )
  }
  return Response.json({ ok: true, result: data })
}
