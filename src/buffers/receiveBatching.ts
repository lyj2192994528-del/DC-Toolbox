export const MAX_CONTINUOUS_REFRESH_MS = 100
export const MAX_RECEIVE_BATCH_BYTES = 16_384

/**
 * 返回下一次刷新距离当前的毫秒数。
 * 即使串口连续不断地到达数据，也必须在 100 ms 内刷新一次，避免等待“空闲超时”而永久不显示。
 */
export function receiveFlushDelay(startedAt: number, now: number, idleDelay: number, byteCount: number): number {
  if (byteCount >= MAX_RECEIVE_BATCH_BYTES) return 0
  return Math.max(0, Math.min(idleDelay, MAX_CONTINUOUS_REFRESH_MS - (now - startedAt)))
}
