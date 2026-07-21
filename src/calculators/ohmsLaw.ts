export type OhmsQuantity = 'voltage' | 'current' | 'resistance' | 'power'

export interface OhmsValues {
  voltage: number
  current: number
  resistance: number
  power: number
}

export interface OhmsCalculation {
  values: OhmsValues
  formula: string
}

export function calculateOhmsLaw(inputs: Partial<OhmsValues>): OhmsCalculation {
  const present = (Object.entries(inputs) as Array<[OhmsQuantity, number | undefined]>).filter((entry): entry is [OhmsQuantity, number] => entry[1] !== undefined)
  if (present.length !== 2) throw new Error('请正好输入两个已知量。')
  if (present.some(([, value]) => !Number.isFinite(value) || value <= 0)) throw new Error('已知量必须是大于 0 的有效数字。')

  const voltage = inputs.voltage
  const current = inputs.current
  const resistance = inputs.resistance
  const power = inputs.power

  if (voltage !== undefined && current !== undefined) return { values: { voltage, current, resistance: voltage / current, power: voltage * current }, formula: 'R = V ÷ I，P = V × I' }
  if (voltage !== undefined && resistance !== undefined) return { values: { voltage, resistance, current: voltage / resistance, power: voltage ** 2 / resistance }, formula: 'I = V ÷ R，P = V² ÷ R' }
  if (voltage !== undefined && power !== undefined) return { values: { voltage, power, current: power / voltage, resistance: voltage ** 2 / power }, formula: 'I = P ÷ V，R = V² ÷ P' }
  if (current !== undefined && resistance !== undefined) return { values: { current, resistance, voltage: current * resistance, power: current ** 2 * resistance }, formula: 'V = I × R，P = I² × R' }
  if (current !== undefined && power !== undefined) return { values: { current, power, voltage: power / current, resistance: power / current ** 2 }, formula: 'V = P ÷ I，R = P ÷ I²' }
  if (resistance !== undefined && power !== undefined) return { values: { resistance, power, voltage: Math.sqrt(power * resistance), current: Math.sqrt(power / resistance) }, formula: 'V = √(P × R)，I = √(P ÷ R)' }
  throw new Error('无法识别已知量组合。')
}
