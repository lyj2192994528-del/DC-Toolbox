import assert from 'node:assert/strict'
import test from 'node:test'
import { RingBuffer } from '../src/buffers/RingBuffer.ts'
import { TextProtocolParser } from '../src/parsers/TextProtocolParser.ts'
import { parseHexInput } from '../src/utils/hex.ts'
import { JustFloatParser } from '../src/parsers/JustFloatParser.ts'
import { calculateOhmsLaw } from '../src/calculators/ohmsLaw.ts'
import { calculateNonInverting, feedbackResistanceForGain, groundResistanceForGain } from '../src/calculators/opAmp.ts'
import { calculateDivider, dividerBottomResistance, dividerInputVoltage, dividerTopResistance } from '../src/calculators/resistorDivider.ts'
import { calculateAcPower, calculateDcPower, calculateEfficiency, calculateResistivePower } from '../src/calculators/power.ts'
import { calculateEquivalentResistance, solveMissingResistance } from '../src/calculators/resistorNetwork.ts'
import { calculateEquivalentCapacitance, capacitanceCode, solveMissingCapacitance } from '../src/calculators/capacitance.ts'
import { calculateLedResistor } from '../src/calculators/ledResistor.ts'
import { calculateChecksum, convertIntegerBase, parseByteText } from '../src/calculators/dataTools.ts'
import { MAX_RECEIVE_BATCH_BYTES, receiveFlushDelay } from '../src/buffers/receiveBatching.ts'

test('连续高速串口数据即使没有空闲间隔也会在 100 ms 内刷新', () => {
  assert.equal(receiveFlushDelay(1000, 1010, 20, 100), 20)
  assert.equal(receiveFlushDelay(1000, 1095, 20, 100), 5)
  assert.equal(receiveFlushDelay(1000, 1100, 20, 100), 0)
  assert.equal(receiveFlushDelay(1000, 1001, 20, MAX_RECEIVE_BATCH_BYTES), 0)
})

test('进制转换支持四种进制、负数和超大整数', () => {
  assert.deepEqual(convertIntegerBase('FF', 16), { binary: '11111111', octal: '377', decimal: '255', hexadecimal: 'FF' })
  assert.equal(convertIntegerBase('-1010', 2).decimal, '-10')
  assert.equal(convertIntegerBase('18446744073709551615', 10).hexadecimal, 'FFFFFFFFFFFFFFFF')
  assert.throws(() => convertIntegerBase('102', 2), /不是有效的 2 进制/)
})

test('CRC 与校验计算符合标准测试向量', () => {
  const text = parseByteText('123456789', 'ascii')
  assert.equal(calculateChecksum(text, 'crc8'), 0xf4)
  assert.equal(calculateChecksum(text, 'crc16-modbus'), 0x4b37)
  assert.equal(calculateChecksum(text, 'crc16-ccitt'), 0x29b1)
  assert.equal(calculateChecksum(text, 'crc32'), 0xcbf43926)
  assert.deepEqual([...parseByteText('AA 55 01', 'hex')], [0xaa, 0x55, 0x01])
})

test('HEX 支持空格和连续字符，并拒绝非法字符与半字节', () => {
  assert.deepEqual(parseHexInput('AA 55 01 02').bytes, [0xaa, 0x55, 0x01, 0x02])
  assert.deepEqual(parseHexInput('AA550102').bytes, [0xaa, 0x55, 0x01, 0x02])
  assert.equal(parseHexInput('AA 5G').ok, false)
  assert.match(parseHexInput('ABC').error ?? '', /半字节/)
})

test('CSV 解析器正确处理拆包、粘包、负数和科学计数法', () => {
  const parser = new TextProtocolParser('csv')
  assert.equal(parser.consume(new TextEncoder().encode('1.2,-2.5')).frames.length, 0)
  const result = parser.consume(new TextEncoder().encode('e-3,3\r\n4,5,6\n'))
  assert.equal(result.frames.length, 2)
  assert.deepEqual(Array.from(result.frames[0].values.values()), [1.2, -0.0025, 3])
  assert.deepEqual(Array.from(result.frames[1].values.values()), [4, 5, 6])
})

test('CSV 非法行被隔离且不影响下一帧', () => {
  const parser = new TextProtocolParser('csv')
  const result = parser.consume(new TextEncoder().encode('1,,3\n7,8,9\n'))
  assert.equal(result.errors.length, 1)
  assert.equal(result.frames.length, 1)
})

test('NamedData 支持冒号、等号、顺序变化并拒绝普通日志', () => {
  const parser = new TextProtocolParser('named')
  const result = parser.consume(new TextEncoder().encode('voltage:3.7,current=-1.2e-3\n[INFO] started\ncurrent:2,voltage:4\n'))
  assert.equal(result.frames.length, 2)
  assert.equal(result.errors.length, 1)
  assert.equal(result.frames[1].values.get('current'), 2)
  assert.equal(result.frames[1].values.get('voltage'), 4)
})

test('环形缓冲区有固定上限并保留最新值', () => {
  const buffer = new RingBuffer<number>(3)
  for (let value = 1; value <= 5; value += 1) buffer.push(value)
  assert.deepEqual(buffer.toArray(), [3, 4, 5])
  buffer.resize(2)
  assert.deepEqual(buffer.toArray(), [4, 5])
})

function justFloatFrame(values: number[]): Uint8Array {
  const data = new Uint8Array(values.length * 4 + 4)
  const view = new DataView(data.buffer)
  values.forEach((value, index) => view.setFloat32(index * 4, value, true))
  data.set([0x00, 0x00, 0x80, 0x7f], values.length * 4)
  return data
}

test('JustFloat 支持拆包、粘包和丢字节后重新同步', () => {
  const parser = new JustFloatParser(3)
  const first = justFloatFrame([1.25, -2.5, 3e-3])
  assert.equal(parser.consume(first.slice(0, 7)).frames.length, 0)
  const joined = new Uint8Array(first.length - 7 + justFloatFrame([4, 5, 6]).length)
  joined.set(first.slice(7)); joined.set(justFloatFrame([4, 5, 6]), first.length - 7)
  const result = parser.consume(joined)
  assert.equal(result.frames.length, 2)
  assert.ok(Math.abs(result.frames[0][2] - 0.003) < 1e-7)

  const corrupt = new Uint8Array([0x99, 0x88, ...justFloatFrame([7, 8, 9])])
  const recovered = parser.consume(corrupt)
  assert.equal(recovered.frames.length, 1)
  assert.deepEqual(recovered.frames[0], [7, 8, 9])
  assert.match(recovered.errors.join(' '), /丢弃了 2 个多余字节/)
})

test('欧姆定律计算器支持六种任意两项组合', () => {
  assert.deepEqual(calculateOhmsLaw({ voltage: 12, current: 2 }).values, { voltage: 12, current: 2, resistance: 6, power: 24 })
  assert.equal(calculateOhmsLaw({ voltage: 12, resistance: 6 }).values.current, 2)
  assert.equal(calculateOhmsLaw({ voltage: 12, power: 24 }).values.resistance, 6)
  assert.equal(calculateOhmsLaw({ current: 2, resistance: 6 }).values.power, 24)
  assert.equal(calculateOhmsLaw({ current: 2, power: 24 }).values.voltage, 12)
  assert.equal(calculateOhmsLaw({ resistance: 6, power: 24 }).values.voltage, 12)
  assert.throws(() => calculateOhmsLaw({ voltage: 12 }), /正好输入两个/)
  assert.throws(() => calculateOhmsLaw({ voltage: 0, current: 2 }), /大于 0/)
})

test('同相运放计算增益、输出限幅并支持反算电阻', () => {
  assert.deepEqual(calculateNonInverting(10_000, 10_000, 0.5, 0, 3.3), { gain: 2, idealOutput: 1, actualOutput: 1, clipped: false })
  assert.deepEqual(calculateNonInverting(10_000, 100_000, 0.5, 0, 3.3), { gain: 11, idealOutput: 5.5, actualOutput: 3.3, clipped: true })
  assert.equal(feedbackResistanceForGain(10_000, 3), 20_000)
  assert.equal(groundResistanceForGain(20_000, 3), 10_000)
  assert.throws(() => feedbackResistanceForGain(10_000, 1), /大于 1/)
})

test('电阻分压计算器支持输出、输入与上下臂电阻反算', () => {
  const result = calculateDivider(5, 10_000, 10_000)
  assert.equal(result.outputVoltage, 2.5)
  assert.equal(result.ratio, 0.5)
  assert.equal(dividerInputVoltage(2.5, 10_000, 10_000), 5)
  assert.equal(dividerBottomResistance(5, 2.5, 10_000), 10_000)
  assert.equal(dividerTopResistance(5, 2.5, 10_000), 10_000)
  assert.throws(() => dividerTopResistance(3.3, 5, 10_000), /输出电压小于输入电压/)
})

test('功率计算器支持直流、阻性、单相、三相和效率反算', () => {
  assert.equal(calculateDcPower('power', { voltage: 12, current: 2 }), 24)
  assert.equal(calculateDcPower('current', { power: 24, voltage: 12 }), 2)
  assert.equal(calculateResistivePower('power', { voltage: 12, resistance: 6 }), 24)
  assert.equal(calculateResistivePower('resistance', { current: 2, power: 24 }), 6)
  assert.equal(calculateAcPower(1, 'power', { voltage: 220, current: 10, powerFactor: 0.8 }), 1760)
  assert.ok(Math.abs(calculateAcPower(3, 'current', { power: 11_000, voltage: 380, powerFactor: 0.8 }) - 11_000 / (Math.sqrt(3) * 380 * 0.8)) < 1e-9)
  assert.equal(calculateEfficiency('outputPower', { inputPower: 100, efficiency: 90 }), 90)
  assert.equal(calculateEfficiency('efficiency', { inputPower: 100, outputPower: 90 }), 90)
  assert.throws(() => calculateAcPower(1, 'power', { voltage: 220, current: 1, powerFactor: 1.2 }), /不超过 1/)
})

test('串并联电阻计算器支持多电阻等效值与缺失电阻反算', () => {
  assert.equal(calculateEquivalentResistance('series', [1_000, 2_000, 3_000]), 6_000)
  assert.ok(Math.abs(calculateEquivalentResistance('parallel', [1_000, 2_000]) - 666.6666666667) < 1e-7)
  assert.equal(solveMissingResistance('series', 10_000, [2_000, 3_000]), 5_000)
  assert.equal(solveMissingResistance('parallel', 500, [1_000, 2_000]), 2_000)
  assert.throws(() => calculateEquivalentResistance('series', [1_000]), /至少选择并填写两个/)
  assert.throws(() => solveMissingResistance('parallel', 2_000, [1_000]), /必须小于/)
})

test('串并联电容与电容代码换算正确', () => {
  assert.equal(calculateEquivalentCapacitance('parallel', [1e-6, 2e-6]), 3e-6)
  assert.ok(Math.abs(calculateEquivalentCapacitance('series', [1e-6, 2e-6]) - 2e-6 / 3) < 1e-18)
  assert.ok(Math.abs(solveMissingCapacitance('parallel', 5e-6, [2e-6, 1e-6]) - 2e-6) < 1e-18)
  assert.ok(Math.abs(solveMissingCapacitance('series', 0.5e-6, [1e-6, 2e-6]) - 2e-6) < 1e-18)
  assert.equal(capacitanceCode(100e-9), '104')
  assert.equal(capacitanceCode(4.7e-9), '472')
})

test('LED 限流计算推荐不超过目标电流的 E24 电阻和安全功率', () => {
  const result = calculateLedResistor(5, 2, 0.01, 1)
  assert.equal(result.resistance, 300)
  assert.equal(result.recommendedResistance, 300)
  assert.equal(result.actualCurrent, 0.01)
  assert.equal(result.recommendedPowerRating, 0.125)
  assert.throws(() => calculateLedResistor(5, 2, 0.01, 3), /必须大于/)
})
