// Run with: npm test   (node --test, Node 24 reads the .ts file directly)
// The notification texts are the real ones captured on the phone on 2026-11-11
// (names masked the same way the apps mask them).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guessAccountId, isLikelyMovement, isLikelySameMovement, parseAmount, parseCapture, parseDirection } from './captures.ts'

const ACCOUNTS = [
  { id: 'nu', name: 'Nu' },
  { id: 'nequi', name: 'Nequi' },
  { id: 'davivienda', name: 'Davivienda' },
  { id: 'daviplata', name: 'DaviPlata' },
  { id: 'bancolombia', name: 'Bancolombia' },
  { id: 'cash', name: 'Efectivo' },
]

test('Nu: money sent by Bre-B', () => {
  const parsed = parseCapture({
    source_app: 'Nu',
    title: 'Enviaste $100,00',
    body: 'Le enviaste a Moi***** d* Jes**** Cam****** Per**** en su cuenta de Nequi S.A. CF.',
  })
  assert.equal(parsed.amount, 100)
  assert.equal(parsed.direction, 'out')
  assert.equal(parsed.destinationBank, 'Nequi S.A. CF')
  assert.equal(guessAccountId(parsed.destinationBank, ACCOUNTS), 'nequi')
  assert.equal(parsed.suggestedDescription, 'Pago desde Nu')
})

test('Nu: destination bank matches one of the user accounts', () => {
  for (const [bank, id] of [['Bancolombia', 'bancolombia'], ['Davivienda', 'davivienda'], ['Daviplata', 'daviplata']]) {
    const parsed = parseCapture({
      source_app: 'Nu',
      title: 'Enviaste $100,00',
      body: `Le enviaste a Moi***** d* Jes**** Cam****** Per**** en su cuenta de ${bank}.`,
    })
    assert.equal(parsed.destinationBank, bank)
    assert.equal(guessAccountId(parsed.destinationBank, ACCOUNTS), id)
  }
})

test('Nequi: money received by Bre-B', () => {
  const parsed = parseCapture({
    source_app: 'Nequi Colombia',
    title: 'Te enviaron plata por Bre-B',
    body: 'Te enviaron $100. Entra a tu app y revisa tu saldo.',
  })
  assert.equal(parsed.amount, 100)
  assert.equal(parsed.direction, 'in')
  assert.equal(parsed.suggestedDescription, 'Ingreso en Nequi Colombia')
})

test('DaviPlata: received, but the notification has no amount', () => {
  const parsed = parseCapture({
    source_app: 'DaviPlata',
    title: 'DaviPlata',
    body: 'Transaccion exitosa: Recibiste Plata de otra entidad usando Llaves, consulta el detalle de tus movimientos desde el app DaviPlata.',
  })
  assert.equal(parsed.amount, null)
  assert.equal(parsed.direction, 'in')
})

test('Nu: money received by key, amount without "$"', () => {
  const info = parseCapture({ source_app: 'Nu', title: 'Recibiste 700.000,00 en tu cuenta', body: 'Te llegó dinero de MOISES con tu llave.' })
  assert.equal(info.amount, 700000)
  assert.equal(info.direction, 'in')
  assert.equal(info.suggestedDescription, 'Ingreso en Nu')
})

test('Bancolombia SMS: received, dot as decimal separator and other numbers in the text', () => {
  const parsed = parseCapture({
    source_app: 'Mensajes',
    title: 'Bancolombia',
    body: 'Bancolombia: Moises, recibiste una transferencia de Moises de Jesus Camargo Perez por $100.00 en tu cuenta *9075 conectada a la llave 1004277793 el 11/11/26 a las 07:36. Con llaves es de una y gratis. Dudas al 018000912345.',
  })
  assert.equal(parsed.amount, 100)
  assert.equal(parsed.direction, 'in')
})

test('amount separators', () => {
  assert.equal(parseAmount('Enviaste $100,00'), 100)
  assert.equal(parseAmount('por $100.00 en tu cuenta'), 100)
  assert.equal(parseAmount('Te enviaron $100. Entra a tu app'), 100)
  assert.equal(parseAmount('Compra por $1.250.000 en'), 1250000)
  assert.equal(parseAmount('Compra por $1.250.000,00 en'), 1250000)
  assert.equal(parseAmount('Pagaste $ 45.900'), 45900)
  assert.equal(parseAmount('Pagaste $12,500.50'), 12501)
  assert.equal(parseAmount('Pagaste $8.000'), 8000)
  assert.equal(parseAmount('Recibiste 100 de alguien'), null)   // no "$" and not written like money: not guessed
  assert.equal(parseAmount('sin monto'), null)
  // No "$", but written like money (Nu, 2026-11-13)
  assert.equal(parseAmount('Recibiste 700.000,00 en tu cuenta'), 700000)
  assert.equal(parseAmount('Recibiste 100,00 en tu cuenta'), 100)
  assert.equal(parseAmount('Compra COP 45.900 en TIENDA'), 45900)
  // Numbers that are not amounts
  assert.equal(parseAmount('Tu CDT rinde 9,5% E.A.'), null)
  assert.equal(parseAmount('Tarjeta *1234 el 13/11/2026 a las 13:35'), null)
  assert.equal(parseAmount('Ahorra hasta 12,50% hoy'), null)
  assert.equal(parseAmount('Version 1.2.3'), null)
})

test('direction', () => {
  assert.equal(parseDirection('Recibiste una transferencia'), 'in')
  assert.equal(parseDirection('Te llegó plata'), 'in')
  assert.equal(parseDirection('Compra aprobada'), 'out')
  assert.equal(parseDirection('Tu extracto está listo'), null)
})

test('account guessing', () => {
  assert.equal(guessAccountId('Nu', ACCOUNTS), 'nu')
  assert.equal(guessAccountId('Nequi Colombia', ACCOUNTS), 'nequi')
  assert.equal(guessAccountId('DaviPlata', ACCOUNTS), 'daviplata')
  assert.equal(guessAccountId('Davivienda', ACCOUNTS), 'davivienda')
  assert.equal(guessAccountId('Gmail', ACCOUNTS), null)
  assert.equal(guessAccountId('Menú del día', ACCOUNTS), null)   // "nu" inside another word
  assert.equal(guessAccountId(null, ACCOUNTS), null)
})

test('same movement seen by two apps', () => {
  const sent = { amount: 100, receivedAt: '2026-11-11T12:35:10Z' }
  assert.equal(isLikelySameMovement(sent, { amount: 100, receivedAt: '2026-11-11T12:36:40Z' }), true)
  assert.equal(isLikelySameMovement(sent, { amount: 100, receivedAt: '2026-11-11T13:36:40Z' }), false)
  assert.equal(isLikelySameMovement(sent, { amount: 200, receivedAt: '2026-11-11T12:36:40Z' }), false)
  assert.equal(isLikelySameMovement(sent, { amount: null, receivedAt: '2026-11-11T12:36:40Z' }), false)
})

test('payments look like movements; promotions and connection tests do not', () => {
  const movements = [
    { source_app: 'Nu', title: 'Enviaste $100,00', body: 'Le enviaste a Moi***** en su cuenta de Nequi S.A. CF.' },
    { source_app: 'Nequi Colombia', title: 'Te enviaron plata por Bre-B', body: 'Te enviaron $100. Entra a tu app y revisa tu saldo.' },
    { source_app: 'DaviPlata', title: 'DaviPlata', body: 'Transaccion exitosa: Recibiste Plata de otra entidad usando Llaves, consulta el detalle de tus movimientos desde el app DaviPlata.' },
    { source_app: 'Mensajes', title: 'Bancolombia', body: 'Bancolombia: Moises, recibiste una transferencia de Moises por $100.00 en tu cuenta *9075.' },
    { source_app: 'Google Wallet', title: 'Exito', body: 'Compra por $45.900 con tu tarjeta Nu terminada en 1234' },
    { source_app: 'Nu', title: 'Recibiste 700.000,00 en tu cuenta', body: 'Te llegó dinero de MOISES con tu llave.' },
  ]
  for (const capture of movements) assert.equal(isLikelyMovement(capture), true, capture.title)

  // Real promotions captured on 2026-11-12/13, and the Message487 connection test.
  const others = [
    { source_app: 'Global66', title: 'El Dólar subió en el último mes', body: 'Hace un mes estaba alrededor de $3.180,37, hoy está en $3.313,48. Convierte ahora con el mejor precio' },
    { source_app: 'DaviPlata', title: 'DaviPlata en 1 minuto 🚀', body: '¿Necesitas saldo ya? Tráelo gratis por PSE o con tus Llaves desde cualquier banco. ¡Mueve tu plata sin enredos ni filas!' },
    { source_app: 'Nequi Colombia', title: '¿Vas a terminar la serie? 👀', body: 'Busca el control, prende el TV, pero primero paga o recarga DGO, ViX Premium desde Nequi. 🎮 Hazlo aquí.' },
    { source_app: 'life.andre.message487', title: null, body: 'Message487 connection test' },
  ]
  for (const capture of others) assert.equal(isLikelyMovement(capture), false, capture.title ?? capture.body)
})
