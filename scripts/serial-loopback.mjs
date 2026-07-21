import { SerialPort } from 'serialport'

const path = process.argv[2] ?? 'COM10'
const baudRate = Number(process.argv[3] ?? 115200)
const expected = Buffer.from([0x55, 0xaa, 0x00, 0x7f, 0x80, 0xff, ...Buffer.from('DC Toolbox loopback\r\n')])
const received = []

const port = new SerialPort({ path, baudRate, autoOpen: false })

function fail(message) {
  console.error(`回环测试失败：${message}`)
  if (port.isOpen) port.close(() => process.exit(1))
  else process.exit(1)
}

const timeout = setTimeout(() => fail(`5 秒内未收到完整回环数据，已收到 ${Buffer.concat(received).length}/${expected.length} 字节。`), 5000)

port.on('data', (data) => {
  received.push(data)
  const actual = Buffer.concat(received)
  if (actual.length < expected.length) return
  clearTimeout(timeout)
  if (!actual.subarray(0, expected.length).equals(expected)) {
    fail(`数据不一致。发送 ${expected.toString('hex')}，接收 ${actual.toString('hex')}。`)
    return
  }
  port.close((error) => {
    if (error) fail(`数据一致，但关闭串口失败：${error.message}`)
    else {
      console.log(`回环测试通过：${path} @ ${baudRate}，${expected.length} 字节完全一致。`)
      process.exit(0)
    }
  })
})

port.open((openError) => {
  if (openError) {
    clearTimeout(timeout)
    fail(`无法打开 ${path}：${openError.message}`)
    return
  }
  port.write(expected, (writeError) => {
    if (writeError) fail(`写入失败：${writeError.message}`)
    else port.drain((drainError) => { if (drainError) fail(`等待发送完成失败：${drainError.message}`) })
  })
})
