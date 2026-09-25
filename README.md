# komyvo-media

为 New API 提供 Komyvo 视频与图片生成能力的 Task Plugin。

## 调用约定

- 视频：`POST /v1/videos`
- 图片：`POST /komyvo/v1/images`
- 媒体输入统一使用 `content[]` 中的公网 `http(s)` URL。
- 图片、视频和音频输入沿用 Seedance 风格的 `type` + `role` 结构。
- 单个图片或视频的 `role` 可以省略；首尾帧必须显式使用 `first_frame` 和 `last_frame`。
- 每个任务固定只生成一个输出，不对外支持 `n/N` 多输出参数。
- 客户端只提交媒体 URL，不提交 `MediaId`、`ImportMedia` 或 Vendor 内部字段。

完整的请求示例、任务查询和结果下载方式见[操作文档](KOMYVO_MEDIA_USAGE_GUIDE.md)。
