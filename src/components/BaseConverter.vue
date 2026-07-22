<script setup lang="ts">
import { computed, ref } from 'vue'
import { convertIntegerBase, type NumberBase } from '@/calculators/dataTools'
import { useI18n } from '@/i18n'

const { language } = useI18n()
const sourceBase = ref<NumberBase>(10)
const input = ref('255')
const result = computed(() => {
  try {
    return { value: convertIntegerBase(input.value, sourceBase.value), error: '' }
  } catch (error) {
    return { value: undefined, error: error instanceof Error ? error.message : String(error) }
  }
})
const rows = [
  { key: 'binary', zh: '二进制 BIN', en: 'Binary BIN', prefix: '0b' },
  { key: 'octal', zh: '八进制 OCT', en: 'Octal OCT', prefix: '0o' },
  { key: 'decimal', zh: '十进制 DEC', en: 'Decimal DEC', prefix: '' },
  { key: 'hexadecimal', zh: '十六进制 HEX', en: 'Hexadecimal HEX', prefix: '0x' }
] as const

async function copy(value: string): Promise<void> {
  await navigator.clipboard.writeText(value)
}
</script>

<template>
  <section class="data-tool-layout">
    <div class="panel">
      <div class="panel-toolbar">
        <div>
          <h2>{{ language === 'en-US' ? 'Number Base Converter' : '进制转换' }}</h2>
          <p>{{ language === 'en-US' ? 'Convert large integers between BIN / OCT / DEC / HEX in real time' : '支持超大整数，输入后自动联动转换 BIN / OCT / DEC / HEX' }}</p>
        </div>
        <span class="tool-badge">{{ language === 'en-US' ? 'Integer mode' : '整数模式' }}</span>
      </div>
      <div class="base-source">
        <label class="field"><span>{{ language === 'en-US' ? 'Input base' : '输入进制' }}</span><select v-model.number="sourceBase"><option :value="2">BIN</option><option :value="8">OCT</option><option :value="10">DEC</option><option :value="16">HEX</option></select></label>
        <label class="field"><span>{{ language === 'en-US' ? 'Value' : '输入数值' }}</span><input v-model="input" spellcheck="false" :placeholder="language === 'en-US' ? 'Example: FF, 255 or 11111111' : '例如 FF、255 或 11111111'"></label>
      </div>
      <p v-if="result.error" class="error-message">{{ result.error }}</p>
      <div v-else class="base-results"><div v-for="row in rows" :key="row.key"><span>{{ language === 'en-US' ? row.en : row.zh }}</span><code>{{ row.prefix }}{{ result.value?.[row.key] }}</code><button class="soft-button" @click="copy(result.value?.[row.key] ?? '')">{{ language === 'en-US' ? 'Copy' : '复制' }}</button></div></div>
      <p class="data-tool-tip">{{ language === 'en-US' ? 'Negative values and underscore grouping are supported. A 0x prefix may be used for hexadecimal.' : '可使用负数和下划线分组，例如 1111_0000。十六进制可带 0x 前缀。' }}</p>
    </div>
  </section>
</template>
