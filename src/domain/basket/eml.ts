export interface EmlHeaders {
  [key: string]: string
}

export interface EmlParsed {
  headers: EmlHeaders
  htmlBody: string
  textBody?: string
}

function decodeQP(text: string): string {
  const noSoftBreaks = text.replace(/=\r?\n/g, '')
  const bytes: number[] = []
  let i = 0
  while (i < noSoftBreaks.length) {
    if (noSoftBreaks[i] === '=' && i + 2 < noSoftBreaks.length) {
      const hex = noSoftBreaks.slice(i + 1, i + 3)
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16))
        i += 3
        continue
      }
    }
    bytes.push(noSoftBreaks.charCodeAt(i))
    i++
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
}

function decodeMimeWord(value: string): string {
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, encoding, text) => {
    if (encoding.toUpperCase() === 'B') {
      const binary = atob(text)
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
      try {
        return new TextDecoder(charset).decode(bytes)
      } catch {
        return text
      }
    } else {
      return decodeQP(text.replace(/_/g, ' '))
    }
  })
}

function unfoldHeaders(raw: string): string {
  return raw.replace(/\r?\n([ \t])/g, '$1')
}

function parseHeaders(raw: string): EmlHeaders {
  const headers: EmlHeaders = {}
  const unfolded = unfoldHeaders(raw)
  for (const line of unfolded.split(/\r?\n/)) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim().toLowerCase()
    const value = decodeMimeWord(line.slice(colon + 1).trim())
    headers[key] = value
  }
  return headers
}

function extractParam(headerValue: string, param: string): string | undefined {
  const rx = new RegExp(`${param}=["']?([^"';,\\s]+)["']?`, 'i')
  return rx.exec(headerValue)?.[1]
}

interface MimePart {
  contentType: string
  encoding: string
  body: string
}

function splitMultipart(body: string, boundary: string): MimePart[] {
  const delimiter = '--' + boundary
  const parts: MimePart[] = []
  const segments = body.split(new RegExp('\r?\n?' + escapeRe(delimiter) + '(?:--)?(?:\r?\n|$)'))
  for (const segment of segments) {
    if (!segment.trim()) continue
    const blankLine = segment.search(/\r?\n\r?\n/)
    if (blankLine === -1) continue
    const partHeaders = parseHeaders(segment.slice(0, blankLine))
    const partBody = segment.slice(blankLine).replace(/^\r?\n/, '')
    parts.push({
      contentType: partHeaders['content-type'] ?? '',
      encoding: (partHeaders['content-transfer-encoding'] ?? '').toLowerCase(),
      body: partBody,
    })
  }
  return parts
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function parseEml(raw: string): EmlParsed {
  const blankLine = raw.search(/\r?\n\r?\n/)
  if (blankLine === -1) {
    return { headers: {}, htmlBody: raw }
  }

  const rawHeaders = raw.slice(0, blankLine)
  const body = raw.slice(blankLine).replace(/^\r?\n/, '')
  const headers = parseHeaders(rawHeaders)

  const ct = headers['content-type'] ?? ''
  const encoding = (headers['content-transfer-encoding'] ?? '').toLowerCase()

  if (ct.toLowerCase().startsWith('multipart/')) {
    const boundary = extractParam(ct, 'boundary')
    if (!boundary) return { headers, htmlBody: body }

    const parts = splitMultipart(body, boundary)
    let htmlBody = ''
    let textBody: string | undefined

    for (const part of parts) {
      const partCt = part.contentType.toLowerCase()
      const decode = part.encoding === 'quoted-printable' ? decodeQP : (s: string) => s

      if (partCt.startsWith('text/html') && !htmlBody) {
        htmlBody = decode(part.body)
      } else if (partCt.startsWith('text/plain') && textBody === undefined) {
        textBody = decode(part.body)
      }
    }
    return { headers, htmlBody, textBody }
  }

  // Single-part — Frisco: 8bit text/html
  const htmlBody = encoding === 'quoted-printable' ? decodeQP(body) : body
  return { headers, htmlBody }
}
