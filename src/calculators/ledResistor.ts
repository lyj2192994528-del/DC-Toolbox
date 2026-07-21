export interface LedResistorResult {
  resistance: number
  resistorPower: number
  ledPower: number
  supplyPower: number
  recommendedResistance: number
  actualCurrent: number
  recommendedPowerRating: number
}

const e24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91]
const powerRatings = [0.125, 0.25, 0.5, 1, 2, 3, 5, 10]

function positive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label}必须是大于 0 的有效数值。`)
  return value
}

export function nextE24Resistance(value: number): number {
  positive(value, '电阻值')
  const decade = 10 ** Math.floor(Math.log10(value) - 1)
  return (e24.find((item) => item * decade >= value) ?? 100) * decade
}

export function calculateLedResistor(supplyVoltage: number, forwardVoltage: number, current: number, ledCount: number): LedResistorResult {
  positive(supplyVoltage, '供电电压'); positive(forwardVoltage, 'LED 正向压降'); positive(current, 'LED 电流')
  if (!Number.isInteger(ledCount) || ledCount < 1 || ledCount > 100) throw new Error('LED 数量必须是 1～100 的整数。')
  const totalForwardVoltage = forwardVoltage * ledCount
  if (supplyVoltage <= totalForwardVoltage) throw new Error('供电电压必须大于所有串联 LED 的正向压降总和。')
  // 电阻承担电源电压减去全部 LED 正向压降后的剩余电压。
  const voltageDrop = supplyVoltage - totalForwardVoltage
  const resistance = voltageDrop / current
  // 标准阻值只向上取，避免实际 LED 电流超过用户设定值。
  const recommendedResistance = nextE24Resistance(resistance)
  const actualCurrent = voltageDrop / recommendedResistance
  const resistorPower = actualCurrent ** 2 * recommendedResistance
  const recommendedPowerRating = powerRatings.find((rating) => rating >= resistorPower * 2) ?? Math.ceil(resistorPower * 2)
  return { resistance, resistorPower, ledPower: totalForwardVoltage * actualCurrent, supplyPower: supplyVoltage * actualCurrent, recommendedResistance, actualCurrent, recommendedPowerRating }
}
