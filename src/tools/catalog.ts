/** 工具 ID 是页面导航的稳定标识，发布后不要随意修改。 */
export type ToolPageId = 'terminal' | 'waveform' | 'recording' | 'replay' | 'virtualPort' | 'ble' | 'usb' | 'networkProtocols' | 'baseConverter' | 'checksum' | 'csv' | 'ohms' | 'power' | 'network' | 'capacitors' | 'capconvert' | 'led' | 'opamp' | 'divider'

export interface ToolDefinition { id: ToolPageId; label: string; icon: string }

export const toolGroups: Array<{ title: string; tools: ToolDefinition[] }> = [
  { title: '通信与数据', tools: [
    { id: 'terminal', label: '串口终端', icon: '终' },
    { id: 'waveform', label: '实时波形', icon: '波' },
    { id: 'recording', label: '数据记录', icon: '录' },
    { id: 'replay', label: '记录与回放', icon: '▶' },
    { id: 'virtualPort', label: '虚拟串口', icon: '↔' },
    { id: 'ble', label: 'BLE', icon: 'B' },
    { id: 'usb', label: 'USB / HID', icon: 'U' },
    { id: 'networkProtocols', label: 'TCP / UDP / MQTT', icon: 'N' }
  ] },
  { title: '数据工具', tools: [
    { id: 'baseConverter', label: '进制转换', icon: '10' },
    { id: 'checksum', label: 'CRC / 校验', icon: 'CRC' },
    { id: 'csv', label: 'CSV 分析', icon: 'CSV' }
  ] },
  { title: '开发计算', tools: [
    { id: 'ohms', label: '欧姆定律', icon: 'Ω' },
    { id: 'power', label: '功率计算', icon: 'P' },
    { id: 'network', label: '串并联电阻', icon: 'R∥' },
    { id: 'capacitors', label: '串并联电容', icon: 'C∥' },
    { id: 'capconvert', label: '电容换算', icon: 'μF' },
    { id: 'led', label: 'LED 限流', icon: 'LED' },
    { id: 'opamp', label: '运放计算', icon: 'Av' },
    { id: 'divider', label: '电阻分压', icon: '÷' }
  ] }
]

export const toolCount = toolGroups.reduce((count, group) => count + group.tools.length, 0)
