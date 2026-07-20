import { SerialPort } from 'serialport'

export interface SerialPortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
  pnpId?: string
  locationId?: string
  productId?: string
  vendorId?: string
}

/**
 * 扫描当前 Windows 可见的串口。
 * 失败时保留底层错误信息，供界面给出可操作的中文提示。
 */
export async function listSerialPorts(): Promise<SerialPortInfo[]> {
  const ports = await SerialPort.list()

  return ports.map((port) => ({
    path: port.path,
    manufacturer: port.manufacturer,
    serialNumber: port.serialNumber,
    pnpId: port.pnpId,
    locationId: port.locationId,
    productId: port.productId,
    vendorId: port.vendorId
  }))
}

