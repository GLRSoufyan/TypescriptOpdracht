// ── Types ────────────────────────────────────────────────────────────────────

interface Upgrade {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  baseCps: number;        // cookies per second when owned
  baseClickBonus: number; // bonus per click when owned
  count: number;
  emoji: string;
}

interface Milestone {
  threshold: number;
  label: string;
  unlocked: boolean;
}

// ── State ────────────────────────────────────────────────────────────────────

let cookies = 0;
let totalCookies = 0;
let cookiesPerSecond = 0;
let clickPower = 1;

const upgrades: Upgrade[] = [
  { id: "cursor",    name: "Golden Cursor",    description: "A gilded finger. Increases click power.",       baseCost: 15,      baseCps: 0,    baseClickBonus: 1,   count: 0, emoji: "👆" },
  { id: "grandma",   name: "Cookie Matriarch", description: "She bakes with mysterious purpose.",           baseCost: 100,     baseCps: 1,    baseClickBonus: 0,   count: 0, emoji: "👵" },
  { id: "farm",      name: "Cocoa Plantation", description: "Fields of raw, decadent cacao.",               baseCost: 1100,    baseCps: 8,    baseClickBonus: 0,   count: 0, emoji: "🌾" },
  { id: "mine",      name: "Sugar Mine",       description: "Deep veins of crystallised sweetness.",        baseCost: 12000,   baseCps: 47,   baseClickBonus: 0,   count: 0, emoji: "⛏️" },
  { id: "factory",   name: "Biscuit Factory",  description: "Industrial-scale indulgence.",                 baseCost: 130000,  baseCps: 260,  baseClickBonus: 0,   count: 0, emoji: "🏭" },
  { id: "alchemy",   name: "Alchemy Lab",      description: "Transmutes gold into cookies. Worth it.",      baseCost: 1400000, baseCps: 1600, baseClickBonus: 0,   count: 0, emoji: "⚗️" },
];

const milestones: Milestone[] = [
  { threshold: 1,         label: "First Taste",       unlocked: false },
  { threshold: 100,       label: "Sweet Tooth",        unlocked: false },
  { threshold: 1000,      label: "Cookie Connoisseur", unlocked: false },
  { threshold: 10000,     label: "Sugar Aristocrat",   unlocked: false },
  { threshold: 100000,    label: "Biscuit Baron",      unlocked: false },
  { threshold: 1000000,   label: "Cookie Overlord",    unlocked: false },
];

// ── DOM refs ─────────────────────────────────────────────────────────────────

const cookieEl      = document.getElementById("cookie") as HTMLElement;
const countEl       = document.getElementById("cookie-count") as HTMLElement;
const cpsEl         = document.getElementById("cps") as HTMLElement;
const cpcEl         = document.getElementById("cpc") as HTMLElement;
const particleLayer = document.getElementById("particle-layer") as HTMLElement;
const shopEl        = document.getElementById("shop-list") as HTMLElement;
const milestoneEl   = document.getElementById("milestone-banner") as HTMLElement;
const toastEl       = document.getElementById("toast") as HTMLElement;

// ── Formatting ───────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9)  return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6)  return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3)  return (n / 1e3).toFixed(1) + "K";
  return Math.floor(n).toString();
}

// ── Cost scaling ──────────────────────────────────────────────────────────────

function upgradeCost(u: Upgrade): number {
  return Math.ceil(u.baseCost * Math.pow(1.15, u.count));
}

// ── Particles ────────────────────────────────────────────────────────────────

function spawnParticles(x: number, y: number, count = 12): void {
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const angle = Math.random() * Math.PI * 2;
    const dist  = 60 + Math.random() * 80;
    const tx    = Math.cos(angle) * dist;
    const ty    = Math.sin(angle) * dist;
    const size  = 4 + Math.random() * 6;
    p.style.cssText = `
      left: ${x}px; top: ${y}px;
      width: ${size}px; height: ${size}px;
      --tx: ${tx}px; --ty: ${ty}px;
      animation-duration: ${0.5 + Math.random() * 0.4}s;
      opacity: ${0.7 + Math.random() * 0.3};
    `;
    particleLayer.appendChild(p);
    p.addEventListener("animationend", () => p.remove());
  }
}

// ── Click handler ────────────────────────────────────────────────────────────

function handleCookieClick(e: MouseEvent): void {
  const gained = clickPower;
  cookies      += gained;
  totalCookies += gained;

  // Floating text
  const label = document.createElement("div");
  label.className = "click-label";
  label.textContent = `+${fmt(gained)}`;
  const rect = cookieEl.getBoundingClientRect();
  label.style.left = `${e.clientX - rect.left}px`;
  label.style.top  = `${e.clientY - rect.top - 20}px`;
  cookieEl.parentElement!.appendChild(label);
  label.addEventListener("animationend", () => label.remove());

  spawnParticles(e.clientX, e.clientY);
  cookieEl.classList.remove("pop");
  void cookieEl.offsetWidth; // reflow
  cookieEl.classList.add("pop");

  checkMilestones();
  updateUI();
}

cookieEl.addEventListener("click", handleCookieClick);

// ── Shop ──────────────────────────────────────────────────────────────────────

function buildShop(): void {
  shopEl.innerHTML = "";
  upgrades.forEach(u => {
    const cost     = upgradeCost(u);
    const canAfford = cookies >= cost;
    const li = document.createElement("li");
    li.className = `shop-item${canAfford ? " affordable" : ""}`;
    li.dataset.id = u.id;
    li.innerHTML = `
      <span class="shop-emoji">${u.emoji}</span>
      <div class="shop-info">
        <div class="shop-name">${u.name}</div>
        <div class="shop-desc">${u.description}</div>
      </div>
      <div class="shop-right">
        <div class="shop-cost">${fmt(cost)}</div>
        <div class="shop-owned">${u.count} owned</div>
      </div>
    `;
    li.addEventListener("click", () => buyUpgrade(u));
    shopEl.appendChild(li);
  });
}

function buyUpgrade(u: Upgrade): void {
  const cost = upgradeCost(u);
  if (cookies < cost) return;

  cookies -= cost;
  u.count += 1;

  // Recalc global stats
  cookiesPerSecond = upgrades.reduce((sum, up) => sum + up.baseCps * up.count, 0);
  clickPower       = 1 + upgrades.reduce((sum, up) => sum + up.baseClickBonus * up.count, 0);

  showToast(`${u.emoji} ${u.name} purchased!`);
  updateUI();
  buildShop();
}

// ── Milestones ────────────────────────────────────────────────────────────────

function checkMilestones(): void {
  milestones.forEach(m => {
    if (!m.unlocked && totalCookies >= m.threshold) {
      m.unlocked = true;
      showMilestone(m.label);
    }
  });
}

function showMilestone(label: string): void {
  milestoneEl.textContent = `✦ ${label} ✦`;
  milestoneEl.classList.add("show");
  setTimeout(() => milestoneEl.classList.remove("show"), 3000);
}

// ── Toast ────────────────────────────────────────────────────────────────────

let toastTimer: ReturnType<typeof setTimeout> | null = null;
function showToast(msg: string): void {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2000);
}

// ── Passive income ────────────────────────────────────────────────────────────

let lastTick = performance.now();
function tick(now: number): void {
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  if (cookiesPerSecond > 0) {
    const earned = cookiesPerSecond * dt;
    cookies      += earned;
    totalCookies += earned;
    checkMilestones();
  }

  updateUI();
  requestAnimationFrame(tick);
}

// ── UI update ────────────────────────────────────────────────────────────────

function updateUI(): void {
  countEl.textContent = fmt(cookies);
  cpsEl.textContent   = `${fmt(cookiesPerSecond)}/s`;
  cpcEl.textContent   = `${fmt(clickPower)} per click`;

  // Refresh affordability highlights without full rebuild
  document.querySelectorAll<HTMLElement>(".shop-item").forEach(li => {
    const u = upgrades.find(up => up.id === li.dataset.id);
    if (!u) return;
    const cost = upgradeCost(u);
    li.classList.toggle("affordable", cookies >= cost);
    const costEl = li.querySelector(".shop-cost");
    if (costEl) costEl.textContent = fmt(cost);
    const ownedEl = li.querySelector(".shop-owned");
    if (ownedEl) ownedEl.textContent = `${u.count} owned`;
  });
}

// ── Boot ─────────────────────────────────────────────────────────────────────

buildShop();
requestAnimationFrame(tick);
