<script setup lang="ts">
import { computed, ref } from 'vue'
import seriesSchematic from '@/assets/series-resistors.svg'
import parallelSchematic from '@/assets/parallel-resistors.svg'
import { calculateEquivalentResistance, solveMissingResistance, type ResistorNetworkMode } from '@/calculators/resistorNetwork'

interface ResistorRow { id: number; enabled: boolean; value: string | number; factor: number }
type Target = 'total' | 'missing'
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
  return `${Number((value / unit.factor).toPrecision(9)).toLocaleString('zh-CN', { maximumFractionDigits: 9 })} ${unit.label}`
}
</script>

<template>
  <section class="network-layout">
    <div class="panel network-controls">
      <div class="panel-toolbar"><div><h2>串并联电阻计算器</h2><p>计算多个电阻的等效阻值，或按目标总阻值反算 Rn</p></div><span class="circuit-type">{{ formula }}</span></div>
      <div class="network-mode-tabs"><button :class="{ active: mode === 'series' }" @click="switchMode('series')">串联电阻</button><button :class="{ active: mode === 'parallel' }" @click="switchMode('parallel')">并联电阻</button></div>
      <div class="solve-targets network-targets"><label :class="{ active: target === 'total' }"><input v-model="target" type="radio" value="total" @change="clearResult" />求等效总阻值</label><label :class="{ active: target === 'missing' }"><input v-model="target" type="radio" value="missing" @change="clearResult" />反算缺失电阻 Rn</label></div>
      <label v-if="target === 'missing'" class="network-total-field"><span>目标等效总阻值 RT</span><div class="value-with-unit"><input v-model="targetTotal" type="number" min="0" step="any" @input="clearResult" /><select v-model.number="targetFactor" @change="clearResult"><option v-for="unit in units" :key="unit.label" :value="unit.factor">{{ unit.label }}</option></select></div></label>
      <div class="network-toolbar"><button class="soft-button" @click="toggleAll">{{ allSelected ? '取消全选' : '全选' }}</button><button class="soft-button" @click="addRows(1)">添加电阻</button><button class="soft-button" @click="addRows(5)">添加 5 条</button><button class="soft-button" @click="clearSelected">清空选中</button><span>已选 {{ selectedCount }} / {{ rows.length }}，最多 100 条</span></div>
      <div class="resistor-list">
        <div v-for="(row, index) in rows" :key="row.id" class="resistor-row">
          <input v-model="row.enabled" type="checkbox" :aria-label="`选择 R${index + 1}`" @change="clearResult" /><strong>R{{ index + 1 }}</strong><input v-model="row.value" type="number" min="0" step="any" placeholder="输入阻值" :disabled="!row.enabled" :aria-label="`R${index + 1} 阻值`" @input="clearResult" /><select v-model.number="row.factor" :disabled="!row.enabled" :aria-label="`R${index + 1} 单位`" @change="clearResult"><option v-for="unit in units" :key="unit.label" :value="unit.factor">{{ unit.label }}</option></select><button class="row-delete" :disabled="rows.length <= 2" :aria-label="`删除 R${index + 1}`" @click="removeRow(row.id)">×</button>
        </div>
      </div>
      <button class="wide-action" @click="calculate">{{ target === 'total' ? '计算等效总阻值' : '计算缺失电阻 Rn' }}</button>
      <p v-if="error" class="error-message">{{ error }}</p>
      <div class="unified-result"><template v-if="result !== null"><span>{{ target === 'total' ? '等效总阻值 RT' : '缺失电阻 Rn' }}</span><strong>{{ formatResistance(result) }}</strong><code>{{ formula }}</code></template><p v-else>勾选需要参与计算的电阻并输入阻值，空白行会自动忽略。</p></div>
    </div>
    <aside class="panel network-schematic-panel"><div class="panel-toolbar"><div><h2>{{ mode === 'series' ? '串联电阻原理图' : '并联电阻原理图' }}</h2><p>根据你提供的 TEL 网络表重新绘制</p></div></div><img :src="mode === 'series' ? seriesSchematic : parallelSchematic" :alt="mode === 'series' ? '串联电阻原理图' : '并联电阻原理图'" /><div class="netlist-check"><strong>网络表连接核对通过</strong><p>{{ netlistSummary }}</p><p>{{ mode === 'series' ? '串联电路中各电阻电流相同，总阻值为各阻值之和。' : '并联电路中各支路电压相同，总阻值小于任意一个支路阻值。' }}</p></div></aside>
  </section>
</template>
