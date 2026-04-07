// ─── Constants ───────────────────────────────────────────────────────────────

const ONE_MINUTE = 60_000;
const TEN_MINUTES = 600_000;
const JOD_RATE = 0.71;
const OZ_TO_GRAM = 31.1035;

const API = {
  currentPrice: (symbol, currency) =>
    `https://api.gold-api.com/price/${symbol}/${currency}`,
  priceHistory: (symbol, groupBy, start, end) =>
    `https://api.gold-api.com/history?symbol=${symbol}&groupBy=${groupBy}&startTimestamp=${start}&endTimestamp=${end}`,
  priceHistoryKey:
    "1db841db85376b834cf4cf079a180c7e88abcc10f2893648c9f12dc13273d4f3",
  news: "https://newsdata.io/api/1/latest?apikey=pub_8cdfe34522554af9bab8604d4a8294f9&q=economy OR politics&language=en",
};

const CACHE_KEYS = {
  currentPrice: "currentPrice",
  currentPriceLastFetch: "currentPriceLastFetched",
  currentPriceUpdatedAt: "currentPriceUpdatedAt",
  priceHistory: "priceHistory",
  priceHistoryLastFetch: "priceHistoryLastFetched",
  news: "news",
  newsTime: "newsTime",
};

// ─── Cache helpers ────────────────────────────────────────────────────────────

const cache = {
  get: (key) => localStorage.getItem(key),
  set: (key, value) =>
    localStorage.setItem(
      key,
      typeof value === "object" ? JSON.stringify(value) : value,
    ),
  getJSON: (key) => {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  isStale: (key, ttl) => {
    const t = parseInt(localStorage.getItem(key));
    return !t || Date.now() - t >= ttl;
  },
};

// ─── Relative time ────────────────────────────────────────────────────────────

function relativeTime(fromTimestamp) {
  const elapsed = Date.now() - parseInt(fromTimestamp);
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  return seconds < 60
    ? rtf.format(-seconds, "second")
    : rtf.format(-minutes, "minute");
}

// ─── Price difference display ─────────────────────────────────────────────────

function displayDiff(newPrice, prevPrice) {
  const el = document.getElementById("changeOfPrice");
  const diff = newPrice - prevPrice;
  const percent = ((diff / prevPrice) * 100).toFixed(2);
  const rising = diff > 0;

  Object.assign(el.style, {
    color: rising ? "#4ade80" : "#f87171",
    backgroundColor: rising ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
    border: rising
      ? "1px solid rgba(74,222,128,0.25)"
      : "1px solid rgba(248,113,113,0.25)",
    borderRadius: "20px",
    padding: "5px 14px",
    margin: "4px 0",
    fontSize: "13px",
    letterSpacing: "0.06em",
  });

  el.innerText = rising
    ? `▲ ${percent}%  (+${Number(diff).toFixed(2)})`
    : `▼ ${percent}%  (${Number(diff).toFixed(2)})`;
}

function updateDiffFromHistory(historyArray) {
  if (!Array.isArray(historyArray) || historyArray.length < 2) return;
  const len = historyArray.length;
  const newPrice = historyArray[len - 1]?.max_price;
  const prevPrice = historyArray[len - 2]?.max_price;
  if (newPrice == null || prevPrice == null) return;
  displayDiff(newPrice, prevPrice);
}

// ─── Current Price ────────────────────────────────────────────────────────────

function renderCurrentPrice() {
  const price = cache.get(CACHE_KEYS.currentPrice);
  if (!price) return;

  const timeAgo = relativeTime(cache.get(CACHE_KEYS.currentPriceLastFetch));
  const el = document.getElementById("currentPriceCard");

  el.innerHTML = `${Number(price).toFixed(2)} <small>$ / oz<br>Updated ${timeAgo}</small>`;
}

async function fetchCurrentPrice() {
  if (!cache.isStale(CACHE_KEYS.currentPriceLastFetch, ONE_MINUTE)) {
    console.log("Using cached current price");
    renderCurrentPrice();
    updateDiffFromHistory(cache.getJSON(CACHE_KEYS.priceHistory));
    return;
  }

  try {
    const res = await fetch(API.currentPrice("XAU", "USD"));
    const data = await res.json();

    cache.set(CACHE_KEYS.currentPrice, data.price);
    cache.set(CACHE_KEYS.currentPriceUpdatedAt, data.updatedAt);
    cache.set(CACHE_KEYS.currentPriceLastFetch, Date.now());

    renderCurrentPrice();
    updateDiffFromHistory(cache.getJSON(CACHE_KEYS.priceHistory));
  } catch (err) {
    console.error("Error fetching current price:", err);
  }
}

// ─── Price History ────────────────────────────────────────────────────────────

async function fetchPriceHistory() {
  if (!cache.isStale(CACHE_KEYS.priceHistoryLastFetch, TEN_MINUTES)) {
    console.log("Using cached price history");
    return;
  }

  const endTimestamp = Math.floor(Date.now() / 1000);
  const startTimestamp = endTimestamp - 20 * 24 * 60 * 60;

  try {
    const res = await fetch(
      API.priceHistory("XAU", "day", startTimestamp, endTimestamp),
      {
        headers: {
          "x-api-key": API.priceHistoryKey,
          "Content-Type": "application/json",
        },
      },
    );
    const data = await res.json();

    cache.set(CACHE_KEYS.priceHistory, data);
    cache.set(CACHE_KEYS.priceHistoryLastFetch, Date.now());
    console.log("Fetched fresh price history");
  } catch (err) {
    console.error("Error fetching price history:", err);
  }
}

// ─── Calculated prices ────────────────────────────────────────────────────────

function buildPrices() {
  const currentPrice = Number(cache.get(CACHE_KEYS.currentPrice));
  const pricePerGram = currentPrice / OZ_TO_GRAM;
  const priceHistoryUS = cache.getJSON(CACHE_KEYS.priceHistory);
  const priceHistoryJO = priceHistoryUS.map(({ day, max_price }) => ({
    day,
    max_price: Number(max_price) * JOD_RATE,
  }));

  const fmt = (val, sym) => `${val.toFixed(2)} ${sym}`;

  return {
    USD: {
      current: fmt(currentPrice, "$"),
      priceHistory: priceHistoryUS,
      per24k: fmt(pricePerGram, "$"),
      per21k: fmt(pricePerGram * (21 / 24), "$"),
      per18k: fmt(pricePerGram * (18 / 24), "$"),
      bar: fmt(pricePerGram * 10, "$"),
      rashadi: fmt(pricePerGram * 7.216 * (21.6 / 24), "$"),
      english: fmt(pricePerGram * 7.9881 * (22 / 24), "$"),
    },
    JOD: {
      current: fmt(currentPrice * JOD_RATE, "JD"),
      priceHistory: priceHistoryJO,
      per24k: fmt(pricePerGram * JOD_RATE, "JD"),
      per21k: fmt(pricePerGram * (21 / 24) * JOD_RATE, "JD"),
      per18k: fmt(pricePerGram * (18 / 24) * JOD_RATE, "JD"),
      bar: fmt(pricePerGram * 10 * JOD_RATE, "JD"),
      rashadi: fmt(pricePerGram * 7.216 * (21.6 / 24) * JOD_RATE, "JD"),
      english: fmt(pricePerGram * 7.9881 * (22 / 24) * JOD_RATE, "JD"),
    },
  };
}

// fill page with prices
function fillPrices(prices, currency = "USD") {
  const p = prices[currency];
  document.getElementById("barPrice").innerHTML =
    `${p.bar} <br><small>24 karat - 10g</small>`;
  document.getElementById("rashadiPrice").innerHTML =
    `${p.rashadi} <br><small>21.6 karat - 7.216g</small>`;
  document.getElementById("EnglishPrice").innerHTML =
    `${p.english} <br><small>22 karat - 7.9881g</small>`;
  document.getElementById("twentyFourPrice").innerHTML =
    `${p.per24k} <small>/ g</small>`;
  document.getElementById("twentyOnePrice").innerHTML =
    `${p.per21k} <small>/ g</small>`;
  document.getElementById("eighteenPrice").innerHTML =
    `${p.per18k} <small>/ g</small>`;
}

// ─── Chart.js instance ────────────────────────────────────────────────────────

let chartInstance = null; // holds the single Chart.js instance

/**
 * Build the Chart.js nested config and render (or update) the chart.
 *
 * Config breakdown
 * ──────────────────────────────────────────────────────────────────
 * type: "line"
 *
 * data
 *   datasets[0]           — max-price area line
 *
 * options
 *   responsive: true      — let Chart.js resize with the canvas wrap
 *   maintainAspectRatio: false — height controlled by CSS, not ratio
 *
 *   interaction           — unified cross-hair tooltip
 *
 *   plugins
 *     legend              — hidden (single series)
 *     tooltip             — custom dark-gold themed tooltip
 *       callbacks
 *         title           — format date label
 *         label           — format price value
 *
 *   scales
 *     x (time scale)
 *       type: "time"      — parses ISO date strings automatically
 *       time.unit         — "day"
 *       ticks             — styled to match design
 *       grid              — hidden vertical lines
 *     y (linear scale)
 *       min / max         — ±200 buffer auto-computed
 *       ticks             — styled
 *       grid              — dashed horizontal lines
 *
 *   elements
 *     line                — smooth cubic tension, gold stroke
 *     point               — small gold circles, larger on hover
 */
function renderChart(historyData, currency = "USD") {
  // API returns newest-first; reverse to chronological order
  const sorted = [...historyData].reverse();

  // Chart.js time-scale expects { x: ISO-string, y: number }
  const dataPoints = sorted.map(({ day, max_price }) => ({
    x: day,
    y: Number(max_price).toFixed(2),
  }));

  const currencySymbol = currency === "USD" ? "$" : "JD";

  // ── Gradient fill ──────────────────────────────────────────────
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(
    0,
    0,
    0,
    canvas.parentElement.clientHeight || 340,
  );
  grad.addColorStop(0, "rgba(212, 136, 43, 0.30)");
  grad.addColorStop(0.6, "rgba(201, 168, 76, 0.08)");
  grad.addColorStop(1, "rgba(201, 168, 76, 0.00)");

  // ── Update chart title ─────────────────────────────────────────
  document.getElementById("chartTitle").textContent =
    `Prices the past 20 days — ${currency} / oz`;

  // ── Dataset definition ────────────────────────────────────────
  const dataset = {
    label: `Gold Price (${currency}/oz)`,
    data: dataPoints,
    // Line styling
    borderColor: "#ced04f",
    borderWidth: 2.5,
    tension: 0.4, // cubic bezier smoothing
    // Area fill
    fill: true,
    backgroundColor: grad,
    // Point styling
    pointRadius: 4,
    pointHoverRadius: 7,
    pointBackgroundColor: "#ced04f",
    pointBorderColor: "#080608",
    pointBorderWidth: 2,
    pointHoverBackgroundColor: "#f5e49c",
    pointHoverBorderColor: "#080608",
    pointHoverBorderWidth: 2,
  };

  // ── Full Chart.js nested config object ────────────────────────
  const config = {
    type: "line",

    data: {
      datasets: [dataset],
    },

    options: {
      responsive: true,
      maintainAspectRatio: false, // height governed by .chart-canvas-wrap CSS

      interaction: {
        mode: "index", // snap tooltip to nearest x-index
        intersect: false,
      },

      plugins: {
        legend: {
          display: false, // single series — no legend needed
        },

        tooltip: {
          enabled: true,
          backgroundColor: "#1a1720",
          borderColor: "rgba(201,168,76,0.35)",
          borderWidth: 1,
          padding: { x: 14, y: 10 },
          titleColor: "#8a6e2f",
          titleFont: {
            family: "'Montserrat', sans-serif",
            size: 10,
            weight: "600",
          },
          titleSpacing: 4,
          bodyColor: "#e8cc80",
          bodyFont: {
            family: "'Cormorant Garamond', Georgia, serif",
            size: 17,
            weight: "600",
          },
          bodySpacing: 4,
          cornerRadius: 10,
          displayColors: false,
          caretSize: 5,

          callbacks: {
            title(items) {
              // Format ISO date → "Apr 12"
              const raw = items[0]?.parsed?.x;
              if (!raw) return "";
              return new Date(raw).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
            },
            label(item) {
              const val = Number(item.parsed.y).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
              return `${currencySymbol} ${val} / oz`;
            },
          },
        },
      }, // end plugins

      scales: {
        x: {
          type: "time",
          time: {
            unit: "day",
            tooltipFormat: "yyyy-MM-dd",
            displayFormats: {
              day: "MMM d",
            },
          },
          grid: {
            display: false, // no vertical grid lines
          },
          border: {
            color: "rgba(65,68,80,0.5)",
          },
          ticks: {
            color: "#6b7280",
            font: { family: "'Montserrat', sans-serif", size: 10 },
            maxRotation: 0,
            maxTicksLimit: 8,
          },
        },

        y: {
          position: "left",
          grid: {
            color: "rgba(65,68,80,0.4)",
            lineWidth: 1,
          },
          border: {
            dash: [4, 4],
            color: "transparent",
          },
          ticks: {
            color: "#6b7280",
            font: { family: "'Montserrat', sans-serif", size: 10 },
            // Auto-pad min/max by ±200 then round to nearest 100
            callback(value) {
              return value.toLocaleString("en-US");
            },
          },
          // Add breathing room around the data range
          afterDataLimits(scale) {
            const padding = 200;
            scale.min = Math.floor((scale.min - padding) / 100) * 100;
            scale.max = Math.ceil((scale.max + padding) / 100) * 100;
          },
        },
      }, // end scales

      elements: {
        line: {
          borderCapStyle: "round",
          borderJoinStyle: "round",
        },
      },
    }, // end options
  }; // end config

  // ── Create or update ──────────────────────────────────────────
  if (chartInstance) {
    // Swap dataset and re-render without destroying the instance
    chartInstance.data.datasets[0] = dataset;
    chartInstance.options = config.options;
    chartInstance.update("active");
  } else {
    chartInstance = new Chart(ctx, config);
  }
}

// ─── Currency switcher ────────────────────────────────────────────────────────

function switchCurrency(currency) {
  const prices = buildPrices();
  const timeAgo = relativeTime(cache.get(CACHE_KEYS.currentPriceLastFetch));

  const priceCard = document.getElementById("currentPriceCard");
  const usBtnEl = document.getElementById("usCurrency");
  const joBtnEl = document.getElementById("joCurrency");
  const isUSD = currency === "USD";

  usBtnEl.classList.toggle("clicked", isUSD);
  joBtnEl.classList.toggle("clicked", !isUSD);

  priceCard.innerHTML = `${prices[currency].current} <small>/ oz<br>Updated ${timeAgo}</small>`;

  const hist = prices[currency].priceHistory;
  updateDiffFromHistory(hist);
  fillPrices(prices, currency);
  renderChart(hist, currency);
}

document.getElementById("pricecardmain").addEventListener("click", (e) => {
  const { name } = e.target;
  if (name === "usCurrency") switchCurrency("USD");
  else if (name === "joCurrency") switchCurrency("JOD");
});

// ─── News ─────────────────────────────────────────────────────────────────────

function displayNews(articles) {
  const newsEl = document.getElementById("news");
  newsEl.innerHTML = "";

  articles.forEach((article) => {
    const slide = document.createElement("div");
    slide.classList.add("swiper-slide");
    slide.innerHTML = `
      <div class="content">
        <h3><span class="lable">Latest News</span>${article.title}</h3>
      </div>`;

    if (article.link) {
      slide.addEventListener("click", () =>
        window.open(article.link, "_blank"),
      );
    }

    newsEl.appendChild(slide);
  });

  new Swiper(".news-swiper", {
    loop: true,
    slidesPerView: "auto",
    spaceBetween: 0,
    speed: 4000,
    autoplay: { delay: 4000, disableOnInteraction: false },
    pagination: { el: ".swiper-pagination", clickable: true },
    navigation: {
      nextEl: ".swiper-button-next",
      prevEl: ".swiper-button-prev",
    },
  });
}

async function loadNews() {
  const saved = cache.getJSON(CACHE_KEYS.news) || [];
  const lastFetch = parseInt(cache.get(CACHE_KEYS.newsTime));

  if (saved.length > 0 && lastFetch && Date.now() - lastFetch < TEN_MINUTES) {
    displayNews(saved);
    return;
  }

  try {
    const res = await fetch(API.news);
    const data = await res.json();
    const articles = data.results.slice(0, 4);

    cache.set(CACHE_KEYS.news, articles);
    cache.set(CACHE_KEYS.newsTime, Date.now());

    displayNews(articles);
  } catch {
    console.log("News API error – falling back to cache");
    if (saved.length > 0) displayNews(saved);
  }
}

// ─── Scroll animations ────────────────────────────────────────────────────────

function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        target.classList.toggle("scroll-animation", isIntersecting);
      });
    },
    { threshold: 0.25 },
  );

  document.querySelectorAll(".animation").forEach((el) => observer.observe(el));
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function initAuth() {
  const authLink = document.getElementById("authLink");
  const user = sessionStorage.getItem("currentUser");

  if (user) {
    authLink.innerText = "Logout";
    authLink.addEventListener("click", (e) => {
      e.preventDefault();
      sessionStorage.removeItem("currentUser");
      window.location.href = "../Login and Register Pages/Login.html";
    });
  } else {
    authLink.innerText = "Login";
    authLink.href = "../Login and Register Pages/Login.html";
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function init() {
  initAuth();
  initScrollAnimations();
  loadNews();

  // History must resolve first so updateDiffFromHistory has data available
  await fetchPriceHistory();
  await fetchCurrentPrice(); // safe to call now — history is in cache

  // Initial render after data is ready
  const history = cache.getJSON(CACHE_KEYS.priceHistory);
  if (history) {
    fillPrices(buildPrices());
    renderChart(history); // Chart.js render
  }

  // Poll every minute / 10 minutes
  setInterval(fetchCurrentPrice, ONE_MINUTE);
  setInterval(fetchPriceHistory, TEN_MINUTES);
}

init();
