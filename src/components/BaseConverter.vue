<script setup lang="ts">
import { computed, ref } from 'vue'
import { convertIntegerBase, type NumberBase } from '@/calculators/dataTools'
const sourceBase = ref<NumberBase>(10)
const input = ref('255')
const result = computed(() => { try { return { value: convertIntegerBase(input.value, sourceBase.value), error: '' } } catch (error) { return { value: undefined, error: error instanceof Error ? error.message : String(error) } } })
const rows = [{ key: 'binary', label: '二进制 BIN', prefix: '0b' }, { key: 'octal', label: '八进制 OCT', prefix: '0o' }, { key: 'decimal', label: '十进制 DEC', prefix: '' }, { key: 'hexadecimal', label: '十六进制 HEX', prefix: '0x' }] as const
async function copy(value: string): Promise<void> { await navigator.clipboard.writeText(value) }
</script>
<template><section class="data-tool-layout"><div class="panel"><div class="panel-toolbar"><div><h2>进制转换</h2><p>支持超大整数，输入后自动联动转换 BIN / OCT / DEC / HEX</p></div><span class="tool-badge">整数模式</span></div><div class="base-source"><label class="field"><span>输入进制</span><select v-model.number="sourceBase"><option :value="2">二进制 BIN</option><option :value="8">八进制 OCT</option><option :value="10">十进制 DEC</option><option :value="16">十六进制 HEX</option></select></label><label class="field"><span>输入数值</span><input v-model="input" spellcheck="false" placeholder="例如 FF、255 或 11111111"></label></div><p v-if="result.error" class="error-message">{{ result.error }}</p><div v-else class="base-results"><div v-for="row in rows" :key="row.key"><span>{{ row.label }}</span><code>{{ row.prefix }}{{ result.value?.[row.key] }}</code><button class="soft-button" @click="copy(result.value?.[row.key] ?? '')">复制</button></div></div><p class="data-tool-tip">可使用负数和下划线分组，例如 <code>1111_0000</code>。十六进制可带 0x 前缀。</p></div></section></template>
