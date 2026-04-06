const cspNonce = document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') ?? ''

export function getCspNonce (): string {
  return cspNonce
}
