const defaultStocks = [
  {
    symbol: "600519",
    name: "贵州茅台",
    sector: "白酒",
    price: 1428.3,
    pe: 23.8,
    pb: 8.4,
    roe: 34.6,
    percentile: 31,
    heat: 82,
    growth: 16.2,
    margin: 52.7,
    debt: 18.4,
  },
  {
    symbol: "00700",
    name: "腾讯控股",
    sector: "互联网",
    price: 386.8,
    pe: 18.6,
    pb: 3.7,
    roe: 19.2,
    percentile: 24,
    heat: 76,
    growth: 10.8,
    margin: 31.1,
    debt: 22.5,
  },
  {
    symbol: "300750",
    name: "宁德时代",
    sector: "新能源",
    price: 213.4,
    pe: 25.7,
    pb: 4.9,
    roe: 20.6,
    percentile: 58,
    heat: 71,
    growth: 7.9,
    margin: 24.8,
    debt: 41.6,
  },
  {
    symbol: "601318",
    name: "中国平安",
    sector: "保险",
    price: 47.2,
    pe: 9.1,
    pb: 0.8,
    roe: 9.4,
    percentile: 18,
    heat: 49,
    growth: 4.1,
    margin: 12.6,
    debt: 34.1,
  },
  {
    symbol: "AAPL",
    name: "Apple",
    sector: "消费电子",
    price: 196.5,
    pe: 29.4,
    pb: 37.9,
    roe: 148.3,
    percentile: 74,
    heat: 88,
    growth: 5.8,
    margin: 46.1,
    debt: 29.7,
  },
];

const storageKey = "money.watchlist.v1";
const snapshotDbName = "money.portfolio.db";
const snapshotStoreName = "snapshots";
let stocks = loadStocks();
let selectedSymbol = stocks[0]?.symbol;
let refreshTimer = null;
let snapshotDb = null;
let snapshots = [];
let fileSnapshots = [];
let selectedSnapshotId = "";
let expandedCategory = "";
let parsedPositions = [];
let snapshotImageDataUrl = "";

const els = {
  totalCount: document.querySelector("#totalCount"),
  cheapCount: document.querySelector("#cheapCount"),
  expensiveCount: document.querySelector("#expensiveCount"),
  heatAverage: document.querySelector("#heatAverage"),
  updatedAt: document.querySelector("#updatedAt"),
  stockRows: document.querySelector("#stockRows"),
  detailPanel: document.querySelector("#detailPanel"),
  searchInput: document.querySelector("#searchInput"),
  valuationFilter: document.querySelector("#valuationFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  refreshBtn: document.querySelector("#refreshBtn"),
  addStockBtn: document.querySelector("#addStockBtn"),
  snapshotBtn: document.querySelector("#snapshotBtn"),
  stockDialog: document.querySelector("#stockDialog"),
  stockForm: document.querySelector("#stockForm"),
  autoRefresh: document.querySelector("#autoRefresh"),
  snapshotSelect: document.querySelector("#snapshotSelect"),
  portfolioValue: document.querySelector("#portfolioValue"),
  portfolioPnl: document.querySelector("#portfolioPnl"),
  portfolioCount: document.querySelector("#portfolioCount"),
  portfolioTopCategory: document.querySelector("#portfolioTopCategory"),
  categoryRows: document.querySelector("#categoryRows"),
  adviceList: document.querySelector("#adviceList"),
  pnlChart: document.querySelector("#pnlChart"),
  snapshotDialog: document.querySelector("#snapshotDialog"),
  snapshotForm: document.querySelector("#snapshotForm"),
  snapshotDate: document.querySelector("#snapshotDate"),
  snapshotImage: document.querySelector("#snapshotImage"),
  snapshotPreview: document.querySelector("#snapshotPreview"),
  positionText: document.querySelector("#positionText"),
  gptRecognizeBtn: document.querySelector("#gptRecognizeBtn"),
  loadSampleBtn: document.querySelector("#loadSampleBtn"),
  parsePositionsBtn: document.querySelector("#parsePositionsBtn"),
  parseStatus: document.querySelector("#parseStatus"),
  parsedRows: document.querySelector("#parsedRows"),
};

const samplePositionText = `交通银行 48764.00 175.15 7300 6.652 6.680
短融ETF 90845.60 79.30 800 113.458 113.557
银华日利 110586.30 38.80 1100 100.498 100.533
长江电力 10664.00 -10.94 400 26.660 26.660
招商银行 22356.00 -52.12 600 37.319 37.260
恒生科H 7616.00 -347.70 11200 0.711 0.680
工商银行 40812.00 -507.73 5700 7.245 7.160
中国平安 9876.00 -536.54 200 52.010 49.380
长江电力 34658.00 -570.54 1300 27.081 26.660
黄金ETF 14252.80 -867.91 1600 9.450 8.908
港股通50 6179.80 -928.00 5300 1.341 1.166
中远海控 19320.00 -1182.55 1400 14.634 13.800
通威股份 6425.00 -1378.77 500 15.590 12.850
中概互联 12268.90 -1428.61 11900 1.151 1.031
恒生科技 10238.80 -2095.43 17900 0.689 0.572
中概互联 13299.90 -2617.66 12900 1.234 1.031
医疗ETF 15350.40 -3445.67 41600 0.452 0.369
比亚迪 26439.00 -4676.72 300 103.657 88.130
比亚迪 52878.00 -4753.94 600 96.000 88.130
中国平安 88884.00 -4983.84 1800 52.119 49.380
酒ETF 7191.20 -5011.15 17800 0.685 0.404`;

const categoryRules = [
  { category: "现金/固收", keys: ["银华日利", "短融", "国债", "货币", "逆回购"] },
  { category: "金融红利", keys: ["银行", "招商银行", "工商银行", "交通银行", "建设银行", "农业银行", "中国平安", "保险", "太保", "人寿", "长江电力", "电力", "水电", "公用"] },
  { category: "科技成长", keys: ["中概", "恒生科", "恒生科技", "港股通50", "港股通", "恒生指数", "腾讯", "阿里", "美团"] },
  { category: "制造成长", keys: ["比亚迪", "汽车", "新能源车", "通威", "光伏", "新能源"] },
  { category: "消费医药", keys: ["医疗", "医药", "创新药", "酒", "白酒", "消费", "茅台", "五粮液"] },
  { category: "商品周期", keys: ["黄金", "有色", "海控", "航运", "中远"] },
];

const categoryAliases = {
  "": "现金/固收",
  其他: "现金/固收",
  现金: "现金/固收",
  可用现金: "现金/固收",
  银行: "金融红利",
  保险: "金融红利",
  电力公用: "金融红利",
  核心红利: "金融红利",
  "港股/互联网": "科技成长",
  "港股/宽基": "科技成长",
  "汽车/新能源车": "制造成长",
  光伏新能源: "制造成长",
  医药: "消费医药",
  "消费/白酒": "消费医药",
  "商品/黄金": "商品周期",
  航运: "商品周期",
};

const categoryColors = {
  金融红利: "#176b87",
  总盈亏: "#182025",
  "现金/固收": "#147a55",
  制造成长: "#b33a3a",
  科技成长: "#6d5dfc",
  商品周期: "#a05d00",
  消费医药: "#c13f8a",
  其他: "#68757d",
};

function loadStocks() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return defaultStocks;

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length ? parsed : defaultStocks;
  } catch {
    return defaultStocks;
  }
}

function saveStocks() {
  localStorage.setItem(storageKey, JSON.stringify(stocks));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getValuation(stock) {
  if (stock.percentile <= 30 && stock.pe <= 22 && stock.pb <= 4.5) return "cheap";
  if (stock.percentile >= 70 || stock.pe >= 35 || stock.pb >= 8) return "expensive";
  return "fair";
}

function getValuationLabel(value) {
  return {
    cheap: "低估",
    fair: "合理",
    expensive: "高估",
  }[value];
}

function getPillClass(value) {
  return {
    cheap: "good",
    fair: "warn",
    expensive: "bad",
  }[value];
}

function scoreStock(stock) {
  const valuationScore = 100 - stock.percentile;
  const qualityScore = clamp(stock.roe * 2 + stock.margin * 0.4 - stock.debt * 0.25, 0, 100);
  const growthScore = clamp(stock.growth * 4, 0, 100);
  const heatScore = clamp(stock.heat, 0, 100);

  return Math.round(
    valuationScore * 0.34 + qualityScore * 0.28 + growthScore * 0.18 + heatScore * 0.2,
  );
}

function getFilteredStocks() {
  const keyword = els.searchInput.value.trim().toLowerCase();
  const valuation = els.valuationFilter.value;

  return stocks
    .filter((stock) => {
      const text = `${stock.symbol} ${stock.name} ${stock.sector}`.toLowerCase();
      const matchesKeyword = !keyword || text.includes(keyword);
      const matchesValuation = valuation === "all" || getValuation(stock) === valuation;
      return matchesKeyword && matchesValuation;
    })
    .sort((a, b) => {
      const sort = els.sortSelect.value;
      if (sort === "percentile-asc") return a.percentile - b.percentile;
      if (sort === "heat-desc") return b.heat - a.heat;
      if (sort === "pe-asc") return a.pe - b.pe;
      return scoreStock(b) - scoreStock(a);
    });
}

function formatNumber(value, digits = 1) {
  return Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function openSnapshotDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(snapshotDbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(snapshotStoreName)) {
        const store = db.createObjectStore(snapshotStoreName, {
          keyPath: "id",
        });
        store.createIndex("date", "date");
        store.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGetAllSnapshots() {
  return new Promise((resolve, reject) => {
    const tx = snapshotDb.transaction(snapshotStoreName, "readonly");
    const request = tx.objectStore(snapshotStoreName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function dbSaveSnapshot(snapshot) {
  return new Promise((resolve, reject) => {
    const tx = snapshotDb.transaction(snapshotStoreName, "readwrite");
    const request = tx.objectStore(snapshotStoreName).put(snapshot);
    request.onsuccess = () => resolve(snapshot);
    request.onerror = () => reject(request.error);
  });
}

function inferCategory(name) {
  if (name.includes("现金") || name.includes("可用")) return "现金/固收";
  const hit = categoryRules.find((rule) => rule.keys.some((key) => name.includes(key)));
  return hit?.category || "现金/固收";
}

function normalizeCategory(category, name = "") {
  const normalized = String(category || "").trim();
  if (categoryAliases[normalized]) return categoryAliases[normalized];
  return inferCategory(name);
}

function parseNumber(value) {
  if (!value) return 0;
  const normalized = String(value).replace(/[,%，]/g, "").replace(/[−－]/g, "-");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePositionText(text) {
  const directRows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[\s,，\t]+/).filter(Boolean);
      if (parts.length < 3) return null;
      const [name, marketValue, pnl, shares, costPrice, currentPrice, category] = parts;
      return {
        name,
        category: normalizeCategory(category, name),
        marketValue: parseNumber(marketValue),
        pnl: parseNumber(pnl),
        shares: parseNumber(shares),
        costPrice: parseNumber(costPrice),
        currentPrice: parseNumber(currentPrice),
      };
    })
    .filter((item) => item && item.name && item.marketValue > 0);

  if (directRows.length) return directRows;

  return parseOcrLikeText(text);
}

function parseOcrLikeText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const positions = [];

  for (let index = 0; index < lines.length; index += 1) {
    const name = lines[index];
    const nextLine = lines[index + 1];
    const thirdLine = lines[index + 2];
    const fourthLine = lines[index + 3];

    if (!name || !nextLine || !thirdLine || !fourthLine) continue;
    if (/^[\d.,+\-−－%]+$/.test(name)) continue;
    if (!/[\d]/.test(nextLine) || !/[\d]/.test(thirdLine) || !/[\d]/.test(fourthLine)) continue;

    const marketValue = parseNumber(nextLine);
    const pnlParts = thirdLine.split(/\s+/);
    const pnl = parseNumber(pnlParts[0]);
    const shares = parseNumber(fourthLine);
    const costPrice = parseNumber(lines[index + 4]);
    const currentPrice = parseNumber(lines[index + 5]);

    if (marketValue <= 0 || !Number.isFinite(pnl)) continue;

    positions.push({
      name,
      category: inferCategory(name),
      marketValue,
      pnl,
      shares,
      costPrice,
      currentPrice,
    });
  }

  return positions;
}

function groupByName(positions) {
  const map = new Map();
  positions.forEach((position) => {
    const current = map.get(position.name) || {
      ...position,
      marketValue: 0,
      pnl: 0,
      shares: 0,
    };
    current.marketValue += position.marketValue;
    current.pnl += position.pnl;
    current.shares += position.shares;
    current.category = current.category || position.category;
    current.currentPrice = position.currentPrice || current.currentPrice;
    current.costPrice = current.shares
      ? (current.marketValue - current.pnl) / current.shares
      : current.costPrice;
    map.set(position.name, current);
  });
  return [...map.values()].sort((a, b) => b.marketValue - a.marketValue);
}

function analyzePositions(positions) {
  const merged = groupByName(positions);
  const totalValue = merged.reduce((sum, item) => sum + item.marketValue, 0);
  const totalPnl = merged.reduce((sum, item) => sum + item.pnl, 0);
  const categoryMap = new Map();

  merged.forEach((item) => {
    const row = categoryMap.get(item.category) || {
      category: item.category,
      marketValue: 0,
      pnl: 0,
      count: 0,
    };
    row.marketValue += item.marketValue;
    row.pnl += item.pnl;
    row.count += 1;
    categoryMap.set(item.category, row);
  });

  const categories = [...categoryMap.values()]
    .map((item) => ({
      ...item,
      weight: totalValue ? item.marketValue / totalValue : 0,
      pnlRate: item.marketValue ? item.pnl / item.marketValue : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);

  return {
    totalValue,
    totalPnl,
    totalPnlRate: totalValue ? totalPnl / totalValue : 0,
    count: merged.length,
    categories,
    positions: merged,
    topCategory: categories[0]?.category || "--",
    advices: buildPortfolioAdvice(totalValue, totalPnl, categories, merged),
  };
}

function normalizeFileSnapshot(snapshot) {
  const positions = (snapshot.positions || []).map((position) => ({
    name: position.name,
    category: normalizeCategory(position.category, position.name || ""),
    marketValue: Number(position.marketValue || 0),
    pnl: Number(position.pnl || 0),
    shares: Number(position.shares || 0),
    costPrice: Number(position.costPrice || 0),
    currentPrice: Number(position.currentPrice || 0),
  }));

  const analysis = analyzePositions(positions);
  if (snapshot.analysis?.advices?.length) {
    analysis.advices = snapshot.analysis.advices;
  }

  return {
    id: `file:${snapshot.id || snapshot.date}`,
    date: snapshot.date,
    imageDataUrl: "",
    rawText: "",
    positions,
    analysis,
    createdAt: snapshot.recognizedAt || snapshot.date,
    source: snapshot.source,
    readonly: true,
  };
}

function buildPortfolioAdvice(totalValue, totalPnl, categories, positions) {
  if (!positions.length) return ["暂无持仓数据，先上传并解析持仓快照。"];

  const advices = [];
  const cash = categories.find((item) => item.category === "现金/固收");
  const top = categories[0];
  const weak = categories
    .filter((item) => item.pnlRate <= -0.12 && item.weight >= 0.01)
    .slice(0, 3);
  const concentration = positions.filter((item) => totalValue && item.marketValue / totalValue >= 0.12);
  const defensiveWeight = categories
    .filter((item) => ["现金/固收", "银行", "保险", "电力公用"].includes(item.category))
    .reduce((sum, item) => sum + item.weight, 0);

  if (cash && cash.weight >= 0.25) {
    advices.push(`现金/固收占比 ${formatNumber(cash.weight * 100, 1)}%，组合有较强防守垫，可用于分批承接高质量资产而不是一次性加仓。`);
  } else if (!cash || cash.weight < 0.1) {
    advices.push("现金/固收缓冲偏低，若组合波动让你不舒服，优先补足流动性仓位。");
  }

  if (top && top.weight >= 0.3) {
    advices.push(`${top.category} 占比 ${formatNumber(top.weight * 100, 1)}%，单一类别集中度偏高，新增资金宜优先投向相关性较低的方向。`);
  }

  if (concentration.length) {
    advices.push(`大仓位标的包括 ${concentration.map((item) => item.name).join("、")}，建议分别设定目标仓位和再平衡阈值。`);
  }

  if (weak.length) {
    advices.push(`亏损较深的类别是 ${weak.map((item) => item.category).join("、")}，加仓前先复核基本面是否仍成立，避免只因跌幅补仓。`);
  }

  if (defensiveWeight >= 0.55) {
    advices.push("防守资产占比较高，组合回撤控制较好；若追求收益弹性，可把新增资金限定比例配置到成长或宽基。");
  }

  if (totalPnl < 0) {
    advices.push(`当前整体浮亏 ${formatMoney(Math.abs(totalPnl))}，适合按类别做复盘：保留逻辑仍成立的仓位，清理长期低质量或重复暴露。`);
  }

  return advices.slice(0, 6);
}

function renderSummary() {
  const cheap = stocks.filter((stock) => getValuation(stock) === "cheap").length;
  const expensive = stocks.filter((stock) => getValuation(stock) === "expensive").length;
  const heat = stocks.length
    ? Math.round(stocks.reduce((sum, stock) => sum + stock.heat, 0) / stocks.length)
    : 0;

  els.totalCount.textContent = stocks.length;
  els.cheapCount.textContent = cheap;
  els.expensiveCount.textContent = expensive;
  els.heatAverage.textContent = heat;
  els.updatedAt.textContent = `最近更新：${new Date().toLocaleTimeString("zh-CN", {
    hour12: false,
  })}`;
}

function renderSnapshotSelect() {
  els.snapshotSelect.innerHTML = "";
  if (!snapshots.length) {
    els.snapshotSelect.innerHTML = `<option value="">暂无快照</option>`;
    return;
  }

  snapshots
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((snapshot) => {
      const option = document.createElement("option");
      option.value = snapshot.id;
      option.textContent = `${snapshot.date} · ${snapshot.analysis.count}只 · ${formatMoney(snapshot.analysis.totalValue)}${snapshot.readonly ? " · 本地文件" : ""}`;
      option.selected = snapshot.id === selectedSnapshotId;
      els.snapshotSelect.appendChild(option);
    });
}

function renderPortfolio(snapshot) {
  if (!snapshot) {
    els.portfolioValue.textContent = "0";
    els.portfolioPnl.textContent = "0";
    els.portfolioCount.textContent = "0";
    els.portfolioTopCategory.textContent = "--";
    els.categoryRows.innerHTML = `<tr><td colspan="4">上传并保存持仓后显示分类。</td></tr>`;
    els.adviceList.innerHTML = `<li>暂无快照。上传持仓截图并保存后生成建议。</li>`;
    return;
  }

  const analysis = analyzePositions(
    snapshot.positions.map((position) => ({
      ...position,
      category: normalizeCategory(position.category, position.name),
    })),
  );
  if (snapshot.analysis?.advices?.length) {
    analysis.advices = snapshot.analysis.advices;
  }
  els.portfolioValue.textContent = formatMoney(analysis.totalValue);
  els.portfolioPnl.textContent = `${analysis.totalPnl >= 0 ? "+" : ""}${formatMoney(analysis.totalPnl)}`;
  els.portfolioPnl.style.color = analysis.totalPnl >= 0 ? "var(--bad)" : "var(--accent)";
  els.portfolioCount.textContent = analysis.count;
  els.portfolioTopCategory.textContent = analysis.topCategory;

  els.categoryRows.innerHTML = analysis.categories
    .map((item) => {
      const isExpanded = expandedCategory === item.category;
      const details = analysis.positions
        .filter((position) => position.category === item.category)
        .map(
          (position) => `
            <tr class="category-detail-row">
              <td>
                <span class="detail-indent">${position.name}</span>
                <br><span class="muted">${formatNumber(position.shares, 0)} 股 · ${formatNumber(position.costPrice || 0, 3)} / ${formatNumber(position.currentPrice || 0, 3)}</span>
              </td>
              <td>${formatMoney(position.marketValue)}</td>
              <td>${formatNumber((position.marketValue / analysis.totalValue) * 100, 2)}%</td>
              <td class="${position.pnl >= 0 ? "num-up" : "num-down"}">${position.pnl >= 0 ? "+" : ""}${formatMoney(position.pnl)}</td>
            </tr>
          `,
        )
        .join("");

      return `
        <tr class="category-row ${isExpanded ? "expanded" : ""}" data-category="${item.category}">
          <td>
            <strong>${item.category}</strong><br><span class="muted">${item.count} 个标的</span>
          </td>
          <td>${formatMoney(item.marketValue)}</td>
          <td>${formatNumber(item.weight * 100, 2)}%</td>
          <td class="${item.pnl >= 0 ? "num-up" : "num-down"}">${item.pnl >= 0 ? "+" : ""}${formatMoney(item.pnl)}</td>
        </tr>
        ${isExpanded ? details : ""}
      `;
    })
    .join("");

  els.adviceList.innerHTML = analysis.advices.map((advice) => `<li>${advice}</li>`).join("");
}

function escapeSvgText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderPnlChart() {
  const datedSnapshots = snapshots
    .filter((snapshot) => snapshot.positions?.length)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!datedSnapshots.length) {
    els.pnlChart.innerHTML = `<p class="empty-state">至少需要一条持仓快照才能显示曲线。</p>`;
    return;
  }

  const chartSnapshots = datedSnapshots.map((snapshot) => ({
    ...snapshot,
    analysis: analyzePositions(
      snapshot.positions.map((position) => ({
        ...position,
        category: normalizeCategory(position.category, position.name),
      })),
    ),
  }));

  const categories = [
    ...new Set(chartSnapshots.flatMap((snapshot) => snapshot.analysis.categories.map((item) => item.category))),
  ]
    .filter((category) => category !== "其他")
    .sort((a, b) => {
      const latest = chartSnapshots[chartSnapshots.length - 1];
      const av = latest.analysis.categories.find((item) => item.category === a)?.marketValue || 0;
      const bv = latest.analysis.categories.find((item) => item.category === b)?.marketValue || 0;
      return bv - av;
    });

  const series = [
    {
      category: "总盈亏",
      color: categoryColors["总盈亏"],
      points: chartSnapshots.map((snapshot) => ({
        date: snapshot.date,
        pnl: snapshot.analysis.totalPnl || 0,
      })),
    },
    ...categories.map((category) => ({
      category,
      color: categoryColors[category] || categoryColors["其他"],
      points: chartSnapshots.map((snapshot) => ({
        date: snapshot.date,
        pnl: snapshot.analysis.categories.find((item) => item.category === category)?.pnl || 0,
      })),
    })),
  ];

  const allValues = series.flatMap((item) => item.points.map((point) => point.pnl));
  const rawMin = Math.min(...allValues, 0);
  const rawMax = Math.max(...allValues, 0);
  const padding = Math.max((rawMax - rawMin) * 0.12, 1000);
  const minY = rawMin - padding;
  const maxY = rawMax + padding;
  const width = 980;
  const height = 340;
  const margin = { top: 26, right: 24, bottom: 52, left: 86 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const xStep = chartSnapshots.length > 1 ? chartWidth / (chartSnapshots.length - 1) : 0;
  const yScale = (value) => margin.top + ((maxY - value) / (maxY - minY || 1)) * chartHeight;
  const xScale = (index) => margin.left + (chartSnapshots.length > 1 ? index * xStep : chartWidth / 2);
  const ticks = Array.from({ length: 5 }, (_, index) => minY + ((maxY - minY) * index) / 4);
  const zeroY = yScale(0);

  const grid = ticks
    .map((tick) => {
      const y = yScale(tick);
      return `
        <line class="chart-grid" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line>
        <text class="chart-axis-label" x="${margin.left - 10}" y="${y + 4}" text-anchor="end">${formatMoney(tick)}</text>
      `;
    })
    .join("");

  const xLabels = chartSnapshots
    .map((snapshot, index) => {
      const x = xScale(index);
      return `
        <text class="chart-axis-label" x="${x}" y="${height - 18}" text-anchor="middle">${snapshot.date.slice(5)}</text>
      `;
    })
    .join("");

  const lines = series
    .map((item) => {
      const path = item.points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${xScale(index).toFixed(2)} ${yScale(point.pnl).toFixed(2)}`)
        .join(" ");
      const dots = item.points
        .map((point, index) => {
          const x = xScale(index);
          const y = yScale(point.pnl);
          return `
            <g>
              <circle class="chart-dot" cx="${x}" cy="${y}" r="4" fill="${item.color}"></circle>
              <title>${escapeSvgText(`${item.category} ${point.date}: ${point.pnl >= 0 ? "+" : ""}${formatMoney(point.pnl)}`)}</title>
            </g>
          `;
        })
        .join("");
      return `
        <path class="chart-line" d="${path}" stroke="${item.color}"></path>
        ${dots}
      `;
    })
    .join("");

  const legend = series
    .map(
      (item) => `
        <span class="chart-legend-item">
          <i style="background:${item.color}"></i>${item.category}
        </span>
      `,
    )
    .join("");

  els.pnlChart.innerHTML = `
    <div class="chart-scroll">
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="各类资产浮盈亏趋势">
        <rect class="chart-bg" x="0" y="0" width="${width}" height="${height}"></rect>
        ${grid}
        <line class="chart-zero" x1="${margin.left}" y1="${zeroY}" x2="${width - margin.right}" y2="${zeroY}"></line>
        <line class="chart-axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"></line>
        <line class="chart-axis" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"></line>
        ${xLabels}
        ${lines}
      </svg>
    </div>
    <div class="chart-legend">${legend}</div>
  `;
}

function renderParsedRows() {
  if (!parsedPositions.length) {
    els.parsedRows.innerHTML = `<tr><td colspan="6">解析后在这里校验。</td></tr>`;
    return;
  }

  els.parsedRows.innerHTML = parsedPositions
    .map(
      (position) => `
        <tr>
          <td>${position.name}</td>
          <td>${position.category}</td>
          <td>${formatMoney(position.marketValue)}</td>
          <td class="${position.pnl >= 0 ? "num-up" : "num-down"}">${position.pnl >= 0 ? "+" : ""}${formatMoney(position.pnl)}</td>
          <td>${formatNumber(position.shares, 0)}</td>
          <td>${formatNumber(position.costPrice, 3)} / ${formatNumber(position.currentPrice, 3)}</td>
        </tr>
      `,
    )
    .join("");
}

function setParseStatus(message, type = "info") {
  els.parseStatus.textContent = message;
  els.parseStatus.dataset.type = type;
}

function positionsToText(positions) {
  return positions
    .map((position) =>
      [
        position.name,
        formatNumber(position.marketValue, 2).replace(/,/g, ""),
        formatNumber(position.pnl, 2).replace(/,/g, ""),
        formatNumber(position.shares, 0).replace(/,/g, ""),
        formatNumber(position.costPrice || 0, 3).replace(/,/g, ""),
        formatNumber(position.currentPrice || 0, 3).replace(/,/g, ""),
        position.category || inferCategory(position.name),
      ].join(" "),
    )
    .join("\n");
}

async function recognizePositionsWithGpt() {
  const imageFile = els.snapshotImage.files?.[0];
  if (!imageFile) {
    setParseStatus("请先上传持仓图片，再使用 AI 识别。", "warning");
    return;
  }

  els.gptRecognizeBtn.disabled = true;
  setParseStatus("正在调用 AI 识别持仓图片，稍等一下。", "info");

  try {
    const response = await fetch("http://127.0.0.1:5173/api/recognize-positions", {
      method: "POST",
      body: (() => {
        const form = new FormData();
        form.append("image", imageFile);
        return form;
      })(),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "AI 识别失败，请检查本地服务和 API Key。");
    }

    parsedPositions = (payload.positions || [])
      .map((position) => ({
        name: position.name || "",
        category: normalizeCategory(position.category, position.name || ""),
        marketValue: Number(position.marketValue || 0),
        pnl: Number(position.pnl || 0),
        shares: Number(position.shares || 0),
        costPrice: Number(position.costPrice || 0),
        currentPrice: Number(position.currentPrice || 0),
      }))
      .filter((position) => position.name && position.marketValue > 0);

    els.positionText.value = positionsToText(parsedPositions);
    renderParsedRows();
    setParseStatus(`AI 已识别 ${parsedPositions.length} 条持仓，请核对后保存到数据库。`, "success");
  } catch (error) {
    setParseStatus(error.message, "warning");
  } finally {
    els.gptRecognizeBtn.disabled = false;
  }
}

async function refreshSnapshots() {
  const dbSnapshots = await dbGetAllSnapshots();
  snapshots = [...fileSnapshots, ...dbSnapshots];
  if (!selectedSnapshotId && snapshots.length) {
    selectedSnapshotId = snapshots.slice().sort((a, b) => b.date.localeCompare(a.date))[0].id;
  }
  renderSnapshotSelect();
  renderPortfolio(snapshots.find((snapshot) => snapshot.id === selectedSnapshotId));
  renderPnlChart();
}

async function loadFileSnapshots() {
  try {
    const response = await fetch("data/portfolio-snapshots.json", {
      cache: "no-store",
    });
    if (!response.ok) return;

    const payload = await response.json();
    fileSnapshots = Array.isArray(payload) ? payload.map(normalizeFileSnapshot) : [];
  } catch (error) {
    console.warn("Failed to load local portfolio snapshots", error);
    fileSnapshots = [];
  }
}

function renderRows() {
  const visibleStocks = getFilteredStocks();
  els.stockRows.innerHTML = "";

  if (!visibleStocks.length) {
    els.stockRows.innerHTML = `<tr><td colspan="9">没有匹配的股票。</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  visibleStocks.forEach((stock) => {
    const valuation = getValuation(stock);
    const score = scoreStock(stock);
    const row = document.createElement("tr");
    row.className = stock.symbol === selectedSymbol ? "active" : "";
    row.innerHTML = `
      <td>
        <div class="stock-name">
          <strong>${stock.name}</strong>
          <span>${stock.symbol} · ${stock.sector}</span>
        </div>
      </td>
      <td>${formatNumber(stock.price, 2)}</td>
      <td>${formatNumber(stock.pe)}</td>
      <td>${formatNumber(stock.pb)}</td>
      <td>${formatNumber(stock.roe)}%</td>
      <td>
        <div class="bar ${stock.percentile <= 30 ? "good" : stock.percentile >= 70 ? "bad" : "warn"}">
          <span style="width: ${stock.percentile}%"></span>
        </div>
        ${stock.percentile}%
      </td>
      <td>
        <div class="bar ${stock.heat >= 75 ? "bad" : stock.heat >= 50 ? "warn" : "good"}">
          <span style="width: ${stock.heat}%"></span>
        </div>
        ${stock.heat}
      </td>
      <td><span class="pill ${getPillClass(valuation)}">${getValuationLabel(valuation)}</span></td>
      <td><strong>${score}</strong></td>
    `;
    row.addEventListener("click", () => {
      selectedSymbol = stock.symbol;
      render();
    });
    fragment.appendChild(row);
  });

  els.stockRows.appendChild(fragment);
}

function getReasons(stock) {
  const valuation = getValuation(stock);
  const reasons = [];

  if (valuation === "cheap") reasons.push("估值分位处于偏低区域，PE/PB 未明显突破历史中枢。");
  if (valuation === "fair") reasons.push("估值、热度和质量指标大致平衡，适合继续观察边际变化。");
  if (valuation === "expensive") reasons.push("估值分位或估值倍数偏高，需要更强增长来消化预期。");

  if (stock.roe >= 18) reasons.push("ROE 表现较强，说明资产盈利效率较好。");
  if (stock.growth >= 10) reasons.push("收入增速仍有支撑，基本面动能没有明显熄火。");
  if (stock.heat >= 80) reasons.push("市场关注度较高，短期价格更容易受情绪影响。");

  return reasons.slice(0, 4);
}

function getRisks(stock) {
  const risks = [];

  if (stock.percentile >= 70) risks.push("历史估值分位偏高，安全边际不足。");
  if (stock.pb >= 8) risks.push("PB 较高，资产端定价已经包含较多乐观预期。");
  if (stock.growth < 5) risks.push("增长偏慢，估值修复可能需要更长时间。");
  if (stock.debt >= 40) risks.push("负债水平偏高，需关注现金流和融资环境。");
  if (!risks.length) risks.push("暂无突出风险，但仍需跟踪业绩、行业景气和政策变化。");

  return risks;
}

function renderDetail() {
  const stock = stocks.find((item) => item.symbol === selectedSymbol) || stocks[0];
  if (!stock) {
    els.detailPanel.innerHTML = `<p class="empty-state">暂无股票。点击添加股票开始监听。</p>`;
    return;
  }

  selectedSymbol = stock.symbol;
  const valuation = getValuation(stock);
  const score = scoreStock(stock);
  els.detailPanel.innerHTML = `
    <h2>${stock.name}</h2>
    <p class="detail-meta">${stock.symbol} · ${stock.sector}</p>
    <div class="score-box">
      <div class="score-ring" style="--score: ${score}%">${score}</div>
      <div>
        <span class="pill ${getPillClass(valuation)}">${getValuationLabel(valuation)}</span>
        <p class="empty-state">综合分由估值分位、ROE、收入增速、利润率、负债和市场热度加权得到。</p>
      </div>
    </div>
    <h3>判断依据</h3>
    <ul class="reason-list">${getReasons(stock).map((item) => `<li>${item}</li>`).join("")}</ul>
    <h3>风险信号</h3>
    <ul class="risk-list">${getRisks(stock).map((item) => `<li>${item}</li>`).join("")}</ul>
    <div class="mini-grid">
      <div><span>毛利率</span><strong>${formatNumber(stock.margin)}%</strong></div>
      <div><span>资产负债率</span><strong>${formatNumber(stock.debt)}%</strong></div>
      <div><span>收入增速</span><strong>${formatNumber(stock.growth)}%</strong></div>
      <div><span>市场热度</span><strong>${stock.heat}/100</strong></div>
    </div>
  `;
}

function render() {
  renderSummary();
  renderRows();
  renderDetail();
}

function refreshData() {
  stocks = stocks.map((stock) => {
    const drift = (Math.random() - 0.48) * 0.018;
    const heatMove = Math.round((Math.random() - 0.45) * 6);
    return {
      ...stock,
      price: Number((stock.price * (1 + drift)).toFixed(2)),
      heat: clamp(stock.heat + heatMove, 0, 100),
    };
  });
  saveStocks();
  render();
}

function setAutoRefresh(enabled) {
  if (refreshTimer) window.clearInterval(refreshTimer);
  refreshTimer = enabled ? window.setInterval(refreshData, 15000) : null;
}

els.searchInput.addEventListener("input", renderRows);
els.valuationFilter.addEventListener("change", renderRows);
els.sortSelect.addEventListener("change", renderRows);
els.refreshBtn.addEventListener("click", refreshData);
els.addStockBtn.addEventListener("click", () => els.stockDialog.showModal());
els.autoRefresh.addEventListener("change", (event) => setAutoRefresh(event.target.checked));
els.snapshotBtn.addEventListener("click", () => {
  parsedPositions = [];
  snapshotImageDataUrl = "";
  els.snapshotDate.value = today();
  els.snapshotImage.value = "";
  els.positionText.value = "";
  els.snapshotPreview.removeAttribute("src");
  els.snapshotPreview.style.display = "none";
  setParseStatus("上传图片会保存原图；解析需要粘贴识别文本，或先使用“填入截图示例”验证流程。");
  renderParsedRows();
  els.snapshotDialog.showModal();
});
els.snapshotSelect.addEventListener("change", (event) => {
  selectedSnapshotId = event.target.value;
  expandedCategory = "";
  renderPortfolio(snapshots.find((snapshot) => snapshot.id === selectedSnapshotId));
});
els.categoryRows.addEventListener("click", (event) => {
  const row = event.target.closest(".category-row");
  if (!row) return;

  const category = row.dataset.category;
  expandedCategory = expandedCategory === category ? "" : category;
  renderPortfolio(snapshots.find((snapshot) => snapshot.id === selectedSnapshotId));
});
els.loadSampleBtn.addEventListener("click", () => {
  els.positionText.value = samplePositionText;
  parsedPositions = parsePositionText(els.positionText.value);
  setParseStatus(`已解析 ${parsedPositions.length} 条示例持仓，可以保存到数据库。`, "success");
  renderParsedRows();
});
els.gptRecognizeBtn.addEventListener("click", recognizePositionsWithGpt);
els.parsePositionsBtn.addEventListener("click", () => {
  if (!els.positionText.value.trim()) {
    parsedPositions = [];
    renderParsedRows();
    setParseStatus("请先把 OCR 结果或手动整理的持仓文本粘贴到文本框。当前纯前端版本会保存图片，但不会直接从图片识别文字。", "warning");
    return;
  }

  parsedPositions = parsePositionText(els.positionText.value);
  if (!parsedPositions.length) {
    setParseStatus("没有解析到持仓。推荐格式：名称 市值 浮盈亏 持仓 成本 现价；每只股票一行。", "warning");
  } else {
    setParseStatus(`已解析 ${parsedPositions.length} 条持仓，请核对后保存到数据库。`, "success");
  }
  renderParsedRows();
});
els.snapshotImage.addEventListener("change", () => {
  const file = els.snapshotImage.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    snapshotImageDataUrl = reader.result;
    els.snapshotPreview.src = snapshotImageDataUrl;
    els.snapshotPreview.style.display = "block";
  });
  reader.readAsDataURL(file);
});

els.stockForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(els.stockForm);
  const stock = Object.fromEntries(form.entries());
  const normalized = {
    symbol: stock.symbol.trim(),
    name: stock.name.trim(),
    sector: stock.sector.trim(),
    price: Number(stock.price),
    pe: Number(stock.pe),
    pb: Number(stock.pb),
    roe: Number(stock.roe),
    percentile: Number(stock.percentile),
    heat: Number(stock.heat),
    growth: Number(stock.growth),
    margin: 25,
    debt: 30,
  };

  const existingIndex = stocks.findIndex((item) => item.symbol === normalized.symbol);
  if (existingIndex >= 0) stocks[existingIndex] = normalized;
  else stocks.push(normalized);

  selectedSymbol = normalized.symbol;
  saveStocks();
  els.stockForm.reset();
  els.stockDialog.close();
  render();
});

els.snapshotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!snapshotImageDataUrl) {
    window.alert("请先上传持仓图片。");
    return;
  }

  if (!parsedPositions.length) {
    parsedPositions = parsePositionText(els.positionText.value);
  }

  if (!parsedPositions.length) {
    window.alert("没有解析到持仓，请按“名称 市值 浮盈亏 持仓 成本 现价”的格式整理后再保存。");
    return;
  }

  const snapshot = {
    id: `${els.snapshotDate.value}-${Date.now()}`,
    date: els.snapshotDate.value,
    imageDataUrl: snapshotImageDataUrl,
    rawText: els.positionText.value,
    positions: parsedPositions,
    analysis: analyzePositions(parsedPositions),
    createdAt: new Date().toISOString(),
  };

  setParseStatus("正在生成 AI 持仓建议。", "info");
  try {
    const response = await fetch("http://127.0.0.1:5173/api/analyze-portfolio", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        positions: snapshot.positions,
        analysis: snapshot.analysis,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && Array.isArray(payload.advices) && payload.advices.length) {
      snapshot.analysis.advices = payload.advices;
    } else if (!response.ok) {
      setParseStatus(payload.error || "AI 建议生成失败，已保留本地规则建议。", "warning");
    }
  } catch (error) {
    setParseStatus(`AI 建议生成失败，已保留本地规则建议：${error.message}`, "warning");
  }

  await dbSaveSnapshot(snapshot);
  selectedSnapshotId = snapshot.id;
  els.snapshotDialog.close();
  await refreshSnapshots();
});

async function init() {
  render();
  setAutoRefresh(els.autoRefresh.checked);
  els.snapshotDate.value = today();

  try {
    await loadFileSnapshots();
    snapshotDb = await openSnapshotDb();
    await refreshSnapshots();
  } catch (error) {
    console.error(error);
    els.adviceList.innerHTML = `<li>本地数据库初始化失败，请确认浏览器允许 IndexedDB。</li>`;
  }
}

init();
