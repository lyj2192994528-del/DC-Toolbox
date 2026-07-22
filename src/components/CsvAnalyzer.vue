<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/i18n'

const { language } = useI18n()
const text = ref('time,voltage,current\n0,3.30,0.10\n1,3.28,0.12\n2,3.31,0.11')
const parsed = computed(() => {
  const lines = text.value.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split(',').map((cell) => cell.trim()))
  if (!lines.length) return { headers: [], rows: [], stats: [] }
  const headers = lines[0]
  const rows = lines.slice(1)
  const stats = headers.map((header, index) => {
    const values = rows.map((row) => Number(row[index])).filter(Number.isFinite)
    return { header, count: values.length, min: values.length ? Math.min(...values) : undefined, max: values.length ? Math.max(...values) : undefined, average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined }
  })
  return { headers, rows, stats }
})
function fmt(value: number | undefined): string { return value === undefined ? '—' : Number(value.toPrecision(8)).toString() }
</script>

<template>
  <section class="csv-layout">
    <div class="panel"><div class="panel-toolbar"><div><h2>{{ language === 'en-US' ? 'CSV Analyzer' : 'CSV 分析' }}</h2><p>{{ language === 'en-US' ? 'Paste CSV data to calculate minimum, maximum and average for numeric columns' : '粘贴 CSV 数据，自动统计每个数值列的最小值、最大值和平均值' }}</p></div><span class="tool-badge">{{ parsed.rows.length }} {{ language === 'en-US' ? 'rows' : '行' }}</span></div><textarea v-model="text" class="csv-input" spellcheck="false" aria-label="CSV"></textarea></div>
    <div class="panel"><h2>{{ language === 'en-US' ? 'Column Statistics' : '列统计' }}</h2><div class="csv-table-wrap"><table><thead><tr><th>{{ language === 'en-US' ? 'Column' : '列名' }}</th><th>{{ language === 'en-US' ? 'Count' : '有效数' }}</th><th>{{ language === 'en-US' ? 'Minimum' : '最小值' }}</th><th>{{ language === 'en-US' ? 'Maximum' : '最大值' }}</th><th>{{ language === 'en-US' ? 'Average' : '平均值' }}</th></tr></thead><tbody><tr v-for="stat in parsed.stats" :key="stat.header"><td>{{ stat.header }}</td><td>{{ stat.count }}</td><td>{{ fmt(stat.min) }}</td><td>{{ fmt(stat.max) }}</td><td>{{ fmt(stat.average) }}</td></tr></tbody></table></div><p class="data-tool-tip">{{ language === 'en-US' ? 'Designed for regular comma-separated serial exports. File import and plots can be added later.' : '当前版本适合串口导出的规则逗号分隔数据；后续可继续加入文件导入、曲线绘制和异常点筛选。' }}</p></div>
  </section>
</template>
