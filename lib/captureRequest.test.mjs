// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readCaptureRequest } from './captureRequest.ts'

const URL_BASE = 'https://app.example/api/captura'
const post = (body, { headers = {}, query = '' } = {}) =>
  new Request(URL_BASE + query, { method: 'POST', headers, body })

test('plain text: app, title, then the text (with line breaks and quotes)', async () => {
  const data = await readCaptureRequest(post(
    'Nu\nEnviaste $100,00\nLe enviaste a "alguien"\nen su cuenta de Nequi S.A. CF.',
    { headers: { 'x-capture-token': 'k'.repeat(40) } }
  ))
  assert.deepEqual(data, {
    token: 'k'.repeat(40),
    app: 'Nu',
    title: 'Enviaste $100,00',
    text: 'Le enviaste a "alguien"\nen su cuenta de Nequi S.A. CF.',
  })
})

test('key as Bearer header or as ?token=', async () => {
  const a = await readCaptureRequest(post('Nu\nT\nX', { headers: { authorization: 'Bearer abc123' } }))
  assert.equal(a.token, 'abc123')
  const b = await readCaptureRequest(post('Nu\nT\nX', { query: '?token=abc123' }))
  assert.equal(b.token, 'abc123')
  const c = await readCaptureRequest(post('Nu\nT\nX'))
  assert.equal(c.token, null)
})

test('JSON body', async () => {
  const data = await readCaptureRequest(post(
    JSON.stringify({ token: 'abc', app: 'Nequi Colombia', title: 'Te enviaron plata por Bre-B', text: 'Te enviaron $100.' }),
    { headers: { 'content-type': 'application/json' } }
  ))
  assert.deepEqual(data, { token: 'abc', app: 'Nequi Colombia', title: 'Te enviaron plata por Bre-B', text: 'Te enviaron $100.' })
})

test('broken JSON (unescaped quotes) still keeps the text', async () => {
  const data = await readCaptureRequest(post(
    '{"app":"Nu","text":"dijo "hola" y $100"}',
    { headers: { 'x-capture-token': 'abc' }, query: '?app=Nu&title=' }
  ))
  assert.equal(data.app, 'Nu')
  assert.match(data.text, /\$100/)
})

test('form body', async () => {
  const data = await readCaptureRequest(post(
    new URLSearchParams({ app: 'DaviPlata', title: 'DaviPlata', text: 'Transaccion exitosa: Recibiste Plata' }).toString(),
    { headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-capture-token': 'abc' } }
  ))
  assert.deepEqual(data, { token: 'abc', app: 'DaviPlata', title: 'DaviPlata', text: 'Transaccion exitosa: Recibiste Plata' })
})

test('app and title in the URL, text as the whole body', async () => {
  const data = await readCaptureRequest(post('Te enviaron $100.\nEntra a tu app.', {
    headers: { 'x-capture-token': 'abc' },
    query: '?app=Nequi%20Colombia&title=Te%20enviaron%20plata',
  }))
  assert.deepEqual(data, { token: 'abc', app: 'Nequi Colombia', title: 'Te enviaron plata', text: 'Te enviaron $100.\nEntra a tu app.' })
})
