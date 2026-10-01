export const apiBaseUrl = 'https://api.komyvo.com';

const videoParams = [
  { name: 'model', type: 'string', required: true, defaultValue: '-', description: '模型 ID。' },
  { name: 'prompt', type: 'string', required: true, defaultValue: '-', description: '提示词。也可以使用 content[] 中的 text 项；至少提供一处非空文本。' },
  { name: 'content', type: 'array', required: false, defaultValue: '[]（无媒体输入）', description: '对象数组，只接受 text、image_url、video_url、audio_url；媒体 URL 必须是公网 http(s)。' },
  { name: 'seconds', type: 'number', required: false, defaultValue: '5 秒', description: '输出时长；接受当前模型限制范围内的整数值。' },
  { name: 'resolution', type: 'string', required: false, defaultValue: '720P', description: '接受 720P、1080P 或有效 WxH 尺寸；WxH 会映射到对应分辨率档位。' },
  { name: 'aspect_ratio', type: 'string', required: false, defaultValue: '16:9', description: '画面比例；可选值以当前模型的“模型限制”为准。' },
  { name: 'generate_audio', type: 'boolean', required: false, defaultValue: 'true', description: 'true 生成音频，false 不生成音频。' },
];

const imageParams = [
  { name: 'model', type: 'string', required: true, defaultValue: '-', description: '模型 ID。' },
  { name: 'prompt', type: 'string', required: true, defaultValue: '-', description: '图片提示词；至少提供一处非空文本。' },
  { name: 'content', type: 'array', required: false, defaultValue: '[]（无媒体输入）', description: '图生图输入，只接受 image_url；每张图片必须是公网 http(s) URL。' },
  { name: 'resolution', type: 'string', required: false, defaultValue: '1K', description: '接受 1K、2K、4K 或有效 WxH 尺寸；WxH 会映射到对应分辨率档位。' },
  { name: 'aspect_ratio', type: 'string', required: false, defaultValue: '1:1', description: '画面比例；可选值以当前模型的“模型限制”为准。' },
];

const videoActionRules = [
  '无媒体：text_to_video。',
  '一张未标记图片或一张 first_frame：image_to_video。',
  '一个视频：reference_to_video，视频 role 必须为 reference_video。',
  '一段音频：reference_to_video，音频 role 必须为 reference_audio。',
  '一张 first_frame + 一张 last_frame：first_last_frame，必须恰好两张图片。',
  'reference_image、视频和音频按模型限制进入 reference_to_video；first_frame/last_frame 不能和其他媒体混用。',
];

const commonRules = [
  '每个任务固定生成一个输出；不提供 n 参数。',
  '媒体 content 项必须是对象；不接受本地路径、文件上传、MediaId、ImportMedia 或内部媒体字段。',
  '媒体 URL 必须以 http:// 或 https:// 开头；同一 URL 与 role 重复时只保留一份。',
];

const videoErrors = [
  { code: 'invalid_request_error', description: '请求参数不符合接口规则。' },
  { code: 'unsupported_media', description: '媒体 URL、类型或 role 不受当前模型支持。' },
  { code: 'task_failed', description: '任务失败，可查看任务状态中的 error.message。' },
  { code: 'model_price_error', description: '该模型尚未配置有效的计费表达式。' },
];

const imageErrors = [
  { code: 'invalid_request_error', description: '请求参数不符合图片任务校验规则。' },
  { code: 'unsupported_media', description: '图片 URL 或输入图片数量不符合模型限制。' },
  { code: 'task_failed', description: '图片任务失败。' },
];

const videoRoles = [
  { role: 'first_frame', label: '首帧', defaultValue: '单图时自动采用', description: '单图生视频或首尾帧的第一张图片。' },
  { role: 'last_frame', label: '尾帧', defaultValue: '未指定', description: '必须和 first_frame 成对出现。' },
  { role: 'reference_image', label: '参考图片', defaultValue: '未指定', description: '用于参考主体、风格或构图。' },
  { role: 'reference_video', label: '参考视频', defaultValue: '单视频时自动采用', description: '用于参考动作、节奏或镜头运动。' },
  { role: 'reference_audio', label: '参考音频', defaultValue: '单音频时自动采用', description: '用于参考节奏或音频内容。' },
];

const videoContentItems = [
  { type: 'text', fields: 'text: string', role: '不使用', description: '提示词文本。至少提供一个非空 text 项或顶层 prompt。' },
  { type: 'image_url', fields: 'image_url: { url: string }', role: 'first_frame / last_frame / reference_image', description: '图片 URL 必须是公网 http(s)。' },
  { type: 'video_url', fields: 'video_url: { url: string }', role: 'reference_video', description: '视频 URL 必须是公网 http(s)。' },
  { type: 'audio_url', fields: 'audio_url: { url: string }', role: 'reference_audio', description: '音频 URL 必须是公网 http(s)。' },
];

const imageContentItems = [
  { type: 'text', fields: 'text: string', role: '不使用', description: '图片提示词文本。' },
  { type: 'image_url', fields: 'image_url: { url: string }', role: 'reference_image', description: '图片 URL 必须是公网 http(s)。' },
];

const videoLimits = {
  seedance25: { duration: '4–15 秒', resolutions: ['720P', '1080P'], aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], input: { images: 10, videos: 5, audios: 5, totalMedia: null, mixedMedia: true } },
  seedance20: { duration: '4–15 秒', resolutions: ['720P', '1080P'], aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], input: { images: 9, videos: 3, audios: 3, totalMedia: 15, mixedMedia: true } },
  seedance20Fast: { duration: '4–15 秒', resolutions: ['720P', '1080P'], aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], input: { images: 9, videos: 3, audios: 3, totalMedia: 15, mixedMedia: true } },
  happyhorse10: { duration: '3–15 秒', resolutions: ['720P', '1080P'], aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '5:4', '4:5'], input: { images: 9, videos: 0, audios: 0, totalMedia: 9, mixedMedia: false } },
  happyhorse11: { duration: '3–15 秒', resolutions: ['720P', '1080P'], aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '5:4', '4:5'], input: { images: 9, videos: 0, audios: 0, totalMedia: 9, mixedMedia: false } },
  wan30: { duration: '2–30 秒', resolutions: ['720P', '1080P'], aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'], input: { images: 10, videos: 5, audios: 5, totalMedia: 20, mixedMedia: true, videoTotalSeconds: 15, audioTotalSeconds: 15 } },
};

const imageLimits = {
  image2: { resolutions: ['1K', '2K', '4K'], aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'], input: { images: 16, videos: 0, audios: 0, totalMedia: 16, mixedMedia: false } },
  imagePro: { resolutions: ['1K', '2K', '4K'], aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'], input: { images: 14, videos: 0, audios: 0, totalMedia: 14, mixedMedia: false } },
  qwen20: { resolutions: ['1K', '2K', '4K'], aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'], input: { images: 3, videos: 0, audios: 0, totalMedia: 3, mixedMedia: false } },
  qwen30: { resolutions: ['1K', '2K', '4K'], aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '5:4', '4:5', '3:2', '2:3', '21:9'], input: { images: 3, videos: 0, audios: 0, totalMedia: 3, mixedMedia: false } },
};

function videoModel({ id, title, description, prices, capabilities, limits, defaults = {} }) {
  return {
    id,
    title,
    kind: 'video',
    category: '视频生成',
    description,
    capabilities,
    limits,
    defaults,
    rules: [...commonRules, ...videoActionRules],
    prices,
    params: videoParams,
    errors: videoErrors,
    roles: videoRoles,
    contentItems: videoContentItems,
    endpoints: [
      { method: 'POST', path: '/v1/videos', label: '生成视频任务', tone: 'blue' },
      { method: 'GET', path: '/v1/videos/:task_id', label: '查询任务状态', tone: 'green' },
    ],
  };
}

function imageModel({ id, title, description, prices, capabilities, limits }) {
  return {
    id,
    title,
    kind: 'image',
    category: '图片生成',
    description,
    capabilities,
    limits,
    rules: [...commonRules, '图片任务只接受图片输入；视频和音频输入会返回错误。', '图片输入数量不能超过当前模型的图片上限；图片输出数量固定为一个任务结果。'],
    prices,
    params: imageParams,
    errors: imageErrors,
    contentItems: imageContentItems,
    endpoints: [
      { method: 'POST', path: '/komyvo/v1/images', label: '生成图片任务', tone: 'blue' },
      { method: 'GET', path: '/komyvo/v1/images/:task_id', label: '查询任务状态', tone: 'green' },
    ],
  };
}

export const models = [
  videoModel({
    id: 'doubao-seedance-2-5',
    title: 'Seedance 2.5',
    description: '面向高质量视频生成，支持文本、图片、视频和音频参考输入。',
    prices: [{ label: '720P', value: '¥1.6872 / 秒' }, { label: '1080P', value: '¥3.7961 / 秒' }],
    capabilities: ['文生视频', '图生视频', '参考视频', '首尾帧', '音频参考'],
    limits: videoLimits.seedance25,
  }),
  videoModel({
    id: 'doubao-seedance-2-0',
    title: 'Seedance 2.0',
    description: '支持多媒体参考输入的 Seedance 2.0 视频模型。',
    prices: [{ label: '720P', value: '¥1.2141 / 秒' }, { label: '1080P', value: '¥2.7318 / 秒' }],
    capabilities: ['文生视频', '图生视频', '参考视频', '首尾帧', '音频参考'],
    limits: videoLimits.seedance20,
  }),
  videoModel({
    id: 'doubao-seedance-2-0-fast',
    title: 'Seedance 2.0 Fast',
    description: '偏向成本效率的 Seedance 2.0 快速视频模型。',
    prices: [{ label: '720P', value: '¥0.8830 / 秒' }, { label: '1080P', value: '¥1.9868 / 秒' }],
    capabilities: ['文生视频', '图生视频', '参考视频', '首尾帧', '音频参考'],
    limits: videoLimits.seedance20Fast,
  }),
  videoModel({
    id: 'happyhorse-1.0',
    title: 'HappyHorse 1.0',
    description: '成本较低的视频生成模型，支持文本和单图输入；视频/音频参考不支持。',
    prices: [{ label: '720P', value: '¥0.90 / 秒' }, { label: '1080P', value: '¥1.60 / 秒' }],
    capabilities: ['文生视频', '图生视频'],
    limits: videoLimits.happyhorse10,
  }),
  videoModel({
    id: 'happyhorse-1.1',
    title: 'HappyHorse 1.1',
    description: 'HappyHorse 系列升级模型，支持文本和图片输入。',
    prices: [{ label: '720P', value: '¥0.90 / 秒' }, { label: '1080P', value: '¥1.20 / 秒' }],
    capabilities: ['文生视频', '图生视频'],
    limits: videoLimits.happyhorse11,
  }),
  videoModel({
    id: 'wan3.0-video',
    title: 'Wan 3.0 Video',
    description: '支持多媒体参考输入的视频生成模型。',
    prices: [{ label: '720P', value: '¥0.60 / 秒' }, { label: '1080P', value: '¥1.20 / 秒' }],
    capabilities: ['文生视频', '图生视频', '参考视频', '音频参考'],
    limits: videoLimits.wan30,
  }),
  imageModel({
    id: 'qwen-image-3.0',
    title: 'Qwen Image 3.0',
    description: '支持文生图和图生图的高质量图像生成模型。',
    prices: [{ label: '1K / 2K', value: '¥0.18 / 张' }, { label: '4K', value: '¥0.30 / 张' }],
    capabilities: ['文生图片', '图生图片', '最多 3 张输入图片'],
    limits: imageLimits.qwen30,
  }),
  imageModel({
    id: 'qwen-image-2.0',
    title: 'Qwen Image 2.0',
    description: '支持基础文生图和图生图能力。',
    prices: [{ label: '1K / 2K / 4K', value: '¥0.21 / 张' }],
    capabilities: ['文生图片', '图生图片'],
    limits: imageLimits.qwen20,
  }),
  imageModel({
    id: 'komyvo-image-2',
    title: 'Komyvo Image 2',
    description: '面向通用图像生成的图片模型。',
    prices: [{ label: '1K / 2K / 4K', value: '按后台配置' }],
    capabilities: ['文生图片', '图生图片'],
    limits: imageLimits.image2,
  }),
  imageModel({
    id: 'komyvo-image-banana',
    title: 'Komyvo Image Banana',
    description: '面向高质量写实风格的图片模型。',
    prices: [{ label: '1K / 2K / 4K', value: '按后台配置' }],
    capabilities: ['文生图片', '图生图片'],
    limits: imageLimits.imagePro,
  }),
];

export const modelGroups = [
  { key: 'video', label: '视频模型', icon: '▶', ids: models.filter((model) => model.kind === 'video').map((model) => model.id) },
  { key: 'image', label: '图片模型', icon: '✦', ids: models.filter((model) => model.kind === 'image').map((model) => model.id) },
];

export const defaultModelId = 'doubao-seedance-2-5';

export function getModel(id) {
  return models.find((model) => model.id === id) || models.find((model) => model.id === defaultModelId);
}
