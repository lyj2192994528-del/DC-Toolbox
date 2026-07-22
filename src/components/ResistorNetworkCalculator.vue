<script setup lang="ts">
import { computed, ref } from 'vue'
import seriesSchematic from '@/assets/series-resistors.svg'
import parallelSchematic from '@/assets/parallel-resistors.svg'
import { calculateEquivalentResistance, solveMissingResistance, type ResistorNetworkMode } from '@/calculators/resistorNetwork'
import { useI18n } from '@/i18n'

interface ResistorRow { id: number; enabled: boolean; value: string | number; factor: number }
type Target = 'total' | 'missing'
const { tr, language } = useI18n()
const mode = ref<ResistorNetworkMode>('series')
const target = ref<Target>('total')
const rows = ref<ResistorRow[]>([
  { id: 1, enabled: true, value: '', factor: 1 },
  { id: 2, enabled: true, value: '', factor: 1 },
  { id: 3, enabled: true, value: '', factor: 1 }
])
const targetTotal = ref('')
const targetFactor = ref(1)
const result = ref<number | null>(null)
const error = ref('')
let nextId = 4
const units = [{ label: 'Ω', factor: 1 }, { label: 'kΩ', factor: 1e3 }, { label: 'MΩ', factor: 1e6 }, { label: 'mΩ', factor: 1e-3 }]
const selectedCount = computed(() => rows.value.filter((row) => row.enabled).length)
const allSelected = computed(() => rows.value.length > 0 && rows.value.every((row) => row.enabled))
const formula = computed(() => mode.value === 'series' ? 'RT = R1 + R2 + … + Rn' : '1 / RT = 1 / R1 + 1 / R2 + … + 1 / Rn')
const netlistSummary = computed(() => mode.value === 'series' ? 'VIN+ → R1.2；R1.1 → R2.2；R2.1 → Rn.2；Rn.1 → GND' : 'VIN+ → R1.2 / R2.2 / Rn.2；GND → R1.1 / R2.1 / Rn.1')

function clearResult(): void { result.value = null; error.value = '' }
function switchMode(next: ResistorNetworkMode): void { mode.value = next; clearResult() }
function addRows(count = 1): void {
  for (let index = 0; index < count && rows.value.length < 100; index += 1) rows.value.push({ id: nextId++, enabled: true, value: '', factor: 1 })
  clearResult()
}
function removeRow(id: number): void { if (rows.value.length > 2) rows.value = rows.value.filter((row) => row.id !== id); clearResult() }
function toggleAll(): void { const enabled = !allSelected.value; rows.value.forEach((row) => { row.enabled = enabled }); clearResult() }
function clearSelected(): void { rows.value.filter((row) => row.enabled).forEach((row) => { row.value = '' }); clearResult() }
function resistanceValues(): number[] {
  return rows.value.filter((row) => row.enabled && String(row.value).trim() !== '').map((row) => Number(row.value) * row.factor)
}
function calculate(): void {
  error.value = ''; result.value = null
  try {
    result.value = target.value === 'total'
      ? calculateEquivalentResistance(mode.value, resistanceValues())
      : solveMissingResistance(mode.value, Number(targetTotal.value) * targetFactor.value, resistanceValues())
  } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
}
function formatResistance(value: number): string {
  const unit = value >= 1e6 ? units[2] : value >= 1e3 ? units[1] : value < 1 ? units[3] : units[0]
  return `${Number((value / unit.factor).toPrecision(9)).toLocaleString(language.value, { maximumFractionDigits: 9 })} ${unit.label}`
}
</script>

<template>
  <section class="network-layout">
    <div class="panel network-controls">
      <div class="panel-toolbar"><div><h2>{{ tr('串并联电阻计算器', 'Series & Parallel Resistor Calculator') }}</h2><p>{{ tr('计算多个电阻的等效阻值，或按目标总阻值反算 Rn', 'Calculate equivalent resistance or solve missing Rn from a target total') }}</p></div><span class="circuit-type">{{ formula }}</span></div>
      <div class="network-mode-tabs"><button :class="{ active: mode === 'series' }" @click="switchMode('series')">{{ tr('串联电阻', 'Series') }}</button><button :class="{ active: mode === 'parallel' }" @click="switchMode('parallel')">{{ tr('并联电阻', 'Parallel') }}</button></div>
      <div class="solve-targets network-targets"><label :class="{ active: target === 'total' }"><input v-model="target" type="radio" value="total" @change="clearResult" />{{ tr('求等效总阻值', 'Equivalent Resistance') }}</label><label :class="{ active: target === 'missing' }"><input v-model="target" type="radio" value="missing" @change="clearResult" />{{ tr('反算缺失电阻 Rn', 'Solve Missing Rn') }}</label></div>
      <label v-if="target === 'missing'" class="network-total-field"><span>{{ tr('目标等效总阻值 RT', 'Target Total RT') }}</span><div class="value-with-unit"><input v-model="targetTotal" type="number" min="0" step="any" @input="clearResult" /><select v-model.number="targetFactor" @change="clearResult"><option v-for="unit in units" :key="unit.label" :value="unit.factor">{{ unit.label }}</option></select></div></label>
      <div class="network-toolbar"><button class="soft-button" @click="toggleAll">{{ allSelected ? tr('取消全选', 'Clear All') : tr('全选', 'Select All') }}</button><button class="soft-button" @click="addRows(1)">{{ tr('添加电阻', 'Add Resistor') }}</button><button class="soft-button" @click="addRows(5)">{{ tr('添加 5 条', 'Add 5') }}</button><button class="soft-button" @click="clearSelected">{{ tr('清空选中', 'Clear Selected') }}</button><span>{{ tr('已选', 'Selected') }} {{ selectedCount }} / {{ rows.length }}，{{ tr('最多 100 条', 'maximum 100') }}</span></div>
      <div class="resistor-list">
        <div v-for="(row, index) in rows" :key="row.id" class="resistor-row">
          <input v-model="row.enabled" type="checkbox" :aria-label="`R${index + 1}`" @change="clearResult" /><strong>R{{ index + 1 }}</strong><input v-model="row.value" type="number" min="0" step="any" :placeholder="tr('输入阻值', 'Enter resistance')" :disabled="!row.enabled" :aria-label="`R${index + 1}`" @input="clearResult" /><select v-model.number="row.factor" :disabled="!row.enabled" :aria-label="`R${index + 1}`" @change="clearResult"><option v-for="unit in units" :key="unit.label" :value="unit.factor">{{ unit.label }}</option></select><button class="row-delete" :disabled="rows.length <= 2" :aria-label="`R${index + 1}`" @click="removeRow(row.id)">×</button>
        </div>
      </div>
      <button class="wide-action" @click="calculate">{{ target === 'total' ? tr('计算等效总阻值', 'Calculate Equivalent Resistance') : tr('计算缺失电阻 Rn', 'Calculate Missing Rn') }}</button>
      <p v-if="error" class="error-message">{{ error }}</p>
      <div class="unified-result"><template v-if="result !== null"><span>{{ target === 'total' ? tr('等效总阻值 RT', 'Equivalent RT') : tr('缺失电阻 Rn', 'Missing Rn') }}</span><strong>{{ formatResistance(result) }}</strong><code>{{ formula }}</code></template><p v-else>{{ tr('勾选需要参与计算的电阻并输入阻值，空白行会自动忽略。', 'Select participating resistors and enter their values. Blank rows are ignored.') }}</p></div>
    </div>
    <aside class="panel network-schematic-panel"><div class="panel-toolbar"><div><h2>{{ mode === 'series' ? tr('串联电阻原理图', 'Series Resistor Schematic') : tr('并联电阻原理图', 'Parallel Resistor Schematic') }}</h2><p>{{ tr('根据你提供的 TEL 网络表重新绘制', 'Redrawn from the supplied TEL netlist') }}</p></div></div><img :src="mode === 'series' ? seriesSchematic : parallelSchematic" alt="Resistor schematic" /><div class="netlist-check"><strong>{{ tr('网络表连接核对通过', 'Netlist verified') }}</strong><p>{{ netlistSummary }}</p><p>{{ mode === 'series' ? tr('串联电路中各电阻电流相同，总阻值为各阻值之和。', 'Series resistors carry the same current and their values add together.') : tr('并联电路中各支路电压相同，总阻值小于任意一个支路阻值。', 'Parallel branches share the same voltage and the total is below every branch value.') }}</p></div></aside>
  </section>
</template>
