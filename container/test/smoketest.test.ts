import assert from 'node:assert'
import { before, describe, it } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { inspect } from 'node:util'

const baseUrl = new URL('http://127.0.0.1:8080/')

async function waitUntilReady (url: URL): Promise<void> {
  const deadline = Date.now() + 30_000
  let status: number | undefined
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      const signal = AbortSignal.timeout(3_000)

      const response = await fetch(url, { signal })
      if (response.ok) {
        return
      }

      status = response.status
    } catch (error: unknown) {
      lastError = error
    }

    await delay(500)
  }

  assert.fail(`Timeout waiting for site to become ready; HTTP status: ${status ?? 'none'}; last error: ${inspect(lastError)}`)
}

describe('container smoke test', () => {
  before(async () => {
    await waitUntilReady(baseUrl)
  })

  it('serves index.html', async () => {
    const response = await fetch(baseUrl)
    assert.strictEqual(response.ok, true)

    assert.match(response.headers.get('content-type') ?? '', /^text\/html\b/)

    const html = await response.text()
    assert.match(html, /<title>Cadence<\/title>/)
  })

  it('serves exactly one JavaScript bundle', async () => {
    const response = await fetch(baseUrl)
    const html = await response.text()

    const getScriptSrc = (tag: string) => {
      return /\bsrc="([^"]+)"/.exec(tag)?.[1]
    }

    const scriptPaths = [...html.matchAll(/<script\b[^>]*>/g)]
      .map(([tag]) => getScriptSrc(tag))
      .filter((path) => path != null)
    assert.strictEqual(scriptPaths.length, 1, 'built page should reference exactly one JavaScript bundle')

    const scriptResponse = await fetch(new URL(scriptPaths[0], baseUrl))
    assert.strictEqual(scriptResponse.ok, true, 'JavaScript bundle request should succeed')

    const scriptText = await scriptResponse.text()
    assert.ok(scriptText.length > 0, 'JavaScript bundle should not be empty')
  })

  it('serves exactly one CSS bundle', async () => {
    const response = await fetch(baseUrl)
    const html = await response.text()

    const getLinkHref = (tag: string) => {
      const rel = /\brel="([^"]+)"/.exec(tag)?.[1]
      const href = /\bhref="([^"]+)"/.exec(tag)?.[1]
      return rel === 'stylesheet' ? href : undefined
    }

    const stylesheetPaths = [...html.matchAll(/<link\b[^>]*>/g)]
      .map(([tag]) => getLinkHref(tag))
      .filter((path) => path != null)

    assert.strictEqual(stylesheetPaths.length, 1, 'built page should reference exactly one CSS bundle')

    const stylesheetResponse = await fetch(new URL(stylesheetPaths[0], baseUrl))
    assert.strictEqual(stylesheetResponse.ok, true, 'CSS bundle request should succeed')

    const stylesheetText = await stylesheetResponse.text()
    assert.ok(stylesheetText.length > 0, 'CSS bundle should not be empty')
  })

  it('sets the content-security-policy header and nonce meta tag', async () => {
    const response = await fetch(baseUrl)
    const html = await response.text()

    const cspHeader = response.headers.get('content-security-policy')
    assert.ok(cspHeader != null && cspHeader.length > 0, 'CSP header should be set')
    assert.match(cspHeader, /default-src 'self';/, 'CSP should have a default-src directive allowing self')
    assert.match(cspHeader, /script-src 'self';/, 'CSP should allow scripts from self')
    assert.match(cspHeader, /style-src 'self' 'nonce-[^']+';/, 'CSP should allow styles from self or with a nonce')

    const nonceMatch = /style-src 'self' 'nonce-([^']+)'/.exec(cspHeader)
    assert.ok(nonceMatch != null)
    const nonceFromCsp = nonceMatch[1]

    const getNonceFromMeta = (tag: string) => {
      const name = /\bname="([^"]+)"/.exec(tag)?.[1]
      const content = /\bcontent="([^"]+)"/.exec(tag)?.[1]
      return name === 'csp-nonce' ? content : undefined
    }

    const nonceMeta = [...html.matchAll(/<meta\b[^>]*>/g)]
      .map(([tag]) => getNonceFromMeta(tag))
      .filter((content) => content != null)
    assert.strictEqual(nonceMeta.length, 1, 'HTML should include exactly one CSP nonce meta tag')

    const nonceFromMeta = nonceMeta[0]
    assert.strictEqual(nonceFromMeta, nonceFromCsp, 'CSP nonce in meta tag should match the nonce in the CSP header')
  })

  it('serves license information', async () => {
    const response = await fetch(new URL('license.md', baseUrl))
    assert.strictEqual(response.ok, true)

    const text = await response.text()
    assert.match(text, /^# Licenses/, 'should start with a heading')

    // react is just an example of a component that we would expect to see
    assert.match(text, /## react - .+ \(MIT\)/, 'should include component license entries')
  })
})
