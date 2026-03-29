const CHARSET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_+=?'

async function sha256(data: BufferSource): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(buf)
}

async function hmacSha256(keyUtf8: string, messageUtf8: string): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(keyUtf8),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(messageUtf8),
  )
  return new Uint8Array(sig)
}

/**
 * Детерминированный пароль: HMAC-SHA256(секрет, название сервиса), затем
 * растягивание SHA-256. Одинаковые UTF-8 строки и длина всегда дают тот же результат.
 */
export async function derivePassword(
  serviceName: string,
  secretPhrase: string,
  length: number,
): Promise<string> {
  const encoder = new TextEncoder()
  const n = CHARSET.length
  let state = await hmacSha256(secretPhrase, serviceName)
  let stretch = 0
  let out = ''
  let i = 0

  while (out.length < length) {
    if (i >= state.length) {
      const tail = encoder.encode(`:${stretch}`)
      const merged = new Uint8Array(state.length + tail.length)
      merged.set(state, 0)
      merged.set(tail, state.length)
      state = await sha256(merged)
      stretch += 1
      i = 0
    }
    out += CHARSET[state[i]! % n]!
    i += 1
  }

  return out
}
