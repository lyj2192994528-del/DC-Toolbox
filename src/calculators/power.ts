export type DcPowerTarget = 'power' | 'voltage' | 'current'
export type ResistivePowerTarget = 'power' | 'voltage' | 'current' | 'resistance'
export type AcPowerTarget = 'power' | 'voltage' | 'current'
export type EfficiencyTarget = 'outputPower' | 'inputPower' | 'efficiency'

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name}必须是大于 0 的有效数字。`)
  return value
}

function validPowerFactor(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > 1) throw new Error('功率因数必须大于 0 且不超过 1。')
  return value
}

export function calculateDcPower(target: DcPowerTarget, values: { power?: number; voltage?: number; current?: number }): number {
  if (target === 'power') return positive('电压', values.voltage!) * positive('电流', values.current!)
  if (target === 'voltage') return positive('功率', values.power!) / positive('电流', values.current!)
  return positive('功率', values.power!) / positive('电压', values.voltage!)
}

export function calculateResistivePower(target: ResistivePowerTarget, values: { power?: number; voltage?: number; current?: number; resistance?: number }): number {
  if (target === 'power') {
    if (values.voltage !== undefined) return positive('电压', values.voltage) ** 2 / positive('电阻', values.resistance!)
    return positive('电流', values.current!) ** 2 * positive('电阻', values.resistance!)
  }
  if (target === 'voltage') return Math.sqrt(positive('功率', values.power!) * positive('电阻', values.resistance!))
  if (target === 'current') return Math.sqrt(positive('功率', values.power!) / positive('电阻', values.resistance!))
  if (values.voltage !== undefined) return positive('电压', values.voltage) ** 2 / positive('功率', values.power!)
  return positive('功率', values.power!) / positive('电流', values.current!) ** 2
}

export function calculateAcPower(phases: 1 | 3, target: AcPowerTarget, values: { power?: number; voltage?: number; current?: number; powerFactor: number }): number {
  const coefficient = (phases === 3 ? Math.sqrt(3) : 1) * validPowerFactor(values.powerFactor)
  if (target === 'power') return coefficient * positive('电压', values.voltage!) * positive('电流', values.current!)
  if (target === 'voltage') return positive('功率', values.power!) / (coefficient * positive('电流', values.current!))
  return positive('功率', values.power!) / (coefficient * positive('电压', values.voltage!))
}

export function calculateEfficiency(target: EfficiencyTarget, values: { outputPower?: number; inputPower?: number; efficiency?: number }): number {
  if (target === 'efficiency') {
    const result = positive('输出功率', values.outputPower!) / positive('输入功率', values.inputPower!) * 100
    if (result > 100) throw new Error('输出功率不能大于输入功率。')
    return result
  }
  const efficiency = positive('效率', values.efficiency!)
  if (efficiency > 100) throw new Error('效率不能超过 100%。')
  if (target === 'outputPower') return positive('输入功率', values.inputPower!) * efficiency / 100
  return positive('输出功率', values.outputPower!) / (efficiency / 100)
}
