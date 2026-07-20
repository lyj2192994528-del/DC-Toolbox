/// <reference types="vite/client" />

interface SerialPortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
  pnpId?: string
  locationId?: string
  productId?: string
  vendorId?: string
}

type SerialListResult =
  | { ok: true; ports: SerialPortInfo[] }
  | { ok: false; error: string }

interface Window {
  uartScope: {
    listSerialPorts: () => Promise<SerialListResult>
  }
}
