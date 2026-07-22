import { ref } from 'vue'

export type AppLanguage = 'zh-CN' | 'en-US'
type Dictionary = Record<string, string>

const saved = localStorage.getItem('dc-toolbox-language')
export const appLanguage = ref<AppLanguage>(saved === 'en-US' ? 'en-US' : 'zh-CN')

const zh: Dictionary = {
  'app.subtitle': '嵌入式开发调试工具箱', 'app.disconnected': '未连接',
  'welcome.kicker': '欢迎使用', 'welcome.subtitle': '免费开放的 Windows 嵌入式开发调试工具箱', 'welcome.email': '作者邮箱', 'welcome.group': 'QQ 交流群', 'welcome.repo': 'GitHub 仓库', 'welcome.pending': '待添加', 'welcome.groupIntro': '交流群介绍', 'welcome.hide': '启动时不再显示', 'welcome.about': '查看项目信息', 'welcome.enter': '进入工具箱', 'welcome.language': '界面语言',
  'nav.title': '工具导航', 'nav.count': '{count} 个工具', 'nav.about': '关于与联系',
  'connection.title': '串口连接', 'connection.detected': '检测到 {count} 个串口', 'connection.lockHint': '打开串口后配置将被锁定', 'connection.signals': '流控信号', 'connection.collapse': '收起参数', 'connection.expand': '展开参数', 'connection.refresh': '刷新串口', 'connection.scanning': '扫描中…', 'connection.port': 'COM 端口', 'connection.none': '暂无可用串口', 'connection.open': '打开串口', 'connection.close': '关闭串口', 'connection.connecting': '连接中…', 'connection.baud': '波特率', 'connection.dataBits': '数据位', 'connection.stopBits': '停止位', 'connection.parity': '校验位', 'connection.flow': '流控', 'connection.reconnect': '设备意外拔出后自动重连', 'connection.noDevice': '没有检测到串口', 'connection.insert': '请插入 USB 转串口设备，然后点击“刷新串口”。', 'connection.manufacturer': '制造商', 'connection.serial': '序列号', 'connection.notProvided': '未提供',
  'terminal.receive': '接收终端', 'terminal.send': '发送数据', 'terminal.pause': '暂停显示', 'terminal.resume': '恢复显示', 'terminal.clear': '清空', 'terminal.timestamp': '时间戳', 'terminal.lineBreak': '每条回包换行', 'terminal.autoScroll': '自动滚动', 'terminal.framing': '分帧', 'terminal.autoTimeout': '自适应超时（{ms} ms）', 'terminal.fixedTimeout': '固定空闲超时', 'terminal.untilLf': '遇到 \\n (LF)', 'terminal.untilCr': '遇到 \\r (CR)', 'terminal.untilCrlf': '遇到 \\r\\n (CR+LF)', 'terminal.search': '搜索文本', 'terminal.matches': '{count} 处', 'terminal.waiting': '等待接收串口数据…', 'terminal.input': '输入要发送的文本', 'terminal.encoding': '字符编码', 'terminal.suffix': '追加回车换行', 'terminal.checksum': '发送校验', 'terminal.none': '无追加', 'terminal.noChecksum': '无校验', 'terminal.sendButton': '发送', 'terminal.clearInput': '清空输入', 'terminal.history': '发送历史（最近 20 条）', 'terminal.period': '周期', 'terminal.timedSend': '定时发送', 'terminal.stopTimed': '停止定时', 'terminal.multi': '多条顺序循环发送（{count} 条）', 'terminal.selectAll': '全选', 'terminal.clearAll': '取消全选', 'terminal.add10': '增加 10 条', 'terminal.multiHint': '循环时每隔 {ms} ms 只发送下一条', 'terminal.command': '第 {index} 条指令', 'terminal.delete': '删除此条', 'terminal.sendSequenceOnce': '按周期顺序发送一次', 'terminal.startLoop': '开始顺序循环', 'terminal.stopLoop': '停止循环',
  'groups.communication': '通信与数据', 'groups.data': '数据工具', 'groups.calculate': '开发计算'
}

const en: Dictionary = {
  'app.subtitle': 'Embedded Development & Debugging Toolkit', 'app.disconnected': 'Disconnected',
  'welcome.kicker': 'WELCOME', 'welcome.subtitle': 'A free Windows toolkit for embedded development and debugging', 'welcome.email': 'Email', 'welcome.group': 'QQ Community', 'welcome.repo': 'GitHub Repository', 'welcome.pending': 'Coming soon', 'welcome.groupIntro': 'Community', 'welcome.hide': 'Do not show at startup', 'welcome.about': 'Project information', 'welcome.enter': 'Enter Toolbox', 'welcome.language': 'Language',
  'nav.title': 'Toolbox', 'nav.count': '{count} tools', 'nav.about': 'About & Contact',
  'connection.title': 'Serial Connection', 'connection.detected': '{count} serial ports detected', 'connection.lockHint': 'Settings are locked while connected', 'connection.signals': 'Signals', 'connection.collapse': 'Collapse', 'connection.expand': 'Configure', 'connection.refresh': 'Refresh Ports', 'connection.scanning': 'Scanning…', 'connection.port': 'COM Port', 'connection.none': 'No available ports', 'connection.open': 'Open Port', 'connection.close': 'Close Port', 'connection.connecting': 'Connecting…', 'connection.baud': 'Baud Rate', 'connection.dataBits': 'Data Bits', 'connection.stopBits': 'Stop Bits', 'connection.parity': 'Parity', 'connection.flow': 'Flow Control', 'connection.reconnect': 'Reconnect after unexpected removal', 'connection.noDevice': 'No serial port detected', 'connection.insert': 'Connect a USB serial device, then click Refresh Ports.', 'connection.manufacturer': 'Manufacturer', 'connection.serial': 'Serial Number', 'connection.notProvided': 'Not provided',
  'terminal.receive': 'Receive Terminal', 'terminal.send': 'Send Data', 'terminal.pause': 'Pause', 'terminal.resume': 'Resume', 'terminal.clear': 'Clear', 'terminal.timestamp': 'Timestamp', 'terminal.lineBreak': 'New line per frame', 'terminal.autoScroll': 'Auto scroll', 'terminal.framing': 'Framing', 'terminal.autoTimeout': 'Adaptive timeout ({ms} ms)', 'terminal.fixedTimeout': 'Fixed idle timeout', 'terminal.untilLf': 'Until \\n (LF)', 'terminal.untilCr': 'Until \\r (CR)', 'terminal.untilCrlf': 'Until \\r\\n (CR+LF)', 'terminal.search': 'Search text', 'terminal.matches': '{count} matches', 'terminal.waiting': 'Waiting for serial data…', 'terminal.input': 'Enter data to send', 'terminal.encoding': 'Encoding', 'terminal.suffix': 'Line Ending', 'terminal.checksum': 'Checksum', 'terminal.none': 'None', 'terminal.noChecksum': 'None', 'terminal.sendButton': 'Send', 'terminal.clearInput': 'Clear Input', 'terminal.history': 'Send history (latest 20)', 'terminal.period': 'Period', 'terminal.timedSend': 'Timed Send', 'terminal.stopTimed': 'Stop', 'terminal.multi': 'Sequential Loop Send ({count})', 'terminal.selectAll': 'Select All', 'terminal.clearAll': 'Clear All', 'terminal.add10': 'Add 10', 'terminal.multiHint': 'Send only the next item every {ms} ms', 'terminal.command': 'Command {index}', 'terminal.delete': 'Delete', 'terminal.sendSequenceOnce': 'Send Sequence Once', 'terminal.startLoop': 'Start Loop', 'terminal.stopLoop': 'Stop Loop',
  'groups.communication': 'Communication & Data', 'groups.data': 'Data Tools', 'groups.calculate': 'Engineering Calculators'
}

export function setAppLanguage(language: AppLanguage): void {
  appLanguage.value = language
  localStorage.setItem('dc-toolbox-language', language)
  document.documentElement.lang = language
}

export function useI18n(): { language: typeof appLanguage; t: (key: string, variables?: Record<string, string | number>) => string } {
  const t = (key: string, variables: Record<string, string | number> = {}): string => {
    let value = (appLanguage.value === 'en-US' ? en : zh)[key] ?? zh[key] ?? key
    for (const [name, replacement] of Object.entries(variables)) value = value.replaceAll(`{${name}}`, String(replacement))
    return value
  }
  return { language: appLanguage, t }
}
