<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { calculateOhmsLaw, type OhmsQuantity, type OhmsValues } from '@/calculators/ohmsLaw'
import { useI18n } from '@/i18n'

interface UnitOption { label: string; factor: number }
interface FieldDefinition { key: OhmsQuantity; name: string; symbol: string; baseUnit: string; units: UnitOption[] }
const { tr } = useI18n()
const englishNames: Record<OhmsQuantity, string> = { voltage: 'Voltage', current: 'Current', resistance: 'Resistance', power: 'Power' }
const fieldName = (field: FieldDefinition): string => tr(field.name, englishNames[field.key])

const fields: FieldDefinition[] = [
  { key: 'voltage', name: '电压', symbol: 'V', baseUnit: 'V', units: [{ label: 'V', factor: 1 }, { label: 'mV', factor: 1e-3 }, { label: 'μV', factor: 1e-6 }, { label: 'kV', factor: 1e3 }] },
  { key: 'current', name: '电流', symbol: 'I', baseUnit: 'A', units: [{ label: 'A', factor: 1 }, { label: 'mA', factor: 1e-3 }, { label: 'μA', factor: 1e-6 }] },
  { key: 'resistance', name: '电阻', symbol: 'R', baseUnit: 'Ω', units: [{ label: 'Ω', factor: 1 }, { label: 'kΩ', factor: 1e3 }, { label: 'MΩ', factor: 1e6 }, { label: 'mΩ', factor: 1e-3 }] },
  { key: 'power', name: '功率', symbol: 'P', baseUnit: 'W', units: [{ label: 'W', factor: 1 }, { label: 'mW', factor: 1e-3 }, { label: 'μW', factor: 1e-6 }, { label: 'kW', factor: 1e3 }] }
]

const inputText = reactive<Record<OhmsQuantity, string>>({ voltage: '', current: '', resistance: '', power: '' })
const unitFactor = reactive<Record<OhmsQuantity, number>>({ voltage: 1, current: 1, resistance: 1, power: 1 })
const result = ref<OhmsValues | null>(null)
const formula = ref('')
const errorMessage = ref('')
const knownCount = computed(() => fields.filter((field) => inputText[field.key].trim() !== '').length)

function updateInput(key: OhmsQuantity, event: Event): void {
  inputText[key] = (event.target as HTMLInputElement).value
  result.value = null
}

function updateUnit(key: OhmsQuantity, event: Event): void {
  unitFactor[key] = Number((event.target as HTMLSelectElement).value)
  result.value = null
}

function calculate(): void {
  errorMessage.value = ''
  const inputs: Partial<OhmsValues> = {}
  for (const field of fields) {
    const raw = inputText[field.key].trim()
    if (!raw) continue
    const value = Number(raw)
    if (!Number.isFinite(value)) { errorMessage.value = `${fieldName(field)} ${tr('不是有效数字。', 'is not a valid number.')}`; result.value = null; return }
    inputs[field.key] = value * unitFactor[field.key]
  }
  try {
    const calculation = calculateOhmsLaw(inputs)
    result.value = calculation.values
    formula.value = calculation.formula
  } catch (error) {
    result.value = null
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

function reset(): void {
  for (const field of fields) { inputText[field.key] = ''; unitFactor[field.key] = 1 }
  result.value = null; formula.value = ''; errorMessage.value = ''
}

function formatEngineering(value: number, quantity: OhmsQuantity): string {
  const field = fields.find((item) => item.key === quantity)!
  const candidates = [...field.units].sort((a, b) => b.factor - a.factor)
  const selected = candidates.find((unit) => Math.abs(value) >= unit.factor) ?? candidates.at(-1)!
  const scaled = value / selected.factor
  return `${Number(scaled.toPrecision(8))} ${selected.label}`
}
</script>

<template>
  <section class="ohms-layout">
    <div class="panel ohms-calculator-panel">
      <div class="panel-toolbar"><div><h2>{{ tr('欧姆定律计算器', "Ohm's Law Calculator") }}</h2><p>{{ tr('在 V、I、R、P 中任意输入两个已知量', 'Enter any two known values from V, I, R and P') }}</p></div><span class="known-count" :class="{ ready: knownCount === 2 }">{{ tr('已输入', 'Entered') }} {{ knownCount }} / 2</span></div>
      <div class="ohms-fields">
        <label v-for="field in fields" :key="field.key" class="ohms-field">
          <span><strong>{{ fieldName(field) }}</strong> ({{ field.symbol }})</span>
          <div class="value-with-unit"><input :value="inputText[field.key]" type="number" min="0" step="any" :placeholder="`${tr('输入', 'Enter ')}${fieldName(field)}`" @input="updateInput(field.key, $event)" /><select :value="unitFactor[field.key]" @change="updateUnit(field.key, $event)"><option v-for="unit in field.units" :key="unit.label" :value="unit.factor">{{ unit.label }}</option></select></div>
        </label>
      </div>
      <div class="ohms-actions"><button :disabled="knownCount !== 2" @click="calculate">{{ tr('计算', 'Calculate') }}</button><button class="soft-button" @click="reset">{{ tr('复位', 'Reset') }}</button></div>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </div>

    <aside class="panel formula-panel">
      <h2>{{ tr('公式关系', 'Formula Relationships') }}</h2>
      <div class="formula-wheel"><div class="formula-center"><strong>P</strong><span>V · I</span><span>R</span></div><p>V = I × R</p><p>I = V ÷ R</p><p>R = V ÷ I</p><p>P = V × I</p></div>
      <div v-if="result" class="ohms-results">
        <h3>{{ tr('计算结果', 'Results') }}</h3>
        <dl><div v-for="field in fields" :key="field.key"><dt>{{ fieldName(field) }} {{ field.symbol }}</dt><dd>{{ formatEngineering(result[field.key], field.key) }}</dd></div></dl>
        <p>{{ tr('使用公式', 'Formula') }}: {{ formula }}</p>
      </div>
      <div v-else class="ohms-help"><strong>{{ tr('使用方法', 'How to Use') }}</strong><p>{{ tr('只填写任意两个输入框，再点击“计算”。未填写的另外两个量会自动计算，并使用适合阅读的工程单位显示。', 'Fill any two fields and click Calculate. The remaining values are calculated automatically and displayed with suitable engineering units.') }}</p></div>
    </aside>
  </section>
</template>
