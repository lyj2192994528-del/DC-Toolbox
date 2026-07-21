export interface DividerResult {
  outputVoltage: number
  dividerCurrent: number
  r1Power: number
  r2Power: number
  ratio: number
}

function positive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label}必须是大于 0 的有效数字。`)
  return value
}

export function calculateDivider(inputVoltage: number, r1Bottom: number, r2Top: number): DividerResult {
  positive(inputVoltage, '输入电压'); positive(r1Bottom, 'R1'); positive(r2Top, 'R2')
  const dividerCurrent = inputVoltage / (r1Bottom + r2Top)
  const outputVoltage = dividerCurrent * r1Bottom
  return { outputVoltage, dividerCurrent, r1Power: dividerCurrent ** 2 * r1Bottom, r2Power: dividerCurrent ** 2 * r2Top, ratio: outputVoltage / inputVoltage }
}

export function dividerInputVoltage(outputVoltage: number, r1Bottom: number, r2Top: number): number {
  positive(outputVoltage, '输出电压'); positive(r1Bottom, 'R1'); positive(r2Top, 'R2')
  return outputVoltage * (r1Bottom + r2Top) / r1Bottom
}

export function dividerBottomResistance(inputVoltage: number, outputVoltage: number, r2Top: number): number {
  positive(inputVoltage, '输入电压'); positive(outputVoltage, '输出电压'); positive(r2Top, 'R2')
  if (outputVoltage >= inputVoltage) throw new Error('无源分压器要求输出电压小于输入电压。')
  return outputVoltage * r2Top / (inputVoltage - outputVoltage)
}

export function dividerTopResistance(inputVoltage: number, outputVoltage: number, r1Bottom: number): number {
  positive(inputVoltage, '输入电压'); positive(outputVoltage, '输出电压'); positive(r1Bottom, 'R1')
  if (outputVoltage >= inputVoltage) throw new Error('无源分压器要求输出电压小于输入电压。')
  return r1Bottom * (inputVoltage - outputVoltage) / outputVoltage
}
