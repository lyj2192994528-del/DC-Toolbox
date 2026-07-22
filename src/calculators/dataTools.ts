export type NumberBase = 2 | 8 | 10 | 16

export interface BaseConversionResult {
  binary: string
  octal: string
  decimal: string
  hexadecimal: string
}

export function convertIntegerBase(input: string, base: NumberBase): BaseConversionResult {
  const cleaned = input.trim().replaceAll('_', '')
  if (!cleaned) throw new Error('请输入需要转换的整数。')
  const sign = cleaned.startsWith('-') ? -1n : 1n
  const unsigned = cleaned.replace(/^[+-]/, '').replace(/^0[xX]/, '').replace(/^0[bB]/, '').replace(/^0[oO]/, '')
  const patterns: Record<NumberBase, RegExp> = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^\d+$/, 16: /^[\da-f]+$/i }
  if (!patterns[base].test(unsigned)) throw new Error(`输入内容不是有效的 ${base} 进制整数。`)
  let value = 0n
  for (const character of unsigned.toLowerCase()) {
    const digit = BigInt(Number.parseInt(character, 16))
    value = value * BigInt(base) + digit
  }
  value *= sign
  return {
    binary: value.toString(2),
    octal: value.toString(8),
    decimal: value.toString(10),
    hexadecimal: value.toString(16).toUpperCase()
  }
}

export type ChecksumAlgorithm = 'sum8' | 'xor8' | 'crc8' | 'crc16-modbus' | 'crc16-ccitt' | 'crc32'

export function parseByteText(input: string, mode: 'hex' | 'ascii'): Uint8Array {
  if (mode === 'ascii') return new TextEncoder().encode(input)
  const cleaned = input.trim().replace(/0x/gi, '').replace(/[\s,;:-]+/g, '')
  if (!cleaned) return new Uint8Array()
  if (!/^[\da-f]+$/i.test(cleaned) || cleaned.length % 2 !== 0) throw new Error('HEX 数据必须由完整的两位字节组成，例如 AA 55 01。')
  return Uint8Array.from(cleaned.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)))
}

export function calculateChecksum(bytes: Uint8Array, algorithm: ChecksumAlgorithm): number {
  if (algorithm === 'sum8') return bytes.reduce((sum, byte) => (sum + byte) & 0xff, 0)
  if (algorithm === 'xor8') return bytes.reduce((sum, byte) => sum ^ byte, 0)
  if (algorithm === 'crc8') {
    let crc = 0
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff }
    return crc
  }
  if (algorithm === 'crc16-modbus') {
    let crc = 0xffff
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1 }
    return crc & 0xffff
  }
  if (algorithm === 'crc16-ccitt') {
    let crc = 0xffff
    for (const byte of bytes) { crc ^= byte << 8; for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff }
    return crc
  }
  let crc = 0xffffffff
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1 }
  return (crc ^ 0xffffffff) >>> 0
}
