const http = require("http");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "0.0.0.0";
const types = {
  ".html": "text/html;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".js": "text/javascript;charset=utf-8",
};

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separator = trimmed.indexOf("=");
    if (separator === -1) return;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

loadEnvFile();

const aiProvider = process.env.AI_PROVIDER || "openai";
const openaiModel = process.env.OPENAI_VISION_MODEL || "gpt-4.1";
const openaiBaseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/$/, "");
const deepseekBaseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const deepseekVisionModel = process.env.DEEPSEEK_VISION_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
const deepseekTextModel = process.env.DEEPSEEK_TEXT_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const deepseekEnableImageInput = process.env.DEEPSEEK_ENABLE_IMAGE_INPUT !== "false";

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "content-type": "application/json;charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 12 * 1024 * 1024) {
        reject(new Error("上传图片过大，请压缩后再试。"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("请求 JSON 格式无效。"));
      }
    });
    req.on("error", reject);
  });
}

function readBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      chunks.push(chunk);
      total += chunk.length;
      if (total > 12 * 1024 * 1024) {
        reject(new Error("上传图片过大，请压缩后再试。"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipartImage(contentType, body) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    throw new Error("缺少 multipart boundary。");
  }

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  let cursor = body.indexOf(boundary);

  while (cursor !== -1) {
    const nextBoundary = body.indexOf(boundary, cursor + boundary.length);
    if (nextBoundary === -1) break;

    const part = body.subarray(cursor + boundary.length + 2, nextBoundary - 2);
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd !== -1) {
      const rawHeaders = part.subarray(0, headerEnd).toString("utf8");
      const content = part.subarray(headerEnd + 4);
      const disposition = rawHeaders.match(/content-disposition:\s*([^\r\n]+)/i)?.[1] || "";
      const contentTypeHeader = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "application/octet-stream";

      if (disposition.includes('name="image"') && content.length) {
        if (!contentTypeHeader.startsWith("image/")) {
          throw new Error("上传文件不是图片。");
        }

        return `data:${contentTypeHeader};base64,${content.toString("base64")}`;
      }
    }

    cursor = nextBoundary;
  }

  throw new Error("没有找到上传图片字段 image。");
}

function extractJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

async function recognizePositions(imageDataUrl) {
  if (aiProvider === "deepseek") {
    return recognizePositionsWithDeepseek(imageDataUrl);
  }

  return recognizePositionsWithOpenAI(imageDataUrl);
}

async function recognizePositionsWithOpenAI(imageDataUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 OPENAI_API_KEY 环境变量。");
  }

  let response;
  try {
    response = await fetch(`${openaiBaseUrl}/v1/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: openaiModel,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "请从这张中文券商持仓截图中识别持仓表。只返回 JSON，不要解释。字段：positions 数组，每项包含 name, category, marketValue, pnl, pnlRate, shares, costPrice, currentPrice。数值用 number，无法确定填 0。分类可从：现金/固收、银行、保险、电力公用、港股/互联网、汽车/新能源车、光伏新能源、医药、消费/白酒、商品/黄金、航运、港股/宽基、其他 中选择。合并不要在识别阶段做，同名多行保持多行。",
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "portfolio_positions",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              positions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    category: { type: "string" },
                    marketValue: { type: "number" },
                    pnl: { type: "number" },
                    pnlRate: { type: "number" },
                    shares: { type: "number" },
                    costPrice: { type: "number" },
                    currentPrice: { type: "number" },
                  },
                  required: [
                    "name",
                    "category",
                    "marketValue",
                    "pnl",
                    "pnlRate",
                    "shares",
                    "costPrice",
                    "currentPrice",
                  ],
                },
              },
            },
            required: ["positions"],
          },
          strict: true,
        },
      },
    }),
    });
  } catch (error) {
    const cause = error.cause?.code || error.cause?.message || "";
    const hint =
      cause === "UND_ERR_CONNECT_TIMEOUT"
        ? "连接 OpenAI API 超时，请检查代理或网络。可在 .env 设置 OPENAI_BASE_URL，或让 Node 走可访问 api.openai.com 的网络。"
        : cause === "EACCES"
          ? "当前运行环境禁止访问外部网络，请在普通 PowerShell 中运行 node server.js，或配置网络权限。"
          : "无法连接 OpenAI API，请检查网络、代理和 OPENAI_BASE_URL。";
    throw new Error(`${hint}${cause ? ` (${cause})` : ""}`);
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI API 请求失败。");
  }

  const text =
    data.output_text ||
    data.output
      ?.flatMap((item) => item.content || [])
      ?.find((item) => item.type === "output_text")?.text;
  const parsed = extractJson(text);
  if (!parsed || !Array.isArray(parsed.positions)) {
    throw new Error("GPT 返回结果不是可用的持仓 JSON。");
  }

  return parsed.positions;
}

async function recognizePositionsWithDeepseek(imageDataUrl) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 DEEPSEEK_API_KEY 环境变量。");
  }

  if (!deepseekEnableImageInput) {
    throw new Error(
      "DeepSeek 图片输入已被 .env 中的 DEEPSEEK_ENABLE_IMAGE_INPUT=false 关闭。请改为 true 后重启服务。",
    );
  }

  let response;
  try {
    response = await fetch(`${deepseekBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: deepseekVisionModel,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "请从这张中文券商持仓截图中识别持仓表。只返回 JSON，不要解释。格式：{\"positions\":[{\"name\":\"\",\"category\":\"\",\"marketValue\":0,\"pnl\":0,\"pnlRate\":0,\"shares\":0,\"costPrice\":0,\"currentPrice\":0}]}。数值用 number，无法确定填 0。分类可从：现金/固收、银行、保险、电力公用、港股/互联网、汽车/新能源车、光伏新能源、医药、消费/白酒、商品/黄金、航运、港股/宽基、其他 中选择。同名多行保持多行。",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 2048,
      }),
    });
  } catch (error) {
    const cause = error.cause?.code || error.cause?.message || "";
    throw new Error(`无法连接 DeepSeek API，请检查代理、网络和 DEEPSEEK_BASE_URL。${cause ? ` (${cause})` : ""}`);
  }

  const data = await response.json();
  if (!response.ok) {
    const message = data.error?.message || "DeepSeek API 请求失败。";
    if (message.includes("unknown variant `image_url`") || message.includes("expected `text`")) {
      throw new Error(
        "DeepSeek 当前接口拒绝了 image_url 图片输入，只接受 text。请关闭 DEEPSEEK_ENABLE_IMAGE_INPUT，或改用明确支持视觉输入的 API。",
      );
    }
    throw new Error(message);
  }

  const text = data.choices?.[0]?.message?.content;
  const parsed = extractJson(text);
  if (!parsed || !Array.isArray(parsed.positions)) {
    throw new Error("DeepSeek 返回结果不是可用的持仓 JSON。");
  }

  return parsed.positions;
}

async function analyzePortfolioWithAi(positions, analysis) {
  if (aiProvider !== "deepseek") {
    return analysis?.advices || [];
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 DEEPSEEK_API_KEY 环境变量。");
  }

  const response = await fetch(`${deepseekBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: deepseekTextModel,
      messages: [
        {
          role: "system",
          content:
            "你是一个谨慎的中文投资组合分析助手。只基于用户提供的持仓结构输出风险提示和再平衡建议，不要承诺收益，不要给具体买卖指令。",
        },
        {
          role: "user",
          content: `请分析下面的持仓，返回 JSON：{\"advices\":[\"...\"]}。建议 4-6 条，简洁、可执行、偏组合管理。\n\npositions=${JSON.stringify(positions)}\nanalysis=${JSON.stringify(analysis)}`,
        },
      ],
      response_format: {
        type: "json_object",
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "DeepSeek 持仓建议请求失败。");
  }

  const parsed = extractJson(data.choices?.[0]?.message?.content);
  if (!parsed || !Array.isArray(parsed.advices)) {
    throw new Error("DeepSeek 返回结果不是可用的建议 JSON。");
  }

  return parsed.advices.filter(Boolean).slice(0, 6);
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.url.split("?")[0] === "/api/recognize-positions") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const contentType = req.headers["content-type"] || "";
    const bodyReader = contentType.includes("multipart/form-data")
      ? readBuffer(req).then((body) => ({
          imageDataUrl: parseMultipartImage(contentType, body),
        }))
      : readJson(req);

    bodyReader
      .then(async ({ imageDataUrl }) => {
        if (!imageDataUrl || !String(imageDataUrl).startsWith("data:image/")) {
          sendJson(res, 400, { error: "请上传有效图片。" });
          return;
        }

        const positions = await recognizePositions(imageDataUrl);
        sendJson(res, 200, {
          positions,
          provider: aiProvider,
          model: aiProvider === "deepseek" ? deepseekVisionModel : openaiModel,
        });
      })
      .catch((error) => {
        sendJson(res, 500, { error: error.message });
      });
    return;
  }

  if (req.url.split("?")[0] === "/api/analyze-portfolio") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    readJson(req)
      .then(async ({ positions, analysis }) => {
        if (!Array.isArray(positions) || !positions.length) {
          sendJson(res, 400, { error: "缺少持仓数据。" });
          return;
        }

        const advices = await analyzePortfolioWithAi(positions, analysis || {});
        sendJson(res, 200, {
          advices,
          provider: aiProvider,
          model: aiProvider === "deepseek" ? deepseekTextModel : openaiModel,
        });
      })
      .catch((error) => {
        sendJson(res, 500, { error: error.message });
      });
    return;
  }

  if (req.url.split("?")[0] === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      provider: aiProvider,
      model: aiProvider === "deepseek" ? deepseekVisionModel : openaiModel,
      textModel: aiProvider === "deepseek" ? deepseekTextModel : openaiModel,
      baseUrl: aiProvider === "deepseek" ? deepseekBaseUrl : openaiBaseUrl,
      supportsImageInput: aiProvider === "deepseek" ? deepseekEnableImageInput : true,
      hasApiKey: aiProvider === "deepseek" ? Boolean(process.env.DEEPSEEK_API_KEY) : Boolean(process.env.OPENAI_API_KEY),
    });
    return;
  }

  let pathname = decodeURIComponent(req.url.split("?")[0]);
  if (pathname === "/") pathname = "/index.html";

  const filePath = path.join(root, pathname);
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "access-control-allow-origin": "*",
      "content-type": types[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Stock dashboard running at http://${host}:${port}`);
});
