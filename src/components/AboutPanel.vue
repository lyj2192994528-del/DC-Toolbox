<script setup lang="ts">
import { PROJECT_INFO } from '../../shared/project-info'
</script>

<template>
  <section class="about-layout">
    <div class="panel about-hero">
      <span class="about-badge">ABOUT</span>
      <h2>{{ PROJECT_INFO.fullName }}</h2>
      <p>面向 MCU 开发工程师、硬件工程师、电子爱好者与开源开发者的 Windows 桌面工具箱。</p>
      <div class="about-contact-grid">
        <div><span>作者邮箱</span><strong>{{ PROJECT_INFO.email }}</strong><small>问题反馈、功能建议与合作联系</small></div>
        <div><span>QQ 交流群</span><strong>{{ PROJECT_INFO.qqGroup }}</strong><small>{{ PROJECT_INFO.qqGroupName }}</small></div>
        <div><span>GitHub 仓库</span><strong>{{ PROJECT_INFO.githubUrl || '待添加' }}</strong><small>创建仓库后填写统一配置</small></div>
      </div>
      <div class="group-description"><strong>群介绍</strong><p>{{ PROJECT_INFO.qqGroupDescription }}</p></div>
    </div>
    <aside class="panel about-roadmap"><h2>项目方向</h2><ul><li>串口、波形与数据记录</li><li>电子开发计算工具</li><li>BLE、USB、HID 与 OTA</li><li>TCP、UDP 与 MQTT 网络工具</li></ul><p>DC Toolbox 会保持模块化结构，后续工具按类别持续加入。</p></aside>
  </section>
</template>
