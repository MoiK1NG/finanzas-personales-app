/**
 * Reads a payment notification captured from the phone (Nu, Nequi, DaviPlata, Bancolombia…)
 * and suggests how to register it. Pure functions with no imports, so they can be tested with
 * `node --test`. The raw text is always kept and shown: a suggestion is never the source of truth.
 */

export interface CaptureText {
  source_app: string
  title: string | null
  body: string | null
}

export type CaptureDirection = 'out' | 'in'

export interface ParsedCapture {
  /** Whole pesos, or null when the notification carries no "$" amount (e.g. DaviPlata). */
  amount: number | null
  /** 'out' = money left the account, 'in' = money arrived, null = could not tell. */
  direction: CaptureDirection | null
  /** Bank named as destination in "…en su cuenta de <banco>." (Nu sends). */
  destinationBank: string | null
  /** Always non-empty, to prefill the description field. */
  suggestedDescription: string
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * First "$" amount in the text, in whole pesos. Banks disagree on separators:
 * Nu writes "$100,00", Bancolombia "$100.00", Nequi "$100", and thousands come as "$1.250.000".
 * Rule: a separator followed by exactly three digits is a thousands separator; a final
 * separator followed by one or two digits is the decimal part.
 */
export function parseAmount(text: string): number | null {
  const match = /\$\s?(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,](\d{1,2}))?(?!\d)/.exec(text)
  if (!match) return null
  const whole = Number(match[1].replace(/[.,]/g, ''))
  const cents = match[2] ? Number(match[2].padEnd(2, '0')) / 100 : 0
  const amount = Math.round(whole + cents)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

// Incoming is checked first: "recibiste una transferencia" must not read as an outgoing transfer.
const INCOMING = ['recibiste', 'te enviaron', 'te llego', 'te transfirieron', 'te pagaron', 'te consignaron', 'abono']
const OUTGOING = ['enviaste', 'pagaste', 'compraste', 'transferiste', 'retiraste', 'compra', 'pago', 'retiro']

export function parseDirection(text: string): CaptureDirection | null {
  const t = normalize(text)
  if (INCOMING.some(word => t.includes(word))) return 'in'
  if (OUTGOING.some(word => t.includes(word))) return 'out'
  return null
}

/**
 * Banks use the same app for payment notices and for advertising. A capture "looks like a movement"
 * when it states a completed action ("enviaste", "te enviaron", "transacción exitosa") or names a
 * payment word ("compra", "pago") next to an amount. Promotions ("El dólar subió… convierte ahora",
 * "¿Necesitas saldo ya?") usually have neither. This only decides what the inbox shows first:
 * nothing is deleted, so a real payment classified as "other" is still one tap away.
 */
const COMPLETED_ACTIONS = [
  'recibiste', 'te enviaron', 'te llego', 'te transfirieron', 'te pagaron', 'te consignaron',
  'enviaste', 'pagaste', 'compraste', 'transferiste', 'retiraste', 'realizaste',
  'transaccion exitosa', 'compra aprobada', 'pago exitoso',
]
const PAYMENT_WORDS = ['compra', 'pago', 'retiro', 'abono', 'transferencia', 'debito', 'cargo']

export function isLikelyMovement(capture: CaptureText): boolean {
  const text = [capture.title, capture.body].filter(Boolean).join('\n')
  const t = normalize(text)
  if (COMPLETED_ACTIONS.some(phrase => t.includes(phrase))) return true
  return parseAmount(text) !== null && PAYMENT_WORDS.some(word => t.includes(word))
}

export function parseCapture(capture: CaptureText): ParsedCapture {
  const text = [capture.title, capture.body].filter(Boolean).join('\n')
  const direction = parseDirection(text)
  // Up to the end of the line, minus the closing period: "Nequi S.A. CF." keeps its inner periods.
  const destination = /en su cuenta de (.+?)\.?\s*$/im.exec(text)
  const app = capture.source_app.trim() || 'la app'

  return {
    amount: parseAmount(text),
    direction,
    destinationBank: destination ? destination[1].trim() : null,
    suggestedDescription: direction === 'in' ? `Ingreso en ${app}` : `Pago desde ${app}`,
  }
}

/**
 * Account whose name matches a bank/app name ("Nequi Colombia" ↔ "Nequi", "Nequi S.A. CF" ↔ "Nequi").
 * The longest matching account name wins, so "Davivienda" and "DaviPlata" never get confused.
 */
export function guessAccountId(
  name: string | null,
  accounts: { id: string; name: string }[]
): string | null {
  if (!name) return null
  const target = normalize(name).replace(/[^a-z0-9]/g, '')
  if (target.length < 2) return null
  let best: { id: string; length: number } | null = null
  for (const account of accounts) {
    const candidate = normalize(account.name).replace(/[^a-z0-9]/g, '')
    if (candidate.length < 2) continue
    // "Nu" is short enough to hide inside other words ("menú"), so short names must match from the start.
    const matches = candidate.length <= 3
      ? target.startsWith(candidate)
      : target.includes(candidate) || candidate.includes(target)
    if (matches && (!best || candidate.length > best.length)) best = { id: account.id, length: candidate.length }
  }
  return best ? best.id : null
}

/** Two captures of the same amount a few minutes apart are usually the same payment seen by two apps. */
export function isLikelySameMovement(
  a: { amount: number | null; receivedAt: string },
  b: { amount: number | null; receivedAt: string },
  windowMinutes = 10
): boolean {
  if (a.amount === null || b.amount === null || a.amount !== b.amount) return false
  return Math.abs(new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()) <= windowMinutes * 60_000
}
