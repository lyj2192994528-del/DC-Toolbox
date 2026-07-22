<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
const text=ref('100,AA 55 01\n500,AA 55 02\n1000,AA 55 03');const playing=ref(false);const current=ref(-1);let timer:ReturnType<typeof setTimeout>|undefined
const frames=computed(()=>text.value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map((line,index)=>{const split=line.indexOf(',');return{index,delay:Number(line.slice(0,split)),data:line.slice(split+1).trim()}}).filter(frame=>Number.isFinite(frame.delay)&&frame.delay>=0&&frame.data))
function stop():void{if(timer)clearTimeout(timer);timer=undefined;playing.value=false;current.value=-1}
function play(index=0):void{if(index>=frames.value.length){stop();return}playing.value=true;current.value=index;const nextDelay=index+1<frames.value.length?Math.max(0,frames.value[index+1].delay-frames.value[index].delay):500;timer=setTimeout(()=>play(index+1),nextDelay)}
onBeforeUnmount(stop)
</script>
<template><section class="data-tool-layout"><div class="panel"><div class="panel-toolbar"><div><h2>数据记录与回放</h2><p>按时间轴预览数据帧；格式为“相对毫秒,数据内容”</p></div><span class="tool-badge">{{ frames.length }} 帧</span></div><textarea v-model="text" rows="8" spellcheck="false"></textarea><div class="replay-actions"><button v-if="!playing" @click="play()">开始回放</button><button v-else class="danger" @click="stop">停止回放</button></div><div class="replay-list"><div v-for="(frame,index) in frames" :key="frame.index" :class="{active:current===index}"><time>{{ frame.delay }} ms</time><code>{{ frame.data }}</code></div></div><p class="data-tool-tip">当前回放为安全预览模式，不会自动写入串口。之后可加入选择目标串口、循环次数和文件导入。</p></div></section></template>
