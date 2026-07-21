<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { calculateAcPower, calculateDcPower, calculateEfficiency, calculateResistivePower, type AcPowerTarget, type DcPowerTarget, type EfficiencyTarget, type ResistivePowerTarget } from '@/calculators/power'

type Mode = 'dc' | 'resistive' | 'single' | 'three' | 'efficiency'
type Quantity = 'power' | 'voltage' | 'current' | 'resistance' | 'outputPower' | 'inputPower' | 'efficiency'
interface Unit { label: string; factor: number }
interface InputDefinition { key: Quantity; label: string; units: Unit[] }

const mode = ref<Mode>('dc')
const target = ref<Quantity>('power')
const values = reactive<Record<Quantity, string>>({ power: '', voltage: '', current: '', resistance: '', outputPower: '', inputPower: '', efficiency: '' })
const factors = reactive<Record<Quantity, number>>({ power: 1, voltage: 1, current: 1, resistance: 1, outputPower: 1, inputPower: 1, efficiency: 1 })
const powerFactor = ref('0.8')
const resistivePair = ref<'voltage' | 'current'>('voltage')
const result = ref<number | null>(null)
const error = ref('')

const units: Record<Quantity, Unit[]> = {
  power: [{ label: 'W', factor: 1 }, { label: 'mW', factor: 1e-3 }, { label: 'kW', factor: 1e3 }, { label: 'MW', factor: 1e6 }],
  voltage: [{ label: 'V', factor: 1 }, { label: 'mV', factor: 1e-3 }, { label: 'kV', factor: 1e3 }],
  current: [{ label: 'A', factor: 1 }, { label: 'mA', factor: 1e-3 }, { label: 'μA', factor: 1e-6 }, { label: 'kA', factor: 1e3 }],
  resistance: [{ label: 'Ω', factor: 1 }, { label: 'mΩ', factor: 1e-3 }, { label: 'kΩ', factor: 1e3 }, { label: 'MΩ', factor: 1e6 }],
  outputPower: [{ label: 'W', factor: 1 }, { label: 'mW', factor: 1e-3 }, { label: 'kW', factor: 1e3 }],
  inputPower: [{ label: 'W', factor: 1 }, { label: 'mW', factor: 1e-3 }, { label: 'kW', factor: 1e3 }],
  efficiency: [{ label: '%', factor: 1 }]
}
const labels: Record<Quantity, string> = { power: '有功功率 P', voltage: '电压 U', current: '电流 I', resistance: '电阻 R', outputPower: '输出功率 Pout', inputPower: '输入功率 Pin', efficiency: '效率 η' }
const modeInfo = computed(() => ({
  dc: { title: '直流功率', formula: 'P = U × I', targets: ['power', 'voltage', 'current'] as Quantity[] },
  resistive: { title: '纯阻性负载', formula: 'P = U² ÷ R = I² × R', targets: ['power', 'voltage', 'current', 'resistance'] as Quantity[] },
  single: { title: '单相交流', formula: 'P = U × I × cosφ', targets: ['power', 'voltage', 'current'] as Quantity[] },
  three: { title: '三相交流', formula: 'P = √3 × U × I × cosφ', targets: ['power', 'voltage', 'current'] as Quantity[] },
  efficiency: { title: '效率换算', formula: 'η = Pout ÷ Pin × 100%', targets: ['outputPower', 'inputPower', 'efficiency'] as Quantity[] }
})[mode.value])
const inputs = computed<InputDefinition[]>(() => {
  let keys: Quantity[]
  if (mode.value === 'efficiency') keys = ['outputPower', 'inputPower', 'efficiency'].filter((key) => key !== target.value) as Quantity[]
  else if (mode.value === 'resistive') {
    if (target.value === 'power' || target.value === 'resistance') keys = [resistivePair.value, target.value === 'power' ? 'resistance' : 'power']
    else keys = ['power', 'resistance']
  } else keys = ['power', 'voltage', 'current'].filter((key) => key !== target.value) as Quantity[]
  return keys.map((key) => ({ key, label: labels[key], units: units[key] }))
})
const resultUnit = computed(() => target.value === 'efficiency' ? '%' : units[target.value][0].label)

function switchMode(next: Mode): void { mode.value = next; target.value = next === 'efficiency' ? 'outputPower' : 'power'; clearResult() }
function clearResult(): void { result.value = null; error.value = '' }
function numeric(key: Quantity): number { return Number(values[key]) * factors[key] }
function calculate(): void {
  error.value = ''
  try {
    if (mode.value === 'dc') result.value = calculateDcPower(target.value as DcPowerTarget, { power: numeric('power'), voltage: numeric('voltage'), current: numeric('current') })
    else if (mode.value === 'resistive') result.value = calculateResistivePower(target.value as ResistivePowerTarget, { power: numeric('power'), voltage: numeric('voltage'), current: numeric('current'), resistance: numeric('resistance') })
    else if (mode.value === 'single' || mode.value === 'three') result.value = calculateAcPower(mode.value === 'three' ? 3 : 1, target.value as AcPowerTarget, { power: numeric('power'), voltage: numeric('voltage'), current: numeric('current'), powerFactor: Number(powerFactor.value) })
    else result.value = calculateEfficiency(target.value as EfficiencyTarget, { outputPower: numeric('outputPower'), inputPower: numeric('inputPower'), efficiency: numeric('efficiency') })
  } catch (cause) { result.value = null; error.value = cause instanceof Error ? cause.message : String(cause) }
}
function format(value: number): string { return Number(value.toPrecision(9)).toLocaleString('zh-CN', { maximumFractionDigits: 9 }) }
</script>

<template>
  <section class="power-layout">
    <div class="panel power-calculator-panel">
      <div class="panel-toolbar"><div><h2>功率计算器</h2><p>直流、阻性负载、单相/三相交流与效率换算</p></div><span class="circuit-type">{{ modeInfo.formula }}</span></div>
      <div class="power-mode-tabs">
        <button v-for="item in ([['dc','直流'],['resistive','纯阻性'],['single','单相交流'],['three','三相交流'],['efficiency','效率']] as const)" :key="item[0]" :class="{ active: mode === item[0] }" @click="switchMode(item[0])">{{ item[1] }}</button>
      </div>
      <h3 class="power-section-title">选择要计算的量</h3>
      <div class="solve-targets power-targets"><label v-for="item in modeInfo.targets" :key="item" :class="{ active: target === item }"><input v-model="target" type="radio" :value="item" @change="clearResult" />求{{ labels[item] }}</label></div>
      <label v-if="mode === 'resistive' && (target === 'power' || target === 'resistance')" class="resistive-source">已知方式<select v-model="resistivePair" @change="clearResult"><option value="voltage">已知电压</option><option value="current">已知电流</option></select></label>
      <div class="power-input-grid">
        <label v-for="input in inputs" :key="input.key"><span>{{ input.label }}</span><div class="value-with-unit"><input v-model="values[input.key]" type="number" min="0" step="any" placeholder="输入数值" @input="clearResult" /><select v-model.number="factors[input.key]" @change="clearResult"><option v-for="unit in input.units" :key="unit.label" :value="unit.factor">{{ unit.label }}</option></select></div></label>
        <label v-if="mode === 'single' || mode === 'three'"><span>功率因数 cosφ（0～1）</span><input v-model="powerFactor" type="number" min="0" max="1" step="0.01" @input="clearResult" /></label>
      </div>
      <button class="wide-action" @click="calculate">计算结果</button>
      <p v-if="error" class="error-message">{{ error }}</p>
      <div v-if="result !== null" class="unified-result"><span>{{ labels[target] }}</span><strong>{{ format(result) }} {{ resultUnit }}</strong><code>{{ modeInfo.formula }}</code></div>
    </div>
    <aside class="panel power-guide-panel">
      <h2>{{ modeInfo.title }}</h2>
      <div class="power-symbol"><strong>P</strong><span>POWER</span></div>
      <div class="power-formula">{{ modeInfo.formula }}</div>
      <div class="power-help"><strong>使用说明</strong><p v-if="mode === 'dc'">适用于直流电源、开发板和普通直流负载，可反算功率、电压或电流。</p><p v-else-if="mode === 'resistive'">适用于电阻、加热丝等纯阻性负载，可用电压或电流方式计算功率与电阻。</p><p v-else-if="mode === 'single'">适用于单相交流负载；功率因数为有功功率与视在功率之比。</p><p v-else-if="mode === 'three'">使用线电压和线电流计算平衡三相负载的有功功率。</p><p v-else>用于电源转换器、稳压器和电机系统的输入功率、输出功率与效率换算。</p></div>
      <div class="power-note"><strong>提示</strong><p>计算结果统一以基础单位显示；输入框可直接选择 mW、kW、mV、mA、kΩ 等工程单位。</p></div>
    </aside>
  </section>
</template>
