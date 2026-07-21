export interface NonInvertingResult {
  gain: number
  idealOutput: number
  actualOutput: number
  clipped: boolean
}

export function calculateNonInverting(rGround: number, rFeedback: number, inputVoltage: number, outputMin = 0, outputMax = Number.POSITIVE_INFINITY): NonInvertingResult {
  if (![rGround, rFeedback].every((value) => Number.isFinite(value) && value > 0)) throw new Error('R1 和 R2 必须是大于 0 的有效电阻值。')
  if (!Number.isFinite(inputVoltage)) throw new Error('输入电压必须是有效数字。')
  if (!Number.isFinite(outputMin) || outputMax <= outputMin) throw new Error('输出电压范围无效。')
  const gain = 1 + rFeedback / rGround
  const idealOutput = inputVoltage * gain
  const actualOutput = Math.min(outputMax, Math.max(outputMin, idealOutput))
  return { gain, idealOutput, actualOutput, clipped: actualOutput !== idealOutput }
}

export function feedbackResistanceForGain(rGround: number, targetGain: number): number {
  if (!Number.isFinite(rGround) || rGround <= 0) throw new Error('R1 必须大于 0。')
  if (!Number.isFinite(targetGain) || targetGain <= 1) throw new Error('同相放大器目标增益必须大于 1。')
  return rGround * (targetGain - 1)
}

export function groundResistanceForGain(rFeedback: number, targetGain: number): number {
  if (!Number.isFinite(rFeedback) || rFeedback <= 0) throw new Error('R2 必须大于 0。')
  if (!Number.isFinite(targetGain) || targetGain <= 1) throw new Error('同相放大器目标增益必须大于 1。')
  return rFeedback / (targetGain - 1)
}
