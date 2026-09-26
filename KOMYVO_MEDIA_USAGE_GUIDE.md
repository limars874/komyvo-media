# Komyvo 视频与图片生成调用说明

## 1. 基础配置

服务地址由部署方提供，请替换为实际的 New API 地址：

```text
https://<YOUR_NEW_API_BASE_URL>
```

调用方使用 **New API 下游 Token**，不是 Komyvo upstream API Key：

```http
Authorization: Bearer <NEW_API_KEY>
Content-Type: application/json
```

示例环境变量：

```bash
export BASE_URL='https://<YOUR_NEW_API_BASE_URL>'
export NEW_API_KEY='<YOUR_NEW_API_KEY>'
```

生产环境请使用 HTTPS；如果部署方提供的是 HTTP 地址，Token 和请求内容未加密，只适合短期测试。

## 2. 视频生成

### 2.1 支持模型

```text
Wonder-Ultra
Wonder-Pro
Wonder-Standard
wan3.0-video
happyhorse-1.0
happyhorse-1.1
```

公开别名：`doubao-seedance-2-5` → `Wonder-Ultra`、`doubao-seedance-2-0` → `Wonder-Pro`、`doubao-seedance-2-0-fast` → `Wonder-Standard`。

当前支持**文生视频**、**图生视频**、多媒体参考生视频、音频参考和带 `role` 的**首尾帧请求**，每个任务固定只生成一个输出，输出异步任务，通常为 MP4；当前不支持 `MediaId`、`ImportMedia`、文档或网页输入。多媒体数量和混合规则由模型能力 Map 校验。

### 2.1.1 统一媒体输入格式

媒体统一放在 `content[]` 中，客户端只传公网 URL：

```json
{"type":"image_url","role":"first_frame","image_url":{"url":"https://example.com/input.png"}}
{"type":"video_url","role":"reference_video","video_url":{"url":"https://example.com/reference.mp4"}}
```

`role` 支持以下值：

| `role` | 用途 | 规则 |
|---|---|---|
| `first_frame` | 首帧或单图生视频 | 单图时可省略，默认值为 `first_frame` |
| `last_frame` | 尾帧 | 必须与一个 `first_frame` 成对出现 |
| `reference_image` | 参考图片 | 数量按模型能力 Map；多张图片进入 `reference_to_video` |
| `reference_video` | 参考视频 | 数量按模型能力 Map；单个视频时可省略 |
| `reference_audio` | 参考音频 | 数量按模型能力 Map；单个音频时可省略 |

`first_frame` 与 `last_frame` 必须严格成对，且只能包含两张图片，不能混合其他媒体；一张未标记图片按 `image_to_video` 处理，多张图片或带其他媒体时按 `reference_to_video` 处理。`text` 内容项继续用于提示词，用户不需要填写 Vendor 的 `JobType`、`Input` 或 `MediaId`。

当前视频模型媒体能力 Map：

| 模型 | 图片 | 视频 | 音频 | 总媒体数 | 混合媒体 |
|---|---:|---:|---:|---:|---|
| `Wonder-Ultra` | 10 | 5 | 5 | 未确认 | 支持 |
| `Wonder-Pro` | 9 | 3 | 3 | 15 | 支持 |
| `Wonder-Standard` | 9 | 3 | 3 | 15 | 支持 |
| `wan3.0-video` | 10 | 5 | 5 | 20 | 支持 |
| `happyhorse-1.0/1.1` | 9 | 0 | 0 | 9 | 不支持 |

输入视频/音频累计时长暂不由 Plugin 校验，交给上游处理。

### 2.2 提交任务

接口：

```http
POST /v1/videos
```

示例：

```bash
curl --request POST "$BASE_URL/v1/videos" \
  --header "Authorization: Bearer $NEW_API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "happyhorse-1.0",
    "prompt": "一只橘猫在阳光下的草地上散步，写实风格",
    "seconds": 3,
    "size": "1280x720"
  }'
```

主要参数：

| 参数 | 必填 | 说明 |
|---|---:|---|
| `model` | 是 | 视频模型 ID，必须使用上面的名称。 |
| `prompt` | 是 | 文生视频提示词。 |
| `seconds` | 否 | 视频时长；`happyhorse-1.0` 已验证支持 3～15 秒。 |
| `size` | 否 | 如 `1280x720`（720P）、`1920x1080`（1080P）。 |
| `resolution` | 否 | 可填写 `720P` 或 `1080P`；不支持的值返回 400。 |
| `aspect_ratio` | 否 | 按模型能力 Map 校验：Wonder 三个版本额外支持 `21:9`；Wan3.0 仅支持基础 5 种；HappyHorse 额外支持 `21:9`、`5:4`、`4:5`。其他值返回 400。 |
| `scene` | 否 | 场景类型，默认 `general`。 |

### 2.2.1 图生视频

在同一接口中增加一个或多个 `content` 媒体项，图片必须使用公网 URL：

```bash
curl --request POST "$BASE_URL/v1/videos" \
  --header "Authorization: Bearer $NEW_API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "happyhorse-1.0",
    "content": [
      {"type": "image_url", "role": "first_frame", "image_url": {"url": "https://example.com/input.png"}},
      {"type": "text", "text": "让画面中的人物自然转身并向远处走去"}
    ],
    "seconds": 3,
    "resolution": "720P"
  }'
```

单图时 `content` 中包含一个 `image_url` 和一个 `text`；多图或图片与视频/音频混合时，Plugin 会自动转换为 Komyvo 的 `reference_to_video`。`role` 可填写 `first_frame`，省略时单图默认按首帧处理。用户不需要填写 `JobType` 或 `MediaId`。

### 2.2.2 参考视频生视频

在同一接口中传入一个或多个公开视频 URL，具体数量受模型能力 Map 限制：

```bash
curl --request POST "$BASE_URL/v1/videos" \
  --header "Authorization: Bearer $NEW_API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "doubao-seedance-2-0",
    "content": [
      {"type": "video_url", "role": "reference_video", "video_url": {"url": "https://example.com/reference.mp4"}},
      {"type": "text", "text": "保持人物主体，改成电影感镜头"}
    ],
    "seconds": 5,
    "resolution": "720P"
  }'
```

`video_url` 必须是供应商可访问的公开 `http(s)` URL。`role` 可填写 `reference_video`，省略时默认按参考视频处理。Plugin 会自动转换为 Komyvo 的 `reference_to_video` 和 `Input.Medias[].Type = "video"`；参考视频数量按模型能力 Map 校验，不接受 `MediaId`、`ImportMedia` 或本地文件上传。

### 2.2.3 音频参考生视频

音频输入沿用 Seedance 风格的 `audio_url` 和 `reference_audio`：

```bash
curl --request POST "$BASE_URL/v1/videos" \
  --header "Authorization: Bearer $NEW_API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "doubao-seedance-2-0",
    "content": [
      {"type": "audio_url", "role": "reference_audio", "audio_url": {"url": "https://example.com/reference.mp3"}},
      {"type": "text", "text": "按照音频节奏生成有镜头变化的视频"}
    ],
    "seconds": 5,
    "resolution": "720P"
  }'
```

`audio_url` 必须是 Vendor 可访问的公开 `http(s)` URL；音频数量、是否可以和图片/视频混合，均按模型能力 Map 校验。Plugin 会转换为 `reference_to_video` 和 `Input.Medias[].Type = "audio"`；不接受本地文件、`MediaId` 或 `ImportMedia`。

### 2.2.4 首尾帧生视频

首尾帧必须显式标注两个角色，不能只依赖图片顺序：

```bash
curl --request POST "$BASE_URL/v1/videos" \
  --header "Authorization: Bearer $NEW_API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "doubao-seedance-2-0",
    "content": [
      {"type": "image_url", "role": "first_frame", "image_url": {"url": "https://example.com/first.png"}},
      {"type": "image_url", "role": "last_frame", "image_url": {"url": "https://example.com/last.png"}},
      {"type": "text", "text": "让首帧自然过渡到尾帧"}
    ],
    "seconds": 5,
    "resolution": "720P"
  }'
```

Plugin 会将其转换为 Komyvo `JobType=first_last_frame` 和两个有序的 `Input.Medias` 图片媒体。首尾帧不能与 `reference_image`、`reference_video` 或其他媒体混合；当前只接受一组首尾帧。

提交成功返回本地任务 ID：

```json
{
  "id": "task_xxx",
  "object": "video",
  "status": "queued",
  "model": "happyhorse-1.0"
}
```

### 2.3 查询任务

```http
GET /v1/videos/:task_id
```

```bash
curl "$BASE_URL/v1/videos/<TASK_ID>" \
  --header "Authorization: Bearer $NEW_API_KEY"
```

状态通常为：

```text
queued → in_progress → completed
```

失败时状态为 `failed`，同时查看返回的 `error.message`。

### 2.4 下载视频

任务完成后：

```bash
curl --location \
  "$BASE_URL/v1/videos/<TASK_ID>/content" \
  --header "Authorization: Bearer $NEW_API_KEY" \
  --output result.mp4
```

## 3. 图片生成

### 3.1 支持模型

```text
qwen-image-3.0
qwen-image-2.0
Wonder-Image-2
Wonder-Image-Pro
```

公开别名：`komyvo-gpt-image-2` → `Wonder-Image-2`、`komyvo-gemini-2.5-flash-image` → `Wonder-Image-Pro`。

`qwen-image-2.0` 和 `qwen-image-3.0` 的图生图最多支持 3 张输入图片。

当前支持**文生图片**和**图生图**，输出异步任务，通常为 PNG；不需要填写 `ImportMedia` 或 `MediaId`。

图片接口使用 Plugin 声明的原生路由，不是标准 OpenAI 的 `/v1/images`：

```http
POST /komyvo/v1/images
```

### 3.2 提交任务

示例：

```bash
curl --request POST "$BASE_URL/komyvo/v1/images" \
  --header "Authorization: Bearer $NEW_API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "qwen-image-3.0",
    "prompt": "一只戴着宇航员头盔的橘猫，漂浮在星云中，电影级光影",
    "resolution": "1K"
  }'
```

主要参数：

| 参数 | 必填 | 说明 |
|---|---:|---|
| `model` | 是 | 图片模型 ID，可使用上面的原始模型名或公开别名。 |
| `prompt` | 是 | 文生图片提示词。 |
| `resolution` | 否 | `1K`、`2K` 或 `4K`，默认 `1K`；不支持的值返回 400。 |
| `size` | 否 | 也可使用尺寸表达，例如 `1024x1024`。 |
| `aspect_ratio` | 否 | 按图片模型能力 Map 校验；当前 `qwen-image-3.0` 额外支持 `5:4`、`4:5`、`3:2`、`2:3`、`21:9`，其他模型暂按基础 5 种处理。 |
| `scene` | 否 | 场景类型，默认 `general`。 |

### 3.2.1 图生图

在同一接口中增加 `content`，图片必须使用公网 URL：

```bash
curl --request POST "$BASE_URL/komyvo/v1/images" \
  --header "Authorization: Bearer $NEW_API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "qwen-image-3.0",
    "content": [
      {"type": "image_url", "role": "reference_image", "image_url": {"url": "https://example.com/input.png"}},
      {"type": "text", "text": "转换为电影感的黄昏色调，保持原有构图"}
    ],
    "resolution": "1K"
  }'
```

`content` 中支持一个或多个 `reference_image` 和文字提示词，数量按图片模型能力 Map 校验；Plugin 会自动转换为 Komyvo 的 `image_to_image`，用户不需要填写 `JobType` 或 `MediaId`。

提交成功返回本地任务 ID：

```json
{
  "id": "task_xxx",
  "object": "image",
  "status": "queued",
  "model": "qwen-image-3.0"
}
```

### 3.3 查询任务

```http
GET /komyvo/v1/images/:task_id
```

```bash
curl "$BASE_URL/komyvo/v1/images/<TASK_ID>" \
  --header "Authorization: Bearer $NEW_API_KEY"
```

状态通常为：

```text
queued/running → completed
```

### 3.4 获取图片

图片结果建议使用通用 artifact 接口：

```bash
curl "$BASE_URL/v1/tasks/<TASK_ID>/artifacts" \
  --header "Authorization: Bearer $NEW_API_KEY"
```

返回 `artifacts[0].content_url` 后，使用其中的路径和 `access` 参数下载：

```bash
CONTENT_URL=$(curl --silent \
  "$BASE_URL/v1/tasks/<TASK_ID>/artifacts" \
  --header "Authorization: Bearer $NEW_API_KEY" | jq -r '.artifacts[0].content_url')

CONTENT_PATH=$(printf '%s' "$CONTENT_URL" | sed -E 's#^https?://[^/]+##')

curl --location "$BASE_URL$CONTENT_PATH" \
  --output result.png
```

`content_url` 中的 `access` 是短期访问凭证，不要公开或长期保存。

当前 Plugin `0.7.5` 已支持模型别名在 native route 中直接使用，并按模型 Map 严格校验分辨率、宽高比、多媒体输入和 `content[]` 项类型；Qwen 图片模型最多接受 3 张输入图片：Wonder 三个版本额外支持 `21:9`，Wan3.0 保持基础 5 种，HappyHorse 额外支持 `21:9`、`5:4`、`4:5`，`qwen-image-3.0` 额外支持 `5:4`、`4:5`、`3:2`、`2:3`、`21:9`。后续只需调整 Plugin 内的模型能力 Map 即可扩展供应商已确认的比例。Plugin 同时支持图生图和音频参考输入，并将每个任务的输出数量固定为 1；完成任务后返回 `object=image` 和 `data[].url`。图片下载仍建议使用 artifact 接口，以获得统一的内容代理和短期访问 URL。

## 4. 常见错误

| 错误 | 原因 |
|---|---|
| `401 Unauthorized` | New API Token 无效、缺少 `Bearer` 或 Token 已禁用。 |
| `aspect_ratio must be one of: ...` | 宽高比不在当前模型能力 Map 允许范围内。 |
| `model_price_error` | 后台没有为该模型配置完整价格。 |
| `prompt is required` | 未填写非空 `prompt`。 |
| `content items must be objects` | native route 的 `content[]` 含有非对象项。 |
| `content items must be strings or objects` | `/v1/responses` 的输入内容含有不支持的标量项。 |
| `only public image/video/audio URLs are supported` | 媒体输入必须是 Komyvo upstream 可访问的公网 `http(s)` URL；不接受 `MediaId`、`ImportMedia` 或本地文件。 |
| `status=failed` | 查看响应中的 `error.message`，通常是模型权限、参数或供应商任务失败。 |

## 5. 调用流程摘要

```text
New API Token
    ↓ Authorization: Bearer <NEW_API_KEY>
POST /v1/videos 或 POST /komyvo/v1/images
    ↓
获得 task_id
    ↓
轮询对应查询接口
    ↓
completed
    ↓
视频：GET /v1/videos/:task_id/content
图片：GET /v1/tasks/:task_id/artifacts，再访问 image artifact content_url
```

提交后与第一次查询之间间隔极短时，首次返回 `unknown` 通常是正常的异步状态同步现象，继续查询即可。
