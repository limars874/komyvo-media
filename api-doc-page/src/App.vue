<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { apiBaseUrl, defaultModelId, getModel, modelGroups, models } from './data';

const search = ref('');
const selectedId = ref(defaultModelId);
const activeTab = ref('overview');
const codeLanguage = ref('curl');
const copied = ref('');
const isDark = ref(true);

const selectedModel = computed(() => getModel(selectedId.value));
const selectedGroup = computed(() => (selectedModel.value.kind === 'video' ? 'video' : 'image'));

const filteredGroups = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return modelGroups
    .map((group) => ({
      ...group,
      ids: group.ids.filter((id) => {
        if (!keyword) return true;
        const model = getModel(id);
        return [model.id, model.title, model.description].some((value) => value.toLowerCase().includes(keyword));
      }),
    }))
    .filter((group) => group.ids.length > 0);
});

const exampleMode = ref('text_to_video');
const videoExampleModes = [
  { key: 'text_to_video', label: '文生视频', description: '只传提示词，生成一个视频。' },
  { key: 'image_to_video', label: '图生视频', capability: '图生视频', description: '使用一张图片作为首帧。' },
  { key: 'first_last_frame', label: '首尾帧', capability: '首尾帧', description: '使用 first_frame 和 last_frame 两张图片。' },
  { key: 'reference_to_video', label: '视频生视频', capability: '参考视频', description: '使用一个参考视频控制动作和节奏。' },
  { key: 'reference_audio', label: '音频参考', capability: '音频参考', description: '使用一个参考音频控制节奏。' },
];
const imageExampleModes = [
  { key: 'text_to_image', label: '文生图片', description: '只传提示词，生成一张图片。' },
  { key: 'image_to_image', label: '图生图片', description: '使用一张图片作为参考。' },
];
const exampleModes = computed(() => selectedModel.value.kind === 'video'
  ? videoExampleModes.filter((item) => !item.capability || selectedModel.value.capabilities.includes(item.capability))
  : imageExampleModes);
const currentExampleMode = computed(() => exampleModes.value.some((item) => item.key === exampleMode.value) ? exampleMode.value : exampleModes.value[0]?.key);
const activeExample = computed(() => exampleModes.value.find((item) => item.key === currentExampleMode.value) || exampleModes.value[0]);
const code = computed(() => buildCode(selectedModel.value, codeLanguage.value, currentExampleMode.value));

function readHash() {
  const match = window.location.hash.match(/^#model\/(.+)$/);
  const model = match ? models.find((item) => item.id === decodeURIComponent(match[1])) : null;
  if (model) selectedId.value = model.id;
}

function selectModel(id) {
  selectedId.value = id;
  activeTab.value = 'overview';
  exampleMode.value = 'text_to_video';
  window.location.hash = `model/${encodeURIComponent(id)}`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleTheme() {
  isDark.value = !isDark.value;
  document.documentElement.dataset.theme = isDark.value ? 'dark' : 'light';
}

async function copyText(text, key) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = key;
    window.setTimeout(() => {
      if (copied.value === key) copied.value = '';
    }, 1400);
  } catch {
    copied.value = '';
  }
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildCode(model, language, mode) {
  const isVideo = model.kind === 'video';
  const endpoint = isVideo ? '/v1/videos' : '/komyvo/v1/images';
  const videoBodies = {
    text_to_video: {
      model: model.id,
      prompt: '一只橘猫在阳光下的草地上散步，电影感镜头',
      seconds: 5,
      resolution: '720P',
    },
    image_to_video: {
      model: model.id,
      content: [
        { type: 'image_url', role: 'first_frame', image_url: { url: 'https://example.com/first-frame.png' } },
        { type: 'text', text: '让画面中的猫自然地向镜头走来' },
      ],
      seconds: 5,
      resolution: '720P',
    },
    first_last_frame: {
      model: model.id,
      content: [
        { type: 'image_url', role: 'first_frame', image_url: { url: 'https://example.com/first-frame.png' } },
        { type: 'image_url', role: 'last_frame', image_url: { url: 'https://example.com/last-frame.png' } },
        { type: 'text', text: '让首帧自然过渡到尾帧' },
      ],
      seconds: 5,
      resolution: '720P',
    },
    reference_to_video: {
      model: model.id,
      content: [
        { type: 'video_url', role: 'reference_video', video_url: { url: 'https://example.com/reference.mp4' } },
        { type: 'text', text: '保持参考视频的动作节奏，改为电影感画面' },
      ],
      seconds: 5,
      resolution: '720P',
    },
    reference_audio: {
      model: model.id,
      content: [
        { type: 'audio_url', role: 'reference_audio', audio_url: { url: 'https://example.com/reference.mp3' } },
        { type: 'text', text: '根据音频节奏生成镜头变化' },
      ],
      seconds: 5,
      resolution: '720P',
    },
  };
  const imageBodies = {
    text_to_image: {
      model: model.id,
      prompt: '一只橘猫坐在窗边，柔和的电影光线',
      resolution: '1K',
    },
    image_to_image: {
      model: model.id,
      content: [
        { type: 'image_url', role: 'reference_image', image_url: { url: 'https://example.com/reference.png' } },
        { type: 'text', text: '转换为电影感的黄昏色调，保持原有构图' },
      ],
      resolution: '1K',
    },
  };
  const body = isVideo ? videoBodies[mode] || videoBodies.text_to_video : imageBodies[mode] || imageBodies.text_to_image;

  if (language === 'curl') {
    return `curl --request POST '${apiBaseUrl}${endpoint}' \\\n  --header 'Authorization: Bearer $NEW_API_KEY' \\\n  --header 'Content-Type: application/json' \\\n  --data '${JSON.stringify(body, null, 2)}'`;
  }

  if (language === 'python') {
    const method = isVideo ? 'videos' : 'post';
    if (isVideo) {
      return `import requests\n\nresponse = requests.post(\n    '${apiBaseUrl}${endpoint}',\n    headers={'Authorization': 'Bearer ' + NEW_API_KEY},\n    json=${JSON.stringify(body, null, 4).replace(/"([^("]+)":/g, '$1:')},\n)\n\nprint(response.json())`;
    }
    return `import requests\n\nresponse = requests.post(\n    '${apiBaseUrl}${endpoint}',\n    headers={'Authorization': 'Bearer ' + NEW_API_KEY},\n    json=${JSON.stringify(body, null, 4)},\n)\n\nprint(response.json())`;
  }

  return `const response = await fetch('${apiBaseUrl}${endpoint}', {\n  method: 'POST',\n  headers: {\n    Authorization: \`Bearer \${NEW_API_KEY}\`,\n    'Content-Type': 'application/json',\n  },\n  body: JSON.stringify(${JSON.stringify(body, null, 2)}),\n});\n\nconsole.log(await response.json());`;
}

function labelForLanguage(language) {
  return { curl: 'cURL', python: 'Python', javascript: 'JavaScript' }[language];
}

function parameterDefault(model, parameter) {
  return model.defaults?.[parameter.name] || parameter.defaultValue;
}

onMounted(() => {
  readHash();
  window.addEventListener('hashchange', readHash);
});

onBeforeUnmount(() => window.removeEventListener('hashchange', readHash));
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand-wrap">
        <div class="brand-mark">K</div>
        <div>
          <div class="brand-name">Komyvo <span>Media</span></div>
          <div class="brand-subtitle">API Documentation</div>
        </div>
      </div>
      <div class="topbar-actions">
        <span class="version-pill">v0.1 preview</span>
        <button class="icon-button" title="切换主题" @click="toggleTheme">{{ isDark ? '☼' : '☾' }}</button>
      </div>
    </header>

    <div class="layout">
      <aside class="sidebar">
        <div class="search-box">
          <span>⌕</span>
          <input v-model="search" placeholder="搜索模型或接口" />
          <kbd>/</kbd>
        </div>

        <div class="sidebar-caption">MODELS</div>
        <nav class="model-nav">
          <div v-for="group in filteredGroups" :key="group.key" class="nav-group">
            <div class="group-title"><span class="group-icon">{{ group.icon }}</span>{{ group.label }}<span class="group-count">{{ group.ids.length }}</span></div>
            <button
              v-for="id in group.ids"
              :key="id"
              class="model-link"
              :class="{ active: selectedId === id }"
              @click="selectModel(id)"
            >
              <span class="model-status"></span>
              <span class="model-link-text">{{ getModel(id).title }}</span>
            </button>
          </div>
          <div v-if="filteredGroups.length === 0" class="empty-nav">没有匹配的模型</div>
        </nav>

      </aside>

      <main class="main-content">
        <div class="content-header">
          <div class="breadcrumbs"><span>Docs</span><b>/</b><span>{{ selectedGroup === 'video' ? 'Video Models' : 'Image Models' }}</span><b>/</b><strong>{{ selectedModel.title }}</strong></div>
          <div class="content-tabs">
            <button :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">Overview</button>
            <button :class="{ active: activeTab === 'api' }" @click="activeTab = 'api'">API Reference</button>
          </div>
        </div>

        <section class="hero-section">
          <div class="hero-badges"><span class="kind-badge">{{ selectedModel.category }}</span><span class="live-badge"><i></i> Available</span></div>
          <h1>{{ selectedModel.title }}</h1>
          <p class="hero-description">{{ selectedModel.description }}</p>
          <div class="model-id-row"><code>{{ selectedModel.id }}</code><button class="copy-inline" @click="copyText(selectedModel.id, 'model')">{{ copied === 'model' ? '已复制' : '复制 ID' }}</button></div>
          <div class="capability-list"><span v-for="capability in selectedModel.capabilities" :key="capability">{{ capability }}</span></div>
        </section>

        <template v-if="activeTab === 'overview'">
          <section id="quickstart" class="doc-section quickstart-section">
            <div class="section-heading"><div><span class="eyebrow">START HERE</span><h2>快速开始</h2></div><span class="section-note">异步任务接口</span></div>
            <p class="section-lead">使用下方示例提交一个任务。请求返回任务 ID 后，再通过状态接口轮询结果。</p>
            <div class="code-card">
              <div class="example-switcher"><div class="example-tabs"><button v-for="example in exampleModes" :key="example.key" :class="{ active: currentExampleMode === example.key }" @click="exampleMode = example.key">{{ example.label }}</button></div><span>{{ activeExample.description }}</span></div>
              <div class="code-toolbar"><div class="code-tabs"><button v-for="language in ['curl', 'python', 'javascript']" :key="language" :class="{ active: codeLanguage === language }" @click="codeLanguage = language">{{ labelForLanguage(language) }}</button></div><button class="copy-code" @click="copyText(code, 'code')">{{ copied === 'code' ? '✓ 已复制' : '复制代码' }}</button></div>
              <pre><code>{{ code }}</code></pre>
            </div>
          </section>

          <section id="endpoints" class="doc-section">
            <div class="section-heading"><div><span class="eyebrow">ENDPOINTS</span><h2>接口</h2></div></div>
            <div class="endpoint-list">
              <div v-for="endpoint in selectedModel.endpoints" :key="endpoint.path" class="endpoint-card">
                <span class="method" :class="endpoint.tone">{{ endpoint.method }}</span><code>{{ endpoint.path }}</code><span class="endpoint-label">{{ endpoint.label }}</span>
              </div>
            </div>
          </section>

          <section id="parameters" class="doc-section">
            <div class="section-heading"><div><span class="eyebrow">REQUEST</span><h2>请求参数</h2></div></div>
            <div class="table-card"><table><thead><tr><th>参数</th><th>类型</th><th>必填</th><th>默认值</th><th>说明</th></tr></thead><tbody><tr v-for="parameter in selectedModel.params" :key="parameter.name"><td><code>{{ parameter.name }}</code></td><td><span class="type-label">{{ parameter.type }}</span></td><td><span :class="parameter.required ? 'required' : 'optional'">{{ parameter.required ? '是' : '否' }}</span></td><td><span class="default-value">{{ parameterDefault(selectedModel, parameter) }}</span></td><td>{{ parameter.description }}</td></tr></tbody></table></div>
          </section>

          <section id="content-items" class="doc-section">
            <div class="section-heading"><div><span class="eyebrow">CONTENT ITEMS</span><h2>content[] 对象</h2></div></div>
            <p class="section-lead">媒体与文本统一置于 <code>content[]</code> 中，单个元素仅表达一种内容类型。</p>
            <div class="table-card"><table><thead><tr><th>type</th><th>字段结构</th><th>role</th><th>说明</th></tr></thead><tbody><tr v-for="item in selectedModel.contentItems" :key="item.type"><td><code>{{ item.type }}</code></td><td><code>{{ item.fields }}</code></td><td><span class="default-value">{{ item.role }}</span></td><td>{{ item.description }}</td></tr></tbody></table></div>
          </section>

          <section id="model-limits" class="doc-section">
            <div class="section-heading"><div><span class="eyebrow">MODEL LIMITS</span><h2>模型限制</h2></div><span class="section-note">按当前模型校验</span></div>
            <div class="limits-grid">
              <div class="limit-card"><span>输出分辨率</span><strong>{{ selectedModel.limits.resolutions.join('、') }}</strong><p>也接受 WxH 尺寸，并映射到对应分辨率档位。</p></div>
              <div v-if="selectedModel.kind === 'video'" class="limit-card"><span>输出时长</span><strong>{{ selectedModel.limits.duration }}</strong><p>超出范围会返回错误或导致任务失败。</p></div>
              <div class="limit-card"><span>画面比例</span><strong class="limit-values">{{ selectedModel.limits.aspectRatios.join('、') }}</strong><p>未填写时使用尺寸推导；不在列表中的比例返回 400。</p></div>
              <div class="limit-card"><span>输入媒体</span><strong>图片 ≤ {{ selectedModel.limits.input.images }} 张</strong><p>视频 ≤ {{ selectedModel.limits.input.videos }} 个 · 音频 ≤ {{ selectedModel.limits.input.audios }} 个</p></div>
              <div class="limit-card"><span>媒体组合</span><strong>{{ selectedModel.limits.input.mixedMedia ? '支持混合媒体' : '不支持混合媒体' }}</strong><p>{{ selectedModel.limits.input.totalMedia === null ? '总媒体数量未设置统一上限' : `总媒体 ≤ ${selectedModel.limits.input.totalMedia} 个` }}<span v-if="selectedModel.limits.input.videoTotalSeconds">；单个视频累计 ≤ {{ selectedModel.limits.input.videoTotalSeconds }} 秒</span><span v-if="selectedModel.limits.input.audioTotalSeconds">；音频累计 ≤ {{ selectedModel.limits.input.audioTotalSeconds }} 秒</span></p></div>
            </div>
            <div class="rules-card"><div class="rules-title">校验规则</div><ul><li v-for="rule in selectedModel.rules" :key="rule">{{ rule }}</li></ul></div>
          </section>

          <section v-if="selectedModel.roles" id="media-roles" class="doc-section">
            <div class="section-heading"><div><span class="eyebrow">MEDIA INPUT</span><h2>媒体 role</h2></div></div>
            <p class="section-lead">媒体置于 <code>content[]</code> 中，仅接受公网 URL。<code>role</code> 决定任务模式与作用。</p>
            <div class="role-grid"><div v-for="item in selectedModel.roles" :key="item.role" class="role-card"><code>{{ item.role }}</code><strong>{{ item.label }}</strong><p>{{ item.description }}</p><small>默认：{{ item.defaultValue }}</small></div></div>
          </section>

          <section id="response" class="doc-section">
            <div class="section-heading"><div><span class="eyebrow">RESPONSE</span><h2>响应与任务状态</h2></div></div>
            <div class="response-grid"><div class="response-card"><div class="response-label">提交成功</div><pre><code>{{ selectedModel.kind === 'video' ? '{\n  "id": "task_xxx",\n  "object": "video",\n  "status": "queued",\n  "model": "' + selectedModel.id + '"\n}' : '{\n  "id": "task_xxx",\n  "object": "image",\n  "status": "queued",\n  "model": "' + selectedModel.id + '"\n}' }}</code></pre></div><div class="status-card"><div class="response-label">状态流转</div><div class="status-flow"><span>queued</span><b>→</b><span>in_progress</span><b>→</b><span class="done">completed</span></div><p>查询接口返回任务状态；完成后状态为 completed，失败时状态为 failed。</p></div></div>
          </section>

          <section id="pricing" class="doc-section">
            <div class="section-heading"><div><span class="eyebrow">PRICING</span><h2>计费</h2></div><span class="section-note">以线上配置为准</span></div>
            <div class="pricing-card"><div class="pricing-basis"><span class="basis-icon">₽</span><div><strong>计费依据</strong><p>预扣估算完成后，视频任务完成时按实际 Credit 结算。</p></div></div><div class="price-list"><div v-for="price in selectedModel.prices" :key="price.label" class="price-item"><span>{{ price.label }}</span><strong>{{ price.value }}</strong></div></div></div>
          </section>

          <section id="errors" class="doc-section last-section">
            <div class="section-heading"><div><span class="eyebrow">ERRORS</span><h2>错误码</h2></div></div>
            <div class="error-list"><div v-for="error in selectedModel.errors" :key="error.code" class="error-row"><code>{{ error.code }}</code><span>{{ error.description }}</span></div></div>
          </section>
        </template>

        <template v-else>
          <section class="doc-section api-reference-section">
            <div class="section-heading"><div><span class="eyebrow">API REFERENCE</span><h2>{{ selectedModel.title }} API</h2></div></div>
            <p class="section-lead">包含异步任务提交与状态轮询接口规范。</p>
            <div class="reference-card"><div class="reference-head"><span class="method blue">POST</span><code>{{ selectedModel.kind === 'video' ? '/v1/videos' : '/komyvo/v1/images' }}</code></div><h3>提交{{ selectedModel.kind === 'video' ? '视频' : '图片' }}生成任务</h3><p>提交生成任务，成功后返回任务 ID。</p><div class="code-card compact"><div class="example-switcher"><div class="example-tabs"><button v-for="example in exampleModes" :key="example.key" :class="{ active: currentExampleMode === example.key }" @click="exampleMode = example.key">{{ example.label }}</button></div><span>{{ activeExample.description }}</span></div><div class="code-toolbar"><span class="toolbar-title">完整请求示例</span><div class="code-toolbar-actions"><div class="code-tabs"><button v-for="language in ['curl', 'python', 'javascript']" :key="language" :class="{ active: codeLanguage === language }" @click="codeLanguage = language">{{ labelForLanguage(language) }}</button></div><button class="copy-code" @click="copyText(code, 'api-code')">{{ copied === 'api-code' ? '✓ 已复制' : '复制代码' }}</button></div></div><pre><code>{{ code }}</code></pre></div></div>
            <div class="reference-card"><div class="reference-head"><span class="method green">GET</span><code>{{ selectedModel.kind === 'video' ? '/v1/videos/:task_id' : '/komyvo/v1/images/:task_id' }}</code></div><h3>查询任务状态</h3><p>轮询任务，直到状态变为 <code>completed</code> 或 <code>failed</code>。</p></div>
          </section>
        </template>
      </main>

      <aside class="toc-sidebar">
        <div class="toc-title">ON THIS PAGE</div>
        <button @click="scrollToSection('quickstart')">快速开始</button>
        <button @click="scrollToSection('endpoints')">接口</button>
        <button @click="scrollToSection('parameters')">请求参数</button>
        <button @click="scrollToSection('content-items')">content[] 对象</button>
        <button @click="scrollToSection('model-limits')">模型限制</button>
        <button v-if="selectedModel.roles" @click="scrollToSection('media-roles')">媒体 role</button>
        <button @click="scrollToSection('response')">响应与任务状态</button>
        <button @click="scrollToSection('pricing')">计费</button>
        <button @click="scrollToSection('errors')">错误码</button>
        <div class="toc-divider"></div>
        <div class="toc-meta"><span>Base URL</span><code>api.komyvo.com</code></div>
        <div class="toc-meta"><span>Auth</span><code>Bearer Token</code></div>
      </aside>
    </div>
  </div>
</template>
