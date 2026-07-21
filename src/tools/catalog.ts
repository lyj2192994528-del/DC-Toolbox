/** 工具 ID 是页面导航的稳定标识，发布后不要随意修改。 */
export type ToolPageId = 'terminal' | 'waveform' | 'recording' | 'ohms' | 'power' | 'network' | 'capacitors' | 'capconvert' | 'led' | 'opamp' | 'divider'

export interface ToolDefinition { id: ToolPageId; label: string; icon: string }

/** 新增工具时在所属分组增加一项，并创建 src/tools/<工具名>/index.ts。 */
export const toolGroups: Array<{ title: string; tools: ToolDefinition[] }> = [
  { title: '通信与数据', tools: [
    { id: 'terminal', label: '串口终端', icon: '终' },
    { id: 'waveform', label: '实时波形', icon: '波' },
    { id: 'recording', label: '数据记录', icon: '录' }
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
