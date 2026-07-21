export type CapacitorNetworkMode = 'series' | 'parallel'

function positive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label}必须是大于 0 的有效数值。`)
  return value
}

export function calculateEquivalentCapacitance(mode: CapacitorNetworkMode, capacitances: number[]): number {
  if (capacitances.length < 2) throw new Error('请至少选择并填写两个电容。')
  const values = capacitances.map((value, index) => positive(value, `C${index + 1}`))
  return mode === 'parallel'
    ? values.reduce((sum, value) => sum + value, 0)
    : 1 / values.reduce((sum, value) => sum + 1 / value, 0)
}

export function solveMissingCapacitance(mode: CapacitorNetworkMode, targetTotal: number, knownCapacitances: number[]): number {
  positive(targetTotal, '目标总电容')
  if (knownCapacitances.length < 1) throw new Error('请至少填写一个已知电容。')
  const known = knownCapacitances.map((value, index) => positive(value, `已知电容 C${index + 1}`))
  if (mode === 'parallel') {
    const missing = targetTotal - known.reduce((sum, value) => sum + value, 0)
    if (missing <= 0) throw new Error('并联目标总电容必须大于所有已知电容之和。')
    return missing
  }
  const denominator = 1 / targetTotal - known.reduce((sum, value) => sum + 1 / value, 0)
  if (denominator <= 0) throw new Error('串联目标总电容必须小于当前已知电容的等效值。')
  return 1 / denominator
}

export function capacitanceCode(farads: number): string {
  positive(farads, '电容值')
  const picofarads = farads / 1e-12
  if (picofarads < 10 || picofarads >= 1e11) return '不适用'
  const exponent = Math.floor(Math.log10(picofarads)) - 1
  const firstTwo = Math.round(picofarads / 10 ** exponent)
  if (firstTwo < 10 || firstTwo > 99 || exponent < 0 || exponent > 9) return '不适用'
  const represented = firstTwo * 10 ** exponent
  return Math.abs(represented - picofarads) / picofarads < 0.005 ? `${firstTwo}${exponent}` : '非标准三位代码'
}
