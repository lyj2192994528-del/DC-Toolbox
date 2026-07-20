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

interface SerialOpenOptions {
  path: string
  baudRate: number
  dataBits: 5 | 6 | 7 | 8
  stopBits: 1 | 1.5 | 2
  parity: 'none' | 'even' | 'odd' | 'mark' | 'space'
  rtscts: boolean
}

type SerialActionResult = { ok: true } | { ok: false; error: string }
type SerialWriteResult = { ok: true; bytesWritten: number } | { ok: false; error: string }
type SerialStatusEvent =
  | { state: 'connected'; message: string; path: string; baudRate: number }
  | { state: 'disconnected'; message: string; unexpected: boolean }
  | { state: 'error'; message: string }

interface RecorderStatus { recording: boolean; filePath?: string; bytesWritten: number; error?: string }
interface PersistedSettings {
  serial: { path: string; baudRate: string; dataBits: 5 | 6 | 7 | 8; stopBits: 1 | 1.5 | 2; parity: 'none' | 'even' | 'odd' | 'mark' | 'space'; flowControl: 'none' | 'rtscts'; customBaudRates: number[] }
  window?: { x?: number; y?: number; width: number; height: number }
}

interface Window {
  uartScope: {
    listSerialPorts: () => Promise<SerialListResult>
    openSerialPort: (options: SerialOpenOptions) => Promise<SerialActionResult>
    closeSerialPort: () => Promise<SerialActionResult>
    writeSerialData: (data: number[]) => Promise<SerialWriteResult>
    onSerialStatus: (listener: (status: SerialStatusEvent) => void) => () => void
    onSerialData: (listener: (data: Uint8Array) => void) => () => void
    chooseRecordDirectory: () => Promise<string | null>
    startRecording: (options: { directory: string; serialSummary: string }) => Promise<{ ok: true; status: RecorderStatus } | { ok: false; error: string }>
    stopRecording: () => Promise<{ ok: true; status: RecorderStatus } | { ok: false; error: string }>
    onRecordStatus: (listener: (status: RecorderStatus) => void) => () => void
    exportCsv: (csv: string) => Promise<{ ok: true; canceled: boolean; filePath?: string } | { ok: false; error: string }>
    getSettings: () => Promise<{ settings: PersistedSettings; warning: string }>
    setSettings: (settings: PersistedSettings) => Promise<{ ok: true } | { ok: false; error: string }>
  }
}
