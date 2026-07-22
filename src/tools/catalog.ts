/** 工具 ID 是页面导航的稳定标识，发布后不要随意修改。 */
export type ToolPageId = 'terminal' | 'waveform' | 'recording' | 'virtualPort' | 'ble' | 'usb' | 'networkProtocols' | 'mediaDownloader' | 'audioExtractor' | 'baseConverter' | 'checksum' | 'csv' | 'ohms' | 'power' | 'network' | 'capacitors' | 'capconvert' | 'led' | 'opamp' | 'divider'

export interface ToolDefinition { id: ToolPageId; label: string; labelEn: string; icon: string }

export const toolGroups: Array<{ title: string; titleEn: string; tools: ToolDefinition[] }> = [
  { title: '通信与数据', titleEn: 'Communication & Data', tools: [
    { id: 'terminal', label: '串口终端', labelEn: 'Serial Terminal', icon: '终' },
    { id: 'waveform', label: '实时波形', labelEn: 'Live Waveform', icon: '波' },
    { id: 'recording', label: '数据记录', labelEn: 'Data Recording', icon: '录' },
    { id: 'virtualPort', label: '虚拟串口', labelEn: 'Virtual Ports', icon: '↔' },
    { id: 'ble', label: 'BLE', labelEn: 'BLE', icon: 'B' },
    { id: 'usb', label: 'USB / HID', labelEn: 'USB / HID', icon: 'U' },
    { id: 'networkProtocols', label: 'TCP / UDP / MQTT', labelEn: 'TCP / UDP / MQTT', icon: 'N' }
  ] },
  { title: '数据工具', titleEn: 'Data Tools', tools: [
    { id: 'mediaDownloader', label: '网页媒体下载', labelEn: 'Media Downloader', icon: '▶' },
    { id: 'audioExtractor', label: '音频提取', labelEn: 'Audio Extractor', icon: '♪' },
    { id: 'baseConverter', label: '进制转换', labelEn: 'Base Converter', icon: '10' },
    { id: 'checksum', label: 'CRC / 校验', labelEn: 'CRC / Checksum', icon: 'CRC' },
    { id: 'csv', label: 'CSV 分析', labelEn: 'CSV Analyzer', icon: 'CSV' }
  ] },
  { title: '开发计算', titleEn: 'Engineering Calculators', tools: [
    { id: 'ohms', label: '欧姆定律', labelEn: "Ohm's Law", icon: 'Ω' },
    { id: 'power', label: '功率计算', labelEn: 'Power', icon: 'P' },
    { id: 'network', label: '串并联电阻', labelEn: 'Resistor Network', icon: 'R∥' },
    { id: 'capacitors', label: '串并联电容', labelEn: 'Capacitor Network', icon: 'C∥' },
    { id: 'capconvert', label: '电容换算', labelEn: 'Capacitance Converter', icon: 'μF' },
    { id: 'led', label: 'LED 限流', labelEn: 'LED Resistor', icon: 'LED' },
    { id: 'opamp', label: '运放计算', labelEn: 'Op-Amp', icon: 'Av' },
    { id: 'divider', label: '电阻分压', labelEn: 'Voltage Divider', icon: '÷' }
  ] }
]

export const toolCount = toolGroups.reduce((count, group) => count + group.tools.length, 0)
