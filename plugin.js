const VIDEO_MODELS = [
  "Wonder-Ultra",
  "Wonder-Pro",
  "Wonder-Standard",
  "wan3.0-video",
  "happyhorse-1.0",
  "happyhorse-1.1",
];

const IMAGE_MODELS = ["Wonder-Image-2", "Wonder-Image-Pro", "qwen-image-2.0", "qwen-image-3.0"];
const ALL_MODELS = VIDEO_MODELS.concat(IMAGE_MODELS);
const VIDEO_RESOLUTIONS = ["720P", "1080P"];
const IMAGE_RESOLUTIONS = ["1K", "2K", "4K"];

export const meta = {
  apiVersion: 1,
  key: "komyvo-media",
  name: "Komyvo Media",
  description: {
    en: "Komyvo asynchronous video and image generation",
    zh: "Komyvo 视频与图片生成",
  },
  version: "0.4.0",
  author: { name: "Komyvo" },
  auth: "api_key",
  models: ALL_MODELS,
  fetchMode: "per_task",
  usageProfiles: [
    {
      models: VIDEO_MODELS,
      schema: {
        seconds: {
          type: "number",
          unit: "second",
          description: { en: "Output video duration", zh: "输出视频时长" },
        },
        resolution: {
          enum: VIDEO_RESOLUTIONS,
          description: { en: "Output video resolution", zh: "输出视频分辨率" },
        },
      },
      examples: [
        { label: "720P · 3s", facts: { seconds: 3, resolution: "720P" } },
        { label: "720P · 5s", facts: { seconds: 5, resolution: "720P" } },
      ],
    },
    {
      models: IMAGE_MODELS,
      schema: {
        count: {
          type: "number",
          unit: "count",
          description: { en: "Generated image count", zh: "生成图片数量" },
        },
        resolution: {
          enum: IMAGE_RESOLUTIONS,
          description: { en: "Output image resolution", zh: "输出图片分辨率" },
        },
      },
      examples: [{ label: "1K · 1 image", facts: { count: 1, resolution: "1K" } }],
    },
  ],
  routes: [
    {
      method: "POST",
      path: "/komyvo/v1/videos",
      type: "submit",
      action: "text_to_video",
      decode: "createVideoTask",
      render: "taskCreated",
      models: VIDEO_MODELS,
    },
    {
      method: "GET",
      path: "/komyvo/v1/videos/:task_id",
      type: "query",
      render: "taskStatus",
    },
    {
      method: "POST",
      path: "/komyvo/v1/images",
      type: "submit",
      action: "text_to_image",
      decode: "createImageTask",
      render: "taskCreated",
      models: IMAGE_MODELS,
    },
    {
      method: "GET",
      path: "/komyvo/v1/images/:task_id",
      type: "query",
      render: "taskStatus",
    },
  ],
  protocols: [
    { name: "openai_responses", supports: ["stream", "sync", "background"], models: VIDEO_MODELS },
    { name: "openai_video", models: VIDEO_MODELS },
  ],
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function trimmed(value) {
  return String(value === undefined || value === null ? "" : value).trim();
}

function parseJSON(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function firstValue(primary, secondary, names) {
  for (const name of names) {
    if (primary && primary[name] !== undefined && primary[name] !== null && primary[name] !== "") return primary[name];
    if (secondary && secondary[name] !== undefined && secondary[name] !== null && secondary[name] !== "") return secondary[name];
  }
  return undefined;
}

function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function actionIsImage(action) {
  return ["text_to_image", "image_to_image"].includes(trimmed(action).toLowerCase());
}

function isHTTPURL(value) {
  return /^https?:\/\//i.test(trimmed(value));
}

const MEDIA_ROLES = ["first_frame", "last_frame", "reference_image", "reference_video"];

function normalizeMediaRole(value) {
  const role = trimmed(value).toLowerCase();
  if (!role) return "";
  if (!MEDIA_ROLES.includes(role)) throw new Error("unsupported media role: " + role);
  return role;
}

function appendMedia(target, value, label, kind, role) {
  if (value === undefined || value === null || value === "") return;
  let candidate = value;
  let itemRole = role;
  if (isObject(value)) {
    if (itemRole === undefined) itemRole = value.role;
    candidate = kind === "image" ? value.url || value.Url : value.url || value.Url || value.video_url || value.video;
    if (isObject(candidate)) candidate = candidate.url || candidate.Url;
  }
  if (!candidate || !isHTTPURL(candidate)) throw new Error((label || kind + " URL") + " must be a public http(s) URL");
  const item = { url: trimmed(candidate), role: normalizeMediaRole(itemRole) };
  if (!target.some(function (existing) { return existing.url === item.url && existing.role === item.role; })) target.push(item);
}

function appendImageURL(target, value, label, role) {
  appendMedia(target, value, label || "image URL", "image", role);
}

function appendVideoURL(target, value, label, role) {
  appendMedia(target, value, label || "video URL", "video", role);
}

function mediaURLsFromContent(content) {
  if (content === undefined) return { images: [], videos: [] };
  if (!Array.isArray(content)) throw new Error("content must be an array");
  const images = [];
  const videos = [];
  for (const item of content) {
    if (!isObject(item)) continue;
    if (item.type === "text" || item.type === "input_text") continue;
    if (item.type === "image_url" || item.type === "input_image") {
      appendImageURL(images, item.image_url === undefined ? item.image : item.image_url, "image_url", item.role);
      continue;
    }
    if (item.type === "video_url" || item.type === "input_video" || item.type === "video" || Object.prototype.hasOwnProperty.call(item, "video_url")) {
      appendVideoURL(videos, item.video_url === undefined ? item.video : item.video_url, "video_url", item.role);
      continue;
    }
    throw new Error("only text, image_url, and video_url content is supported");
  }
  return { images: images, videos: videos };
}

function mergeMedia(target, values) {
  for (const value of values) {
    if (!target.some(function (existing) { return existing.url === value.url && existing.role === value.role; })) target.push(value);
  }
}

function mediaURLsFromBody(body) {
  if (!isObject(body)) return { images: [], videos: [] };
  const media = mediaURLsFromContent(body.content);
  const images = media.images;
  const videos = media.videos;
  appendImageURL(images, body.image_url, "image_url", body.role);
  appendImageURL(images, body.image, "image", body.role);
  appendImageURL(images, body.input_reference, "input_reference", body.role);
  if (body.images !== undefined) {
    if (!Array.isArray(body.images)) throw new Error("images must be an array");
    for (const image of body.images) appendImageURL(images, image, "images");
  }
  appendVideoURL(videos, body.video_url, "video_url", body.role);
  appendVideoURL(videos, body.video, "video", body.role);
  if (body.videos !== undefined) {
    if (!Array.isArray(body.videos)) throw new Error("videos must be an array");
    for (const video of body.videos) appendVideoURL(videos, video, "videos");
  }
  const input = typeof body.input === "string" ? parseJSON(body.input) : body.input;
  if (isObject(input)) {
    const nested = mediaURLsFromBody(input);
    mergeMedia(images, nested.images);
    mergeMedia(videos, nested.videos);
  }
  return { images: images, videos: videos };
}

function assertSupportedInput(body) {
  const unsupportedKeys = ["media", "Media", "Medias", "ImportMedia", "MediaId"];
  for (const key of unsupportedKeys) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== "" && !(Array.isArray(body[key]) && body[key].length === 0))
      throw new Error("only public image/video URLs are supported; MediaId and vendor media fields are not accepted");
  }
  for (const key of ["input", "Input"]) {
    const value = typeof body[key] === "string" ? parseJSON(body[key]) : body[key];
    if (!isObject(value)) continue;
    if (value.MediaId || value.mediaId || value.Media || value.Medias || value.media || value.medias)
      throw new Error("only public image/video URLs are supported; MediaId and vendor media fields are not accepted");
  }
  return mediaURLsFromBody(body);
}

function videoTaskAction(images, videos) {
  if (images.length && videos.length) throw new Error("image and video references cannot be mixed");
  if (videos.length > 1) throw new Error("reference_to_video accepts one video URL in this version");
  for (const video of videos) {
    if (video.role && video.role !== "reference_video") throw new Error("video_url role must be reference_video");
  }
  if (videos.length) return "reference_to_video";
  if (!images.length) return "text_to_video";

  const firstFrames = images.filter(function (image) { return image.role === "first_frame"; });
  const lastFrames = images.filter(function (image) { return image.role === "last_frame"; });
  const referenceImages = images.filter(function (image) { return image.role === "reference_image"; });
  const untagged = images.filter(function (image) { return !image.role; });

  if (referenceImages.length) {
    if (images.length > 1) throw new Error("reference_image accepts one image URL in this version");
    return "reference_to_video";
  }
  if (lastFrames.length) {
    if (!firstFrames.length || images.length !== 2 || firstFrames.length !== 1 || lastFrames.length !== 1 || untagged.length)
      throw new Error("last_frame requires exactly one first_frame image");
    return "first_last_frame";
  }
  if (firstFrames.length) {
    if (images.length === 1 && firstFrames.length === 1) return "image_to_video";
    if (images.length !== 2 || firstFrames.length !== 1 || untagged.length)
      throw new Error("first_last_frame requires exactly one first_frame and one last_frame image");
    return "first_last_frame";
  }
  if (images.length > 1) throw new Error("multiple image URLs require first_frame and last_frame roles");
  return "image_to_video";
}

function modelIsImage(model) {
  return IMAGE_MODELS.includes(trimmed(model));
}

function normalizeVideoResolution(value) {
  const raw = trimmed(value).toUpperCase();
  if (VIDEO_RESOLUTIONS.includes(raw)) return raw;
  const match = raw.replace("*", "x").split("x");
  if (match.length === 2) {
    const max = Math.max(Number(match[0]), Number(match[1]));
    if (max >= 1920) return "1080P";
    if (max > 0) return "720P";
  }
  return "720P";
}

function normalizeImageResolution(value) {
  const raw = trimmed(value).toUpperCase();
  if (IMAGE_RESOLUTIONS.includes(raw)) return raw;
  const match = raw.replace("*", "x").split("x");
  if (match.length === 2) {
    const max = Math.max(Number(match[0]), Number(match[1]));
    if (max >= 3840) return "4K";
    if (max >= 2048) return "2K";
  }
  return "1K";
}

function aspectRatioFromSize(value) {
  const parts = trimmed(value).replace("*", "x").split("x");
  if (parts.length !== 2) return "";
  const width = Number(parts[0]);
  const height = Number(parts[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return "";
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.05) return "1:1";
  if (Math.abs(ratio - 16 / 9) < 0.08) return "16:9";
  if (Math.abs(ratio - 9 / 16) < 0.08) return "9:16";
  if (Math.abs(ratio - 4 / 3) < 0.08) return "4:3";
  if (Math.abs(ratio - 3 / 4) < 0.08) return "3:4";
  return "";
}

function baseRoot(value) {
  const root = trimmed(value);
  if (!root) throw new Error("channel base URL is required");
  return root.replace(/\/+$/, "");
}

function queryURL(baseUrl, fields) {
  const query = Object.keys(fields)
    .filter(function (key) {
      return fields[key] !== undefined && fields[key] !== null && fields[key] !== "";
    })
    .map(function (key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(String(fields[key]));
    })
    .join("&");
  return baseRoot(baseUrl) + "/?" + query;
}

function komyvoHeaders(action, apiKey) {
  const timestamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  return {
    Authorization: trimmed(apiKey),
    Accept: "application/json",
    "x-acs-action": action,
    "x-acs-version": "2026-07-07",
    "x-acs-date": timestamp,
  };
}

function requestObject(ctx) {
  const body = ctx && ctx.body;
  if (!body || body.kind !== "json") throw new Error("JSON body required");
  if (!isObject(body.value)) throw new Error("request body must be an object");
  return body.value;
}

function promptFromBody(body) {
  if (typeof body.prompt === "string" && trimmed(body.prompt)) return trimmed(body.prompt);
  if (typeof body.Prompt === "string" && trimmed(body.Prompt)) return trimmed(body.Prompt);
  if (typeof body.input === "string" && trimmed(body.input)) return trimmed(body.input);
  if (isObject(body.input) && typeof body.input.prompt === "string" && trimmed(body.input.prompt)) return trimmed(body.input.prompt);
  if (isObject(body.input) && typeof body.input.Prompt === "string" && trimmed(body.input.Prompt)) return trimmed(body.input.Prompt);
  if (Array.isArray(body.content)) {
    const texts = body.content
      .filter(function (item) {
        return isObject(item) && (item.type === "text" || item.type === "input_text") && typeof item.text === "string";
      })
      .map(function (item) {
        return trimmed(item.text);
      })
      .filter(Boolean);
    if (texts.length) return texts.join("\n");
  }
  return "";
}

function nativeTextTask(ctx, kind) {
  const body = requestObject(ctx);
  const model = trimmed(body.model);
  if (!model) throw new Error("model is required");
  const media = assertSupportedInput(body);
  const images = media.images;
  const videos = media.videos;
  if (kind === "image" && videos.length) throw new Error("image generation does not support video input");
  if (kind === "image" && images.length > 9) throw new Error("image_to_image accepts at most nine image URLs");
  const prompt = promptFromBody(body);
  if (!prompt) throw new Error("prompt is required");
  const action = kind === "image"
    ? (images.length ? "image_to_image" : "text_to_image")
    : videoTaskAction(images, videos);
  return {
    kind: "submit",
    model: model,
    action: action,
    requestBody: { model: model, prompt: prompt, images: images, videos: videos, metadata: body },
  };
}

function multipartRequest(ctx) {
  if (!ctx.body || (ctx.body.kind !== "json" && ctx.body.kind !== "multipart")) throw new Error("JSON or multipart body required");
  if (ctx.body.kind === "json") return ctx.body.value;
  if ((ctx.body.files || []).length) throw new Error("media file upload is not enabled in the first plugin version");
  const fields = ctx.body.fields || {};
  const result = {};
  for (const name of Object.keys(fields)) {
    const values = fields[name] || [];
    if (values.length > 1) throw new Error(name + " must be provided once");
    result[name] = values[0];
  }
  if (result.metadata !== undefined) {
    result.metadata = parseJSON(result.metadata);
    if (!isObject(result.metadata)) throw new Error("metadata must be a JSON object string");
  }
  return result;
}

function openaiVideoTask(ctx) {
  const body = multipartRequest(ctx);
  if (!isObject(body)) throw new Error("request body must be an object");
  const media = assertSupportedInput(body);
  const images = media.images;
  const videos = media.videos;
  const action = videoTaskAction(images, videos);
  const prompt = promptFromBody(body);
  if (!prompt) throw new Error("prompt is required");
  const seconds = body.seconds === undefined ? body.duration : body.seconds;
  if (seconds !== undefined && (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0 || Number(seconds) > 3600))
    throw new Error("seconds must be between 1 and 3600");
  return {
    kind: "submit",
    model: ctx.model,
    action: action,
    requestBody: Object.assign({}, body, { model: ctx.model, prompt: prompt, seconds: seconds, images: images, videos: videos }),
  };
}

function responsesInput(value) {
  if (typeof value === "string") return { prompt: trimmed(value), images: [], videos: [] };
  if (!Array.isArray(value)) return { prompt: "", images: [], videos: [] };
  const texts = [];
  const images = [];
  const videos = [];
  for (const item of value) {
    if (typeof item === "string") {
      if (trimmed(item)) texts.push(trimmed(item));
      continue;
    }
    if (!isObject(item)) continue;
    const parts = Array.isArray(item.content) ? item.content : [item.content === undefined ? item : item.content];
    for (const part of parts) {
      if (typeof part === "string" && trimmed(part)) {
        texts.push(trimmed(part));
      } else if (isObject(part) && (part.type === "input_text" || part.type === "text") && typeof part.text === "string" && trimmed(part.text)) {
        texts.push(trimmed(part.text));
      } else if (isObject(part) && (part.type === "input_image" || part.type === "image_url")) {
        appendImageURL(images, part.image_url === undefined ? part.image : part.image_url, "input image", part.role);
      } else if (isObject(part) && (part.type === "input_video" || part.type === "video_url" || part.type === "video" || Object.prototype.hasOwnProperty.call(part, "video_url"))) {
        appendVideoURL(videos, part.video_url === undefined ? part.video : part.video_url, "input video", part.role);
      } else if (isObject(part) && part.type) {
        throw new Error("only text, image_url, and video_url content is supported");
      }
    }
  }
  return { prompt: texts.join("\n"), images: images, videos: videos };
}

function responsesText(value) {
  return responsesInput(value).prompt;
}

function responsesTask(ctx) {
  if (!ctx.body || ctx.body.kind !== "json" || !isObject(ctx.body.value)) throw new Error("JSON body required");
  const body = ctx.body.value;
  if (body.metadata !== undefined && !isObject(body.metadata)) throw new Error("metadata must be an object");
  const input = responsesInput(body.input);
  const prompt = input.prompt || trimmed(body.prompt);
  if (!prompt) throw new Error("input is required");
  const action = videoTaskAction(input.images, input.videos);
  const seconds = body.seconds === undefined ? body.duration : body.seconds;
  if (seconds !== undefined && (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0 || Number(seconds) > 3600))
    throw new Error("seconds must be between 1 and 3600");
  return {
    kind: "submit",
    model: ctx.model,
    action: action,
    requestBody: { model: ctx.model, prompt: prompt, seconds: seconds, images: input.images, videos: input.videos, metadata: body.metadata || {} },
  };
}

function inputObject(request, metadata) {
  const supplied = firstValue(request, metadata, ["Input", "input"]);
  if (supplied === undefined) return {};
  if (typeof supplied === "string") {
    const parsed = parseJSON(supplied);
    if (!isObject(parsed)) throw new Error("Input must be a JSON object string");
    return parsed;
  }
  if (!isObject(supplied)) throw new Error("Input must be a JSON object");
  return supplied;
}

function vendorInput(request, metadata, prompt, images, videos, taskAction) {
  const input = Object.assign({}, inputObject(request, metadata));
  if (!trimmed(input.Prompt) && prompt) input.Prompt = prompt;
  if (images.length) {
    const orderedImages = taskAction === "first_last_frame"
      ? images.slice().sort(function (left, right) {
          return ["first_frame", "last_frame"].indexOf(left.role) - ["first_frame", "last_frame"].indexOf(right.role);
        })
      : images;
    input.Medias = orderedImages.map(function (image) {
      return { Type: "image", Url: image.url };
    });
  }
  if (videos.length) input.Medias = videos.map(function (video) {
    return { Type: "video", Url: video.url };
  });
  return input;
}

function jsonString(value, label) {
  if (typeof value === "string") {
    if (!parseJSON(value)) throw new Error(label + " must be a JSON object string");
    return value;
  }
  if (!isObject(value)) throw new Error(label + " must be a JSON object");
  return JSON.stringify(value);
}

function buildFields(ctx) {
  const request = isObject(ctx.requestBody) ? ctx.requestBody : {};
  const metadata = isObject(request.metadata) ? request.metadata : {};
  const requestMedia = mediaURLsFromBody(request);
  const metadataMedia = mediaURLsFromBody(metadata);
  const images = requestMedia.images.slice();
  const videos = requestMedia.videos.slice();
  mergeMedia(images, metadataMedia.images);
  mergeMedia(videos, metadataMedia.videos);
  const outputImage = actionIsImage(ctx.action) || modelIsImage(ctx.upstreamModel || ctx.model);
  const model = trimmed(ctx.upstreamModel || ctx.model || request.model);
  const prompt = trimmed(request.prompt || promptFromBody(request) || promptFromBody(metadata));
  if (!model) throw new Error("model is required");
  if (!prompt) throw new Error("prompt is required");
  if (outputImage && videos.length) throw new Error("image generation does not support video input");
  if (outputImage && images.length > 9) throw new Error("image_to_image accepts at most nine image URLs");

  const taskAction = outputImage
    ? (images.length ? "image_to_image" : "text_to_image")
    : videoTaskAction(images, videos);
  const size = firstValue(request, metadata, ["size", "Size"]);
  const resolution = outputImage
    ? normalizeImageResolution(firstValue(request, metadata, ["resolution", "Resolution"]) || size)
    : normalizeVideoResolution(firstValue(request, metadata, ["resolution", "Resolution"]) || size);
  const ratio = firstValue(request, metadata, ["aspect_ratio", "aspectRatio", "AspectRatio", "ratio", "Ratio"]) || aspectRatioFromSize(size);
  const n = firstValue(request, metadata, ["n", "N"]);
  const duration = firstValue(request, metadata, ["seconds", "duration", "Duration"]);
  const scene = firstValue(request, metadata, ["scene", "Scene"]);
  const jobParameters = firstValue(request, metadata, ["jobParameters", "JobParameters", "job_parameters"]);
  const vendorAction = outputImage ? "SubmitImageGenerationJob" : "SubmitVideoGenerationJob";
  const fields = {
    Format: "JSON",
    JobType: taskAction,
    Model: model,
    Input: JSON.stringify(vendorInput(request, metadata, prompt, images, videos, taskAction)),
    Resolution: resolution,
  };
  if (ratio) fields.AspectRatio = ratio;
  if (n !== undefined && n !== null && n !== "") fields.N = String(n);
  if (!outputImage && duration !== undefined && duration !== null && duration !== "") fields.Duration = String(duration);
  if (scene !== undefined && scene !== null && scene !== "") fields.Scene = String(scene);
  if (jobParameters !== undefined && jobParameters !== null && jobParameters !== "") fields.JobParameters = jsonString(jobParameters, "JobParameters");
  return { action: vendorAction, taskAction: taskAction, fields: fields, model: model, image: outputImage };
}

function parseTaskEnvelope(body) {
  const value = parseJSON(body);
  if (!isObject(value)) return { job: {}, output: {}, raw: value };
  const job = value.VideoGenerationJob || value.videoGenerationJob || value.ImageGenerationJob || value.imageGenerationJob || value;
  const output = parseJSON(job.Output === undefined ? job.output : job.Output);
  return { job: isObject(job) ? job : {}, output: isObject(output) ? output : {}, raw: value };
}

function mediaList(output) {
  const medias = output.Medias || output.medias || output.Media || output.media || [];
  return Array.isArray(medias) ? medias : [];
}

function mediaURL(output, index) {
  const item = mediaList(output)[index];
  if (!isObject(item)) return "";
  return trimmed(item.OutputUrl || item.outputUrl || item.Url || item.url);
}

function kindFromContext(ctx, task) {
  if (actionIsImage(ctx && ctx.action) || actionIsImage(task && task.action)) return "image";
  if ((ctx && ctx.data && ctx.data.kind === "image") || (task && task.data && task.data.kind === "image")) return "image";
  if (modelIsImage(ctx && (ctx.upstreamModel || ctx.model))) return "image";
  if (task && task.properties && modelIsImage(task.properties.upstream_model_name)) return "image";
  if (task && task.data) {
    const parsed = parseTaskEnvelope(task.data);
    if (modelIsImage(parsed.job.Model || parsed.job.model)) return "image";
  }
  return "video";
}

function externalStatus(status) {
  const value = trimmed(status).toLowerCase();
  if (["created", "queuing", "pending", "queued"].includes(value)) return "queued";
  if (["executing", "processing", "running", "in_progress"].includes(value)) return "running";
  if (["finished", "succeeded", "success", "completed"].includes(value)) return "completed";
  if (["failed", "failure", "cancelled", "canceled", "expired"].includes(value)) return "failed";
  return "unknown";
}

function normalizedStatus(status) {
  const value = trimmed(status).toLowerCase();
  if (["created", "queuing", "pending", "queued"].includes(value)) return { status: "QUEUED", progress: "10%" };
  if (["executing", "processing", "running", "in_progress"].includes(value)) return { status: "IN_PROGRESS", progress: "50%" };
  if (["finished", "succeeded", "success", "completed"].includes(value)) return { status: "SUCCESS", progress: "100%" };
  if (["failed", "failure", "cancelled", "canceled", "expired"].includes(value)) return { status: "FAILURE", progress: "100%" };
  return { status: "UNKNOWN", progress: "0%" };
}

function resultURLFromTaskData(data, index) {
  const parsed = parseTaskEnvelope(data);
  return mediaURL(parsed.output, index);
}

function renderCreated(task) {
  const data = isObject(task.data) ? task.data : {};
  const kind = data.kind === "image" ? "image" : "video";
  return {
    id: task.task_id,
    object: kind,
    status: "queued",
    model: data.model || "",
    request_id: data.requestId || "",
  };
}

function renderStatus(ctx, task) {
  const kind = kindFromContext(ctx, task);
  const result = normalizedStatus(task.status);
  const output = {
    id: task.task_id,
    object: kind,
    status: externalStatus(task.status),
    progress: Number(String(result.progress).replace("%", "")),
    created_at: task.created_at,
    completed_at: task.updated_at,
  };
  const url = resultURLFromTaskData(task.data, 0);
  if (kind === "image" && url && result.status === "SUCCESS") output.data = [{ url: url }];
  if (kind === "video" && url && result.status === "SUCCESS") output.video_url = url;
  if (result.status === "FAILURE") output.error = { message: task.fail_reason || "task failed" };
  return output;
}

export const native = {
  createVideoTask: function (ctx) {
    return nativeTextTask(ctx, "video");
  },
  createImageTask: function (ctx) {
    return nativeTextTask(ctx, "image");
  },
  taskCreated: function (_ctx, task) {
    return renderCreated(task);
  },
  taskStatus: function (ctx, task) {
    return renderStatus(ctx, task);
  },
  error: function (_ctx, error) {
    return { error: { code: error.code, message: error.message } };
  },
};

export function buildSubmitRequest(ctx) {
  const built = buildFields(ctx);
  return {
    url: queryURL(ctx.baseUrl, built.fields),
    method: "POST",
    headers: komyvoHeaders(built.action, ctx.apiKey),
    body: "",
    action: built.taskAction,
    rewriteModel: built.model,
  };
}

export function parseSubmitResponse(_ctx, response) {
  const value = parseJSON(response && response.body);
  if (!isObject(value)) throw new Error("submit response must be a JSON object");
  const jobId = trimmed(value.JobId || value.jobId);
  if (!jobId) {
    const code = trimmed(value.Code || value.code);
    const message = trimmed(value.Message || value.message || value.ErrorMessage || value.errorMessage);
    throw new Error(code ? code + (message ? ": " + message : "") : "JobId is empty");
  }
  return {
    taskId: jobId,
    taskData: {
      kind: actionIsImage(_ctx.action) ? "image" : "video",
      model: _ctx.upstreamModel || _ctx.model || "",
      action: _ctx.action || "text_to_video",
      jobId: jobId,
      requestId: value.RequestId || value.requestId || "",
    },
  };
}

export function buildQueryRequest(ctx) {
  const image = kindFromContext(ctx) === "image";
  const action = image ? "GetImageGenerationJob" : "GetVideoGenerationJob";
  return {
    url: queryURL(ctx.baseUrl, { Format: "JSON", JobId: ctx.taskId }),
    method: "POST",
    headers: komyvoHeaders(action, ctx.apiKey),
    body: "",
  };
}

export function parseTaskResult(ctx, body, response) {
  const parsed = parseTaskEnvelope(body);
  const status = normalizedStatus(parsed.job.Status || parsed.job.status);
  if (status.status === "SUCCESS") {
    return {
      taskId: ctx.taskId,
      status: status.status,
      progress: status.progress,
      url: mediaURL(parsed.output, 0),
      remoteUrl: mediaURL(parsed.output, 0),
    };
  }
  if (status.status === "FAILURE") {
    const reason = trimmed(parsed.job.ErrorMessage || parsed.job.errorMessage || parsed.job.FailReason || parsed.job.failReason || parsed.raw.Message || parsed.raw.message);
    return { taskId: ctx.taskId, status: status.status, progress: status.progress, reason: reason || "upstream task failed" };
  }
  if (status.status === "UNKNOWN" && response && Number(response.status) >= 400) {
    const code = trimmed(parsed.raw.Code || parsed.raw.code);
    const message = trimmed(parsed.raw.Message || parsed.raw.message || parsed.raw.ErrorMessage || parsed.raw.errorMessage);
    return { taskId: ctx.taskId, status: "FAILURE", progress: "100%", reason: code ? code + (message ? ": " + message : "") : "upstream query failed" };
  }
  return { taskId: ctx.taskId, status: status.status, progress: status.progress };
}

export function listArtifacts(task) {
  if (task.status !== "SUCCESS") return [];
  const parsed = parseTaskEnvelope(task.data);
  const kind = actionIsImage(task.action) ? "image" : "video";
  const items = mediaList(parsed.output);
  const artifacts = [];
  for (let index = 0; index < items.length; index += 1) {
    if (!mediaURL(parsed.output, index)) continue;
    artifacts.push({ key: kind + (index === 0 ? "" : "_" + index), type: kind });
  }
  return artifacts;
}

export function buildContentRequest(ctx) {
  const match = /^(video|image)(?:_(\d+))?$/.exec(trimmed(ctx.artifactKey));
  if (!match) throw new Error("artifact_not_found");
  const index = match[2] === undefined ? 0 : Number(match[2]);
  const url = resultURLFromTaskData(ctx.data, index);
  if (!url) throw new Error("artifact_not_found");
  return { url: url, method: ctx.clientRequest.method, credentialless: true };
}

export function extractUsage(ctx) {
  if (ctx.usagePurpose === "billing_ratios") return null;
  const request = isObject(ctx.requestBody) ? ctx.requestBody : {};
  const metadata = isObject(request.metadata) ? request.metadata : {};
  const image = actionIsImage(ctx.action) || modelIsImage(ctx.upstreamModel || ctx.model);
  if (image) {
    const count = numberValue(firstValue(request, metadata, ["n", "N"]), 1);
    const resolution = normalizeImageResolution(firstValue(request, metadata, ["resolution", "Resolution", "size", "Size"]));
    return { count: count, resolution: resolution };
  }
  const seconds = numberValue(firstValue(request, metadata, ["seconds", "duration", "Duration"]), 5);
  const resolution = normalizeVideoResolution(firstValue(request, metadata, ["resolution", "Resolution", "size", "Size"]));
  return { seconds: seconds, resolution: resolution };
}

export function extractUsageOnComplete(ctx, result, body) {
  if (!result || result.status !== "SUCCESS") return {};
  const parsed = parseTaskEnvelope(body);
  const image = kindFromContext(ctx) === "image";
  if (image) {
    const count = mediaList(parsed.output).length;
    return count > 0 ? { count: count } : {};
  }
  const seconds = numberValue(parsed.job.Duration || parsed.job.duration || parsed.output.Duration || parsed.output.duration, 0);
  const resolution = parsed.job.Resolution || parsed.job.resolution || parsed.output.Resolution || parsed.output.resolution;
  const facts = {};
  if (seconds > 0) facts.seconds = seconds;
  if (resolution) facts.resolution = normalizeVideoResolution(resolution);
  return facts;
}

function videoArtifactText(ctx) {
  const artifact = ctx && ctx.artifacts && ctx.artifacts.video;
  const url = trimmed(artifact && artifact.url);
  if (!url) throw new Error("video artifact is unavailable");
  const escaped = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return '<video controls src="' + escaped + '"></video>';
}

export const protocols = {
  openai_responses: {
    decodeRequest: responsesTask,
    renderEvents: function (ctx, task, previousState) {
      const status = String(task.status || "UNKNOWN").toUpperCase();
      const value = Number(String(task.progress || "").replace("%", ""));
      const progress = Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
      const state = { status: status, progress: progress };
      if (status === "SUCCESS") {
        const text = videoArtifactText(ctx);
        const events = previousState && previousState.status === status ? [] : [{ type: "output", data: text }];
        return { events: events, state: state, done: true };
      }
      if (status === "FAILURE")
        return { events: [{ type: "error", code: "task_failed", message: task.fail_reason || "task failed" }], state: state, done: true };
      if (previousState && previousState.status === status && previousState.progress === progress) return { events: [], state: state, done: false };
      const event = { type: "progress", message: status.toLowerCase() };
      if (progress !== null) event.progress = progress;
      return { events: [event], state: state, done: false };
    },
    renderFinal: function (ctx) {
      return {
        output: [
          {
            type: "message",
            status: "completed",
            role: "assistant",
            content: [{ type: "output_text", text: videoArtifactText(ctx), annotations: [], logprobs: [] }],
          },
        ],
        metadata: { provider: "Komyvo" }
      };
    },
  },
  openai_video: {
    decodeRequest: openaiVideoTask,
    render: function (ctx, task) {
      const statusMap = { NOT_START: "queued", SUBMITTED: "queued", QUEUED: "queued", IN_PROGRESS: "in_progress", SUCCESS: "completed", FAILURE: "failed" };
      const output = {
        id: task.task_id,
        object: "video",
        model: task.properties ? task.properties.origin_model_name || "" : "",
        status: statusMap[task.status] || "unknown",
        progress: Number(String(task.progress || "0").replace("%", "")),
        created_at: task.created_at,
        completed_at: task.updated_at,
      };
      if (task.status === "FAILURE") output.error = { message: task.fail_reason || "task failed" };
      return output;
    },
  },
};
