// =========== Image Generation Providers ===========

const resolveEffectiveSeed = (seed) =>
  typeof seed === 'number' && seed >= 0 ? seed : Math.floor(Math.random() * 1e9);

const mockImageDataUrl = ({ seed, prompt, index }) => {
  const hue = ((seed + index * 47) % 360 + 360) % 360;
  const hue2 = (hue + 120) % 360;
  const label = (prompt ? prompt.substring(0, 32) + (prompt.length > 32 ? '…' : '') : 'Mock image')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const seedLabel = seed >= 0 ? seed : 'random';
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="768" viewBox="0 0 512 768">`,
    `  <defs>`,
    `    <linearGradient id="g${index}" x1="0" y1="0" x2="1" y2="1">`,
    `      <stop offset="0%" stop-color="hsl(${hue},55%,18%)"/>`,
    `      <stop offset="100%" stop-color="hsl(${hue2},45%,12%)"/>`,
    `    </linearGradient>`,
    `  </defs>`,
    `  <rect width="512" height="768" fill="url(#g${index})"/>`,
    `  <text x="256" y="370" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,sans-serif" font-size="15" fill="rgba(255,255,255,0.75)">${label}</text>`,
    `  <text x="256" y="400" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.4)">seed: ${seedLabel} · mock · ${index + 1}</text>`,
    `</svg>`
  ].join('\n');
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
};

export const runMockGeneration = async (spec) => {
  const { prompt = '', params = {} } = spec;
  const { numImages = 1, seed = -1 } = params;
  const effectiveSeed = resolveEffectiveSeed(seed);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const outputs = Array.from({ length: Math.max(1, numImages) }, (_, index) => ({
    dataUrl: mockImageDataUrl({ seed: effectiveSeed + index, prompt, index }),
    seed: effectiveSeed + index,
    fileName: `mock-${effectiveSeed}-${index}.svg`
  }));
  return { status: 'done', provider: 'mock', outputs };
};

export const runLocalApiGeneration = async (spec, config) => {
  const { prompt = '', negativePrompt = '', params = {} } = spec;
  const endpoint = (config.endpoint || 'http://127.0.0.1:7860').replace(/\/$/, '');
  const { resolution = '512x768', steps = 28, sampler = 'DPM++ 2M Karras', cfgScale = 7, numImages = 1, seed = -1 } = params;
  const [widthStr, heightStr] = (resolution || '512x768').split('x');
  const width = parseInt(widthStr, 10) || 512;
  const height = parseInt(heightStr, 10) || 768;
  const body = {
    prompt,
    negative_prompt: negativePrompt,
    width,
    height,
    steps,
    sampler_name: sampler,
    cfg_scale: cfgScale,
    batch_size: Math.max(1, numImages),
    seed: typeof seed === 'number' && seed >= 0 ? seed : -1
  };
  let response;
  try {
    response = await fetch(`${endpoint}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (error) {
    return {
      status: 'error',
      provider: 'local-api',
      error: `Failed to connect to ${endpoint}: ${error.message}. Check whether the local server is running.`
    };
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return {
      status: 'error',
      provider: 'local-api',
      error: `Error ${response.status} from the local endpoint: ${text || response.statusText}`
    };
  }
  let data;
  try {
    data = await response.json();
  } catch (error) {
    return { status: 'error', provider: 'local-api', error: `Invalid server response: ${error.message}` };
  }
  const images = data.images || [];
  let infoSeeds = [];
  try {
    const info = JSON.parse(data.info || '{}');
    infoSeeds = info.all_seeds || [];
  } catch {}
  const outputs = images.map((base64, index) => ({
    dataUrl: `data:image/png;base64,${base64}`,
    seed: infoSeeds[index] ?? -1,
    fileName: `output-${Date.now()}-${index}.png`
  }));
  return { status: 'done', provider: 'local-api', outputs };
};

export const runImageGeneration = async (spec, config) => {
  const type = config?.type || 'mock';
  if (type === 'local-api') return runLocalApiGeneration(spec, config);
  return runMockGeneration(spec);
};

// =========== Legacy pipeline stubs ===========

export const runImagePipeline = async (sceneSpec) => {
  return {
    status: 'not-implemented',
    message:
      'Connect your local runner here (ComfyUI, InvokeAI, A1111, etc.) to generate images while preserving canonical fidelity.',
    input: sceneSpec
  };
};

export const runVideoPipeline = async (videoSpec) => {
  return {
    status: 'not-implemented',
    message:
      'Connect your local image-to-video runner here to export offline clips on your computer.',
    input: videoSpec
  };
};
