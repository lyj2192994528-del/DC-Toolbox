<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import schematicUrl from '@/assets/non-inverting-opamp.png'
import { calculateNonInverting, feedbackResistanceForGain, groundResistanceForGain } from '@/calculators/opAmp'
import { useI18n } from '@/i18n'

type SolveTarget = 'vin' | 'vout' | 'r1' | 'r2' | 'gain'
type InputKey = 'vin' | 'vout' | 'r1' | 'r2' | 'gain'
interface Unit { label: string; factor: number }
interface InputDefinition { key: InputKey; label: string; units?: Unit[] }
const { tr } = useI18n()
const definitionEn: Record<InputKey, string> = { vin: 'Input Voltage VIN', vout: 'Output Voltage VOUT', r1: 'R1 to GND', r2: 'Feedback R2', gain: 'Gain Av' }
const modeEn: Record<SolveTarget, string> = { vin: 'Solve Input Voltage', vout: 'Solve Output Voltage', r1: 'Solve R1', r2: 'Solve R2', gain: 'Solve Gain' }
const definitionLabel = (key: InputKey): string => tr(definitions[key].label, definitionEn[key])
const modeLabel = (key: SolveTarget): string => tr(modes.find((mode) => mode.key === key)!.label, modeEn[key])

const resistanceUnits: Unit[] = [{ label: 'kΩ', factor: 1e3 }, { label: 'Ω', factor: 1 }, { label: 'MΩ', factor: 1e6 }]
const voltageUnits: Unit[] = [{ label: 'V', factor: 1 }, { label: 'mV', factor: 1e-3 }, { label: 'μV', factor: 1e-6 }]
const definitions: Record<InputKey, InputDefinition> = {
  vin: { key: 'vin', label: '输入电压 VIN', units: voltageUnits },
  vout: { key: 'vout', label: '输出电压 VOUT', units: voltageUnits },
  r1: { key: 'r1', label: '电阻一 R1（到 GND）', units: resistanceUnits },
  r2: { key: 'r2', label: '电阻二 R2（反馈）', units: resistanceUnits },
  gain: { key: 'gain', label: '放大倍数 Av' }
}
const modes: Array<{ key: SolveTarget; label: string; inputs: InputKey[] }> = [
  { key: 'vin', label: '求输入电压', inputs: ['r1', 'r2', 'vout'] },
  { key: 'vout', label: '求输出电压', inputs: ['r1', 'r2', 'vin'] },
  { key: 'r1', label: '求 R1 阻值', inputs: ['r2', 'vin', 'vout'] },
  { key: 'r2', label: '求 R2 阻值', inputs: ['r1', 'vin', 'vout'] },
  { key: 'gain', label: '求放大倍数', inputs: ['r1', 'r2'] }
]

const target = ref<SolveTarget>('gain')
const values = reactive<Record<InputKey, string>>({ vin: '0.5', vout: '1', r1: '10', r2: '10', gain: '2' })
const factors = reactive<Record<InputKey, number>>({ vin: 1, vout: 1, r1: 1e3, r2: 1e3, gain: 1 })
const outputMinText = ref('0')
const outputMaxText = ref('3.3')
const resultText = ref('')
const secondaryText = ref('')
const formulaText = ref('')
const warningText = ref('')
const errorMessage = ref('')
const selectedMode = computed(() => modes.find((mode) => mode.key === target.value)!)
const activeInputs = computed(() => selectedMode.value.inputs.map((key) => definitions[key]))
const netlistSummary = 'VIN+ → U1.3；VOUT → U1.1/R2.2；反馈节点 → U1.4/R1.2/R2.1；R1.1、U1.2 → GND；U1.5 → 3.3V'

watch(target, () => { resultText.value = ''; secondaryText.value = ''; formulaText.value = ''; warningText.value = ''; errorMessage.value = '' })

function updateValue(key: InputKey, event: Event): void { values[key] = (event.target as HTMLInputElement).value; resultText.value = '' }
function updateFactor(key: InputKey, event: Event): void { factors[key] = Number((event.target as HTMLSelectElement).value); resultText.value = '' }

function baseValue(key: InputKey): number {
  const value = Number(values[key]) * factors[key]
  if (!Number.isFinite(value)) throw new Error(`${definitionLabel(key)} ${tr('不是有效数字。', 'is not a valid number.')}`)
  return value
}
function ensurePositive(value: number, label: string): number { if (value <= 0) throw new Error(`${label} ${tr('必须大于 0。', 'must be greater than 0.')}`); return value }
function formatResistance(value: number): string {
  if (value >= 1e6) return `${Number((value / 1e6).toPrecision(8))} MΩ`
  if (value >= 1e3) return `${Number((value / 1e3).toPrecision(8))} kΩ`
  return `${Number(value.toPrecision(8))} Ω`
}
function formatVoltage(value: number): string { return `${Number(value.toPrecision(9))} V` }

function calculate(): void {
  errorMessage.value = ''; resultText.value = ''; secondaryText.value = ''; formulaText.value = ''; warningText.value = ''
  try {
    if (target.value === 'gain') {
      const r1 = ensurePositive(baseValue('r1'), 'R1'); const r2 = ensurePositive(baseValue('r2'), 'R2')
      const gain = 1 + r2 / r1
      resultText.value = `${Number(gain.toPrecision(9))} ×`; formulaText.value = 'Av = 1 + R2 ÷ R1'
    } else if (target.value === 'vout') {
      const calculation = calculateNonInverting(baseValue('r1'), baseValue('r2'), baseValue('vin'), Number(outputMinText.value), Number(outputMaxText.value))
      resultText.value = formatVoltage(calculation.actualOutput)
      secondaryText.value = `${tr('闭环增益', 'Closed-loop gain')} ${Number(calculation.gain.toPrecision(8))} ×; ${tr('理想输出', 'ideal output')} ${formatVoltage(calculation.idealOutput)}`
      formulaText.value = 'VOUT = VIN × (1 + R2 ÷ R1)'
      if (calculation.clipped) warningText.value = tr('理想输出超过设定范围，结果已按供电/输出范围限制，实际电路可能饱和或削顶。', 'The ideal output exceeds the configured range. The result is clamped and the circuit may saturate or clip.')
    } else if (target.value === 'vin') {
      const r1 = ensurePositive(baseValue('r1'), 'R1'); const r2 = ensurePositive(baseValue('r2'), 'R2'); const vout = baseValue('vout')
      const gain = 1 + r2 / r1; resultText.value = formatVoltage(vout / gain); secondaryText.value = `${tr('闭环增益', 'Closed-loop gain')} ${Number(gain.toPrecision(8))} ×`; formulaText.value = 'VIN = VOUT ÷ (1 + R2 ÷ R1)'
    } else {
      const vin = ensurePositive(baseValue('vin'), 'VIN'); const vout = ensurePositive(baseValue('vout'), 'VOUT'); const gain = vout / vin
      if (gain <= 1) throw new Error(tr('同相放大电路要求 VOUT ÷ VIN 大于 1。', 'A non-inverting amplifier requires VOUT ÷ VIN greater than 1.'))
      if (target.value === 'r1') {
        const value = groundResistanceForGain(baseValue('r2'), gain); resultText.value = formatResistance(value); formulaText.value = 'R1 = R2 ÷ (VOUT ÷ VIN - 1)'
      } else {
        const value = feedbackResistanceForGain(baseValue('r1'), gain); resultText.value = formatResistance(value); formulaText.value = 'R2 = R1 × (VOUT ÷ VIN - 1)'
      }
      secondaryText.value = `${tr('目标闭环增益', 'Target closed-loop gain')} ${Number(gain.toPrecision(8))} ×; ${tr('实际选型可取最接近的标准阻值', 'choose the nearest standard resistor value')}`
    }
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : String(error) }
}
</script>

<template>
  <section class="opamp-layout">
    <div class="panel opamp-controls">
      <div class="panel-toolbar"><div><h2>{{ tr('同相运放放大倍数计算器', 'Non-Inverting Op-Amp Calculator') }}</h2><p>{{ tr('先选择要求的量，再填写自动列出的已知参数', 'Choose a target, then enter the listed known parameters') }}</p></div><span class="circuit-type">Av = 1 + R2 / R1</span></div>

      <div class="solve-targets" role="radiogroup"><label v-for="mode in modes" :key="mode.key" :class="{ active: target === mode.key }"><input v-model="target" type="radio" :value="mode.key" />{{ modeLabel(mode.key) }}</label></div>

      <div class="dynamic-opamp-inputs">
        <label v-for="input in activeInputs" :key="input.key"><span>{{ definitionLabel(input.key) }}</span><div v-if="input.units" class="value-with-unit"><input :value="values[input.key]" type="number" step="any" @input="updateValue(input.key, $event)" /><select :value="factors[input.key]" @change="updateFactor(input.key, $event)"><option v-for="unit in input.units" :key="unit.label" :value="unit.factor">{{ unit.label }}</option></select></div><input v-else :value="values[input.key]" type="number" step="any" @input="updateValue(input.key, $event)" /></label>
      </div>
      <label v-if="target === 'vout'" class="output-limit-field">{{ tr('允许输出范围（用于饱和判断）', 'Allowed Output Range (for saturation check)') }}<div class="output-range"><input v-model="outputMinText" type="number" step="any" /><span>～</span><input v-model="outputMaxText" type="number" step="any" /><span>V</span></div></label>
      <button class="wide-action" @click="calculate">{{ tr('计算结果', 'Calculate') }}</button>

      <div class="unified-result" :class="{ warning: warningText }"><template v-if="resultText"><span>{{ modeLabel(selectedMode.key) }}</span><strong>{{ resultText }}</strong><p v-if="secondaryText">{{ secondaryText }}</p><code>{{ formulaText }}</code><p v-if="warningText" class="result-warning">{{ warningText }}</p></template><p v-else>{{ tr('当前选择', 'Selected') }} “{{ modeLabel(selectedMode.key) }}”，{{ tr('请填写上面的已知参数。', 'enter the known parameters above.') }}</p></div>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </div>

    <aside class="panel schematic-panel">
      <div class="panel-toolbar"><div><h2>{{ tr('典型电路原理图', 'Typical Circuit Schematic') }}</h2><p>{{ tr('来自你提供的 TEL 网络表与原理图', 'Based on the supplied TEL netlist and schematic') }}</p></div></div>
      <img :src="schematicUrl" alt="TLV333 同相负反馈放大电路原理图" />
      <div class="netlist-check"><strong>{{ tr('网络表连接核对通过', 'Netlist verified') }}</strong><p>{{ netlistSummary }}</p><p>{{ tr('R1 是反相端到地电阻，R2 是输出反馈电阻，因此这是同相放大电路。', 'R1 connects the inverting input to ground and R2 provides output feedback, making this a non-inverting amplifier.') }}</p></div>
    </aside>
  </section>
</template>
