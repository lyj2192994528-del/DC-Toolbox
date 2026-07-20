export class RingBuffer<T> {
  private values: T[]
  private start = 0
  private count = 0
  private capacity: number

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error('环形缓冲区容量必须是正整数。')
    this.capacity = capacity
    this.values = new Array<T>(capacity)
  }

  get size(): number { return this.count }
  get maxSize(): number { return this.capacity }

  push(value: T): void {
    const index = (this.start + this.count) % this.capacity
    this.values[index] = value
    if (this.count < this.capacity) this.count += 1
    else this.start = (this.start + 1) % this.capacity
  }

  clear(): void {
    this.start = 0
    this.count = 0
  }

  resize(capacity: number): void {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error('环形缓冲区容量必须是正整数。')
    const retained = this.toArray().slice(-capacity)
    this.capacity = capacity
    this.values = new Array<T>(capacity)
    this.start = 0
    this.count = 0
    for (const value of retained) this.push(value)
  }

  toArray(): T[] {
    return Array.from({ length: this.count }, (_, index) => this.values[(this.start + index) % this.capacity])
  }
}
