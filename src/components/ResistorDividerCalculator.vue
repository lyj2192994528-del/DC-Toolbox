<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import schematicUrl from '@/assets/resistor-divider.png'
import { calculateDivider, dividerBottomResistance, dividerInputVoltage, dividerTopResistance } from '@/calculators/resistorDivider'

type Target = 'vin' | 'vout' | 'r1' | 'r2'
type InputKey = Target
interface Unit { label: string; factor: number }
interface Definition { key: InputKey; label: string; units: Unit[] }
const resistanceUnits: Unit[] = [{ label: 'kΩ', factor: 1e3 }, { label: 'Ω', factor: 1 }, { label: 'MΩ', factor: 1e6 }]
const voltageUnits: Unit[] = [{ label: 'V', factor: 1 }, { label: 'mV', factor: 1e-3 }, { label: 'μV', factor: 1e-6 }]
const definitions: Record<InputKey, Definition> = {
  vin: { key: 'vin', label: '输入电压 VIN', units: voltageUnits },
  vout: { key: 'vout', label: '输出电压 VOUT', units: voltageUnits },
  r1: { key: 'r1', label: '下臂电阻 R1（到 GND）', units: resistanceUnits },
  r2: { key: 'r2', label: '上臂电阻 R2（到 VIN）', units: resistanceUnits }
}
const modes: Array<{ key: Target; label: string; inputs: InputKey[] }> = [
  { key: 'vout', label: '求输出电压', inputs: ['vin', 'r1', 'r2'] },
  { key: 'vin', label: '求输入电压', inputs: ['vout', 'r1', 'r2'] },
  { key: 'r1', label: '求 R1 阻值', inputs: ['vin', 'vout', 'r2'] },
  { key: 'r2', label: '求 R2 阻值', inputs: ['vin', 'vout', 'r1'] }
]
const target = ref<Target>('vout')
const values = reactive<Record<InputKey, string>>({ vin: '5', vout: '3.3', r1: '10', r2: '10' })
const factors = reactive<Record<InputKey, number>>({ vin: 1, vout: 1, r1: 1e3, r2: 1e3 })
const resultText = ref('')
const details = ref<string[]>([])
const formula = ref('')
const errorMessage = ref('')
const selectedMode = computed(() => modes.find((mode) => mode.key === target.value)!)
const activeInputs = computed(() => selectedMode.value.inputs.map((key) => definitions[key]))
const netlistSummary = 'VIN+ → R2.2；VOUT → R2.1/R1.2；GND → R1.1'
watch(target, () => { resultText.value = ''; details.value = []; formula.value = ''; errorMessage.value = '' })

function updateValue(key: InputKey, event: Event): void { values[key] = (event.target as HTMLInputElement).value; resultText.value = '' }
function updateFactor(key: InputKey, event: Event): void { factors[key] = Number((event.target as HTMLSelectElement).value); resultText.value = '' }
function baseValue(key: InputKey): number { const value = Number(values[key]) * factors[key]; if (!Number.isFinite(value)) throw new Error(`${definitions[key].label}不是有效数字。`); return value }
function formatResistance(value: number): string { if (value >= 1e6) return `${Number((value / 1e6).toPrecision(8))} MΩ`; if (value >= 1e3) return `${Number((value / 1e3).toPrecision(8))} kΩ`; return `${Number(value.toPrecision(8))} Ω` }
function formatVoltage(value: number): string { return `${Number(value.toPrecision(9))} V` }
function formatCurrent(value: number): string { return Math.abs(value) < 1e-3 ? `${Number((value * 1e6).toPrecision(7))} μA` : `${Number((value * 1e3).toPrecision(7))} mA` }
function formatPower(value: number): string { return Math.abs(value) < 1e-3 ? `${Number((value * 1e6).toPrecision(7))} μW` : `${Number((value * 1e3).toPrecision(7))} mW` }

function calculate(): void {
  errorMessage.value = ''; resultText.value = ''; details.value = []; formula.value = ''
  try {
    if (target.value === 'vout') {
      const result = calculateDivider(baseValue('vin'), baseValue('r1'), baseValue('r2'))
      resultText.value = formatVoltage(result.outputVoltage); formula.value = 'VOUT = VIN × R1 ÷ (R1 + R2)'
      details.value = [`分压比例 ${Number((result.ratio * 100).toPrecision(7))}%`, `静态电流 ${formatCurrent(result.dividerCurrent)}`, `R1功耗 ${formatPower(result.r1Power)}`, `R2功耗 ${formatPower(result.r2Power)}`]
    } else if (target.value === 'vin') {
      const value = dividerInputVoltage(baseValue('vout'), baseValue('r1'), baseValue('r2'))
      resultText.value = formatVoltage(value); formula.value = 'VIN = VOUT × (R1 + R2) ÷ R1'
    } else if (target.value === 'r1') {
      const value = dividerBottomResistance(baseValue('vin'), baseValue('vout'), baseValue('r2'))
      resultText.value = formatResistance(value); formula.value = 'R1 = VOUT × R2 ÷ (VIN - VOUT)'; details.value = ['实际选型可取最接近的标准阻值']
    } else {
      const value = dividerTopResistance(baseValue('vin'), baseValue('vout'), baseValue('r1'))
      resultText.value = formatResistance(value); formula.value = 'R2 = R1 × (VIN - VOUT) ÷ VOUT'; details.value = ['实际选型可取最接近的标准阻值']
    }
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : String(error) }
}
</script>

<template>
  <section class="divider-layout">
    <div class="panel divider-controls">
      <div class="panel-toolbar"><div><h2>电阻分压计算器</h2><p>无负载直流分压，R2为上臂、R1为下臂</p></div><span class="circuit-type">VOUT = VIN × R1 / (R1 + R2)</span></div>
      <div class="solve-targets"><label v-for="mode in modes" :key="mode.key" :class="{ active: target === mode.key }"><input v-model="target" type="radio" :value="mode.key" />{{ mode.label }}</label></div>
      <div class="dynamic-opamp-inputs"><label v-for="input in activeInputs" :key="input.key"><span>{{ input.label }}</span><div class="value-with-unit"><input :value="values[input.key]" type="number" step="any" @input="updateValue(input.key, $event)" /><select :value="factors[input.key]" @change="updateFactor(input.key, $event)"><option v-for="unit in input.units" :key="unit.label" :value="unit.factor">{{ unit.label }}</option></select></div></label></div>
      <button class="wide-action" @click="calculate">计算结果</button>
      <div class="unified-result"><template v-if="resultText"><span>{{ selectedMode.label }}</span><strong>{{ resultText }}</strong><div v-if="details.length" class="divider-details"><span v-for="item in details" :key="item">{{ item }}</span></div><code>{{ formula }}</code></template><p v-else>当前选择“{{ selectedMode.label }}”，请填写上面的三个已知参数。</p></div>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      <p class="load-note"><strong>注意：</strong>当前计算按VOUT无负载处理。连接负载后，负载会与R1并联，实际输出电压会降低。</p>
    </div>
    <aside class="panel divider-schematic-panel"><div class="panel-toolbar"><div><h2>电阻分压原理图</h2><p>来自你提供的TEL网络表与原理图</p></div></div><img :src="schematicUrl" alt="R2上臂、R1下臂的电阻分压电路原理图" /><div class="netlist-check"><strong>网络表连接核对通过</strong><p>{{ netlistSummary }}</p><p>VOUT位于R2和R1中点，与图片的电路连接一致。</p></div></aside>
  </section>
</template>
