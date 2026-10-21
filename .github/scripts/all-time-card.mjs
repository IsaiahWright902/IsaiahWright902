import { mkdirSync, writeFileSync } from "node:fs";

const token = process.env.GITHUB_TOKEN;
const login = process.env.USERNAME;
const outDir = "generated";

async function gql(query) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user;
}

const { createdAt } = await gql(`{ user(login: "${login}") { createdAt } }`);
const firstYear = new Date(createdAt).getUTCFullYear();
const now = new Date();

const years = [];
for (let y = firstYear; y <= now.getUTCFullYear(); y++) {
  const to = y === now.getUTCFullYear() ? now.toISOString() : `${y}-12-31T23:59:59Z`;
  const user = await gql(
    `{ user(login: "${login}") { contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${to}") { contributionCalendar { totalContributions } } } }`
  );
  years.push({ year: y, count: user.contributionsCollection.contributionCalendar.totalContributions });
}

const total = years.reduce((sum, y) => sum + y.count, 0);
const max = Math.max(...years.map((y) => y.count), 1);

const W = 840;
const H = 230;
const chartX = 330;
const chartW = W - chartX - 40;
const chartTop = 60;
const chartBottom = 175;
const slot = chartW / years.length;
const barW = Math.min(slot * 0.6, 44);

const bars = years
  .map((y, i) => {
    const h = Math.max((y.count / max) * (chartBottom - chartTop), 2);
    const x = chartX + i * slot + (slot - barW) / 2;
    const cx = x + barW / 2;
    return `<rect x="${x.toFixed(1)}" y="${(chartBottom - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="url(#bar)"/>
  <text x="${cx.toFixed(1)}" y="${(chartBottom - h - 8).toFixed(1)}" text-anchor="middle" class="val">${y.count.toLocaleString("en-US")}</text>
  <text x="${cx.toFixed(1)}" y="${chartBottom + 20}" text-anchor="middle" class="yr">${y.year}</text>`;
  })
  .join("\n  ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${total.toLocaleString("en-US")} GitHub contributions since ${firstYear}">
  <defs>
    <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#29b6f6"/>
      <stop offset="1" stop-color="#1e4fd8"/>
    </linearGradient>
  </defs>
  <style>
    text { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; fill: #ffffff; }
    .big { font-size: 64px; font-weight: 700; fill: #ffc03c; }
    .label { font-size: 18px; }
    .sub { font-size: 14px; fill: #8b949e; }
    .head { font-size: 13px; fill: #8b949e; letter-spacing: 0.08em; }
    .val { font-size: 12px; fill: #c9d1d9; }
    .yr { font-size: 12px; fill: #8b949e; }
  </style>
  <rect width="${W}" height="${H}" rx="10" fill="#03030f"/>
  <text x="40" y="100" class="big">${total.toLocaleString("en-US")}</text>
  <text x="40" y="132" class="label">contributions on GitHub</text>
  <text x="40" y="158" class="sub">all time, since ${firstYear}</text>
  <text x="${chartX}" y="36" class="head">CONTRIBUTIONS PER YEAR</text>
  <line x1="${chartX}" y1="${chartBottom}" x2="${W - 40}" y2="${chartBottom}" stroke="#30363d"/>
  ${bars}
</svg>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/all-time-card.svg`, svg);
console.log(`${total} contributions across ${years.length} years`);
