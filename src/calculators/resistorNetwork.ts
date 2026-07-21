export type ResistorNetworkMode = 'series' | 'parallel'

function validateResistance(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label}必须是大于 0 的有效阻值。`)
  return value
}

export function calculateEquivalentResistance(mode: ResistorNetworkMode, resistances: number[]): number {
  if (resistances.length < 2) throw new Error('请至少选择并填写两个电阻。')
  const valid = resistances.map((value, index) => validateResistance(value, `R${index + 1}`))
  return mode === 'series'
    ? valid.reduce((sum, value) => sum + value, 0)
    : 1 / valid.reduce((sum, value) => sum + 1 / value, 0)
}

export function solveMissingResistance(mode: ResistorNetworkMode, targetTotal: number, knownResistances: number[]): number {
  validateResistance(targetTotal, '目标总阻值')
  if (knownResistances.length < 1) throw new Error('请至少填写一个已知电阻。')
  const known = knownResistances.map((value, index) => validateResistance(value, `已知电阻 R${index + 1}`))
  if (mode === 'series') {
    const missing = targetTotal - known.reduce((sum, value) => sum + value, 0)
    if (missing <= 0) throw new Error('串联目标总阻值必须大于所有已知电阻之和。')
    return missing
  }
  const denominator = 1 / targetTotal - known.reduce((sum, value) => sum + 1 / value, 0)
  if (denominator <= 0) throw new Error('并联目标总阻值必须小于当前已知电阻的等效阻值。')
  return 1 / denominator
}
