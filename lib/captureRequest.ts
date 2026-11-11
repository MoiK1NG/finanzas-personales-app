/**
 * Reads the capture key and the notification out of whatever the phone's automation app sends.
 * Lenient on purpose: those apps differ in how they build a body, and notification text often
 * contains quotes and line breaks that would break hand-written JSON. No imports, so it can be
 * tested with `node --test`.
 */

export interface CaptureRequestData {
  token: string | null
  app: string
  title: string
  text: string
}

function pick(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}

const APP_KEYS = ['app', 'app_name', 'source', 'package']
const TITLE_KEYS = ['title', 'titulo']
const TEXT_KEYS = ['text', 'body', 'message', 'texto', 'notification']

export async function readCaptureRequest(request: Request): Promise<CaptureRequestData> {
  const url = new URL(request.url)
  const query = Object.fromEntries(url.searchParams)
  const raw = (await request.text()).replace(/\r\n/g, '\n')
  const contentType = request.headers.get('content-type') ?? ''

  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')
  let token = request.headers.get('x-capture-token') || bearer?.[1] || query.token || ''
  let fields: Record<string, unknown> = {}
  let lines: string[] | null = null

  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    try {
      fields = JSON.parse(trimmed) as Record<string, unknown>
    } catch {
      lines = raw.split('\n')   // broken JSON (unescaped quotes): keep the text rather than lose the capture
    }
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    fields = Object.fromEntries(new URLSearchParams(raw))
    // Automation apps often label a plain-text body as a form by default: if no known field
    // is there, read it as text instead of losing the notification.
    if (![...APP_KEYS, ...TITLE_KEYS, ...TEXT_KEYS].some(key => key in fields)) {
      fields = {}
      lines = raw.split('\n')
    }
  } else {
    lines = raw.split('\n')
  }

  if (!token) token = pick(fields, ['token'])

  if (lines) {
    // Plain text: app on the first line, title on the second, the rest is the notification text.
    // Query parameters, when present, take the place of those lines.
    const rest = [...lines]
    const app = query.app || (rest.shift() ?? '')
    const title = query.title ?? (rest.shift() ?? '')
    return { token: token.trim() || null, app: app.trim(), title: title.trim(), text: rest.join('\n').trim() }
  }

  return {
    token: token.trim() || null,
    app: (query.app || pick(fields, APP_KEYS)).trim(),
    title: (query.title || pick(fields, TITLE_KEYS)).trim(),
    text: pick(fields, TEXT_KEYS).trim(),
  }
}
