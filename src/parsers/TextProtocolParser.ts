export type TextProtocol = 'csv' | 'named'
export interface ParsedFrame { values: Map<string, number>; raw: string }
export interface ParseError { raw: string; message: string }
export interface ParseBatch { frames: ParsedFrame[]; errors: ParseError[] }

const NUMBER_PATTERN = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?'
const NUMBER_REGEX = new RegExp(`^${NUMBER_PATTERN}$`)
const NAMED_FIELD_REGEX = new RegExp(`^([^:=,]+)\\s*[:=]\\s*(${NUMBER_PATTERN})$`)

export class TextProtocolParser {
  private remainder = ''
  private readonly decoder = new TextDecoder('utf-8', { fatal: false })
  private protocol: TextProtocol

  constructor(protocol: TextProtocol) { this.protocol = protocol }

  setProtocol(protocol: TextProtocol): void {
    this.protocol = protocol
    this.reset()
  }

  reset(): void { this.remainder = '' }

  consume(data: Uint8Array): ParseBatch {
    this.remainder += this.decoder.decode(data, { stream: true })
    const lines = this.remainder.split(/\r?\n/)
    this.remainder = lines.pop() ?? ''
    const result: ParseBatch = { frames: [], errors: [] }

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue
      const parsed = this.protocol === 'csv' ? this.parseCsv(line) : this.parseNamed(line)
      if ('message' in parsed) result.errors.push({ raw: rawLine, message: parsed.message })
      else result.frames.push({ raw: rawLine, values: parsed })
    }
    return result
  }

  private parseCsv(line: string): Map<string, number> | { message: string } {
    const fields = line.split(',').map((field) => field.trim())
    if (fields.some((field) => !field)) return { message: 'CSV 行包含空字段。' }
    const values = new Map<string, number>()
    for (let index = 0; index < fields.length; index += 1) {
      if (!NUMBER_REGEX.test(fields[index])) return { message: `CSV 第 ${index + 1} 个字段“${fields[index]}”不是有效数字。` }
      const value = Number(fields[index])
      if (!Number.isFinite(value)) return { message: `CSV 第 ${index + 1} 个字段超出可表示范围。` }
      values.set(`CH${index + 1}`, value)
    }
    return values
  }

  private parseNamed(line: string): Map<string, number> | { message: string } {
    const values = new Map<string, number>()
    for (const rawField of line.split(',')) {
      const match = rawField.trim().match(NAMED_FIELD_REGEX)
      if (!match) return { message: `NamedData 字段“${rawField.trim()}”格式错误，应为 name:value 或 name=value。` }
      const name = match[1].trim()
      if (!name) return { message: 'NamedData 通道名称不能为空。' }
      if (values.has(name)) return { message: `NamedData 通道“${name}”在同一帧中重复。` }
      const value = Number(match[2])
      if (!Number.isFinite(value)) return { message: `NamedData 通道“${name}”的数值超出范围。` }
      values.set(name, value)
    }
    return values
  }
}
