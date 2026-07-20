export interface HexParseResult {
  ok: boolean
  bytes: number[]
  error?: string
}

export function parseHexInput(input: string): HexParseResult {
  const compact = input.replace(/\s+/g, '')
  if (!compact) return { ok: false, bytes: [], error: 'HEX 内容不能为空。' }

  const invalidIndex = [...compact].findIndex((character) => !/[0-9a-f]/i.test(character))
  if (invalidIndex >= 0) {
    return { ok: false, bytes: [], error: `第 ${invalidIndex + 1} 个非空白字符“${compact[invalidIndex]}”不是十六进制字符。` }
  }
  if (compact.length % 2 !== 0) {
    return { ok: false, bytes: [], error: `HEX 字符数为 ${compact.length}，最后一个半字节缺少配对字符。` }
  }

  const bytes: number[] = []
  for (let index = 0; index < compact.length; index += 2) bytes.push(Number.parseInt(compact.slice(index, index + 2), 16))
  return { ok: true, bytes }
}

export function bytesToHex(data: Uint8Array): string {
  return Array.from(data, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ')
}
