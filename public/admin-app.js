// GK Bike Store - Dedicated Owner Administration & Analytics Controller

// Intercept all API calls to automatically inject the logged-in owner's parameter
const originalFetch = window.fetch;
window.fetch = function (url, options) {
  // Only intercept relative API paths or our specific endpoints
  if (typeof url === 'string' && url.startsWith('/api/') && !url.includes('/api/admin/login')) {
    const owner = sessionStorage.getItem('gk_admin_owner') || 'gk';
    
    // Add owner query parameter
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}owner=${owner}`;
  }
  return originalFetch(url, options);
};

// State Management
let bikes = [];
let analyticsSummary = {};
let monthlyData = [];
let currentTab = 'dashboard';
let statusFilter = 'All';
let searchFilter = '';
let selectedPresetAvatar = '';
let profitChartInstance = null;
let comparisonChartInstance = null;
let currentChartMode = 'profit'; // 'profit' or 'sales'

// Profile Management State
let profileData = {
  name: 'GK Owner',
  business: 'GK Bike Store',
  phone: '+94 77 123 4567',
  email: 'owner@gkbikestore.com',
  address: 'Colombo, Sri Lanka',
  avatar: 'sports'
};
let selectedProfileAvatar = 'sports';


// Preset SVGs for standard bike types
const presetAvatars = [
  {
    id: 'sports',
    label: 'Sport Bike',
    svg: `<svg viewBox="0 0 100 60" class="w-full h-full p-2"><rect width="100" height="60" rx="8" fill="#1E293B"/><path d="M25 45a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm50 0a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" fill="none" stroke="#06B6D4" stroke-width="3"/><path d="M25 37l15-18h20l15 18M40 19l10 15m0 0h20l15-15" fill="none" stroke="#6366F1" stroke-width="3"/><circle cx="50" cy="20" r="3" fill="#10B981"/></svg>`
  },
  {
    id: 'cruiser',
    label: 'Cruiser',
    svg: `<svg viewBox="0 0 100 60" class="w-full h-full p-2"><rect width="100" height="60" rx="8" fill="#1E293B"/><path d="M20 45a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm55 0a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" fill="none" stroke="#F59E0B" stroke-width="3"/><path d="M20 37h30l25-10M50 37l5-15h12" fill="none" stroke="#E2E8F0" stroke-width="3"/><circle cx="67" cy="22" r="3" fill="#EF4444"/></svg>`
  },
  {
    id: 'adventure',
    label: 'Adventure',
    svg: `<svg viewBox="0 0 100 60" class="w-full h-full p-2"><rect width="100" height="60" rx="8" fill="#1E293B"/><path d="M22 45a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm52 0a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" fill="none" stroke="#10B981" stroke-width="3"/><path d="M22 37l12-14h18l12 14M34 23l14 8h15M48 31l12-19" fill="none" stroke="#F43F5E" stroke-width="3"/></svg>`
  },
  {
    id: 'scooter',
    label: 'Scooter',
    svg: `<svg viewBox="0 0 100 60" class="w-full h-full p-2"><rect width="100" height="60" rx="8" fill="#1E293B"/><path d="M24 45a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm48 0a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" fill="none" stroke="#EC4899" stroke-width="3"/><path d="M24 39c5-8 12-14 20-14h16c3 0 6 3 6 6v13M60 25l6-10" fill="none" stroke="#E2E8F0" stroke-width="3"/><circle cx="66" cy="15" r="2.5" fill="#06B6D4"/></svg>`
  }
];

// Document Load Listener
document.addEventListener('DOMContentLoaded', async () => {
  await loadProfileFromDB();
  checkLoginState();
  initBlurTextAnimations();
  renderPresetAvatars();
  checkDBStatus();
  fetchData();
  
  // Set default buy date to today in form
  document.getElementById('bike-buydate').valueAsDate = new Date();
  
  // Handle Chart View toggling
  document.getElementById('btn-chart-profit').addEventListener('click', () => toggleChartMode('profit'));
  document.getElementById('btn-chart-sales').addEventListener('click', () => toggleChartMode('sales'));
});

// Render Preset Avatars in form
function renderPresetAvatars() {
  const container = document.getElementById('preset-avatars');
  container.innerHTML = presetAvatars.map(av => `
    <button type="button" onclick="selectPresetAvatar('${av.id}')" id="preset-${av.id}" class="avatar-preset-btn aspect-square rounded-xl border-2 border-slate-800/80 overflow-hidden relative transition-all duration-300">
      ${av.svg}
      <span class="absolute bottom-0 inset-x-0 text-[8px] text-center bg-black/60 py-0.5 font-bold uppercase tracking-wider text-slate-300">${av.label}</span>
    </button>
  `).join('');
}

// Select a Preset Avatar
function selectPresetAvatar(id) {
  selectedPresetAvatar = id;
  document.querySelectorAll('.avatar-preset-btn').forEach(btn => btn.classList.remove('selected'));
  const selectedBtn = document.getElementById(`preset-${id}`);
  if (selectedBtn) {
    selectedBtn.classList.add('selected');
  }

  const avObj = presetAvatars.find(a => a.id === id);
  if (avObj) {
    const previewBox = document.getElementById('image-preview');
    previewBox.innerHTML = avObj.svg;
    document.getElementById('bike-image-file').value = '';
  }
}

// Preview Uploaded custom image (Base64 conversion)
function previewFileImage(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64Str = e.target.result;
      const previewBox = document.getElementById('image-preview');
      previewBox.innerHTML = `<img src="${base64Str}" class="w-full h-full object-cover rounded-xl" />`;
      selectedPresetAvatar = base64Str;
      document.querySelectorAll('.avatar-preset-btn').forEach(btn => btn.classList.remove('selected'));
    };
    reader.readAsDataURL(file);
  }
}

// Get Image markup for list display
function getImageMarkup(imageValue) {
  if (!imageValue) {
    return `
      <div class="w-full h-full flex flex-col items-center justify-center bg-slate-950/40 text-slate-700 select-none">
        <i class="fa-solid fa-camera text-4xl mb-2.5 opacity-60"></i>
        <span class="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">No Photo Uploaded</span>
      </div>
    `;
  }
  if (imageValue.startsWith('data:image')) {
    return `<img src="${imageValue}" class="w-full h-full object-cover rounded-t-2xl" />`;
  }
  const preset = presetAvatars.find(a => a.id === imageValue);
  if (preset) {
    return `<div class="w-20 h-20 text-slate-400 p-2 opacity-80">${preset.svg}</div>`;
  }
  return `
    <div class="w-full h-full flex flex-col items-center justify-center bg-slate-950/40 text-slate-700 select-none">
      <i class="fa-solid fa-camera text-4xl mb-2.5 opacity-60"></i>
      <span class="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">No Photo Uploaded</span>
    </div>
  `;
}

// Check MongoDB Connection Status
async function checkDBStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    
    const banner = document.getElementById('db-status-banner');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    if (data.connected) {
      banner.classList.add('hidden');
      statusDot.className = 'h-2 w-2 rounded-full bg-emerald-500 animate-pulse';
      statusText.innerText = 'Connected';
      statusText.className = 'text-emerald-400 font-semibold';
    } else {
      banner.classList.remove('hidden');
      statusDot.className = 'h-2 w-2 rounded-full bg-amber-500 animate-pulse';
      statusText.innerText = 'Disconnected';
      statusText.className = 'text-amber-400 font-semibold';
    }
  } catch (error) {
    console.error('Error checking DB status:', error);
  }
}

// Retry DB Connection endpoint
async function retryConnection() {
  const retryBtn = document.querySelector('#db-status-banner button');
  if (retryBtn) {
    retryBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin mr-1.5"></i>Retrying...`;
  }
  setTimeout(async () => {
    await checkDBStatus();
    await fetchData();
    if (retryBtn) {
      retryBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate mr-1.5"></i>Retry Connection`;
    }
  }, 1500);
}

// Fetch all bikes and analytics data
async function fetchData() {
  try {
    const bikesRes = await fetch(`/api/bikes?status=${statusFilter}&search=${searchFilter}`);
    if (bikesRes.ok) {
      bikes = await bikesRes.json();
      renderInventoryGrid();
    }

    const anaRes = await fetch('/api/analytics');
    if (anaRes.ok) {
      const anaData = await anaRes.json();
      analyticsSummary = anaData.summary;
      monthlyData = anaData.monthlyData;
      
      updateKPICards();
      updateCharts();
      renderAccountingTable();

      // Update capital pool panel
      if (anaData.summary) {
        updateCapitalPanel(
          anaData.summary.totalCapital || 0,
          anaData.summary.capitalUsedInBikes || 0,
          anaData.summary.remainingCash || 0,
          anaData.capitalEntries || []
        );
      }
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
  }
}

// Currency Formatting Helper (Sri Lankan Rupees)
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 0
  }).format(amount).replace('LKR', 'Rs.');
}

// Update KPI cards in dashboard
function updateKPICards() {
  if (!analyticsSummary) return;

  const buy = analyticsSummary.totalInvested || 0;
  const rev = analyticsSummary.totalRevenue || 0;
  const profit = analyticsSummary.totalProfit || 0;
  const activeVal = analyticsSummary.activeInvestment || 0;
  const totalBikes = analyticsSummary.totalBikes || 0;
  const availableBikes = analyticsSummary.availableCount || 0;
  const soldBikes = analyticsSummary.soldCount || 0;
  const roi = analyticsSummary.roi || 0;

  // Header and sidebar summary updates
  document.getElementById('sidebar-net-profit').innerText = formatCurrency(profit);
  const sidebarProfitPill = document.getElementById('sidebar-profit-pill');
  sidebarProfitPill.innerText = profit >= 0 ? `+${formatCurrency(profit)}` : formatCurrency(profit);
  sidebarProfitPill.className = profit >= 0 
    ? 'text-xs font-bold text-emerald-400 px-2 py-0.5 bg-emerald-500/10 rounded-full'
    : 'text-xs font-bold text-rose-400 px-2 py-0.5 bg-rose-500/10 rounded-full';

  // Dashboard Stats
  document.getElementById('stat-invested').innerText = formatCurrency(buy);
  document.getElementById('stat-revenue').innerText = formatCurrency(rev);
  
  const profitText = document.getElementById('stat-profit');
  profitText.innerText = formatCurrency(profit);
  profitText.className = profit >= 0 ? 'text-2xl font-bold font-outfit text-emerald-400' : 'text-2xl font-bold font-outfit text-rose-400';

  document.getElementById('stat-roi').innerText = `${roi}% ROI`;
  document.getElementById('stat-inventory').innerText = `${totalBikes} Bikes`;
  document.getElementById('stat-available').innerText = availableBikes;
  document.getElementById('stat-sold').innerText = soldBikes;

  // Performance Insights
  document.getElementById('insight-active-value').innerText = formatCurrency(activeVal);
  const roiInsight = document.getElementById('insight-roi');
  roiInsight.innerText = `${roi}%`;
  roiInsight.className = roi >= 0 ? 'text-xl font-bold font-outfit text-emerald-400' : 'text-xl font-bold font-outfit text-rose-400';

  // Conversion rate (sold / total)
  const rate = totalBikes > 0 ? Math.round((soldBikes / totalBikes) * 100) : 0;
  document.getElementById('conversion-rate').innerText = `${rate}%`;
  document.getElementById('conversion-progress').style.width = `${rate}%`;

  // Business health view updates
  document.getElementById('health-invest').innerText = formatCurrency(buy - activeVal);
  document.getElementById('health-revenue').innerText = formatCurrency(rev);
  
  const healthProfit = document.getElementById('health-profit');
  healthProfit.innerText = formatCurrency(profit);
  healthProfit.className = profit >= 0 ? 'text-sm font-bold font-outfit text-emerald-400' : 'text-sm font-bold font-outfit text-rose-400';

  const margin = (buy - activeVal) > 0 ? Math.round((profit / (buy - activeVal)) * 100) : 0;
  document.getElementById('health-margin').innerText = `${margin}%`;

  // Welcome Greeting
  const now = new Date();
  const hrs = now.getHours();
  let greet = 'Good Day';
  if (hrs < 12) greet = 'Good Morning';
  else if (hrs < 17) greet = 'Good Afternoon';
  else greet = 'Good Evening';

  document.getElementById('welcome-title').innerHTML = `${greet}, ${profileData.name}! 🏍️`;
  
  if (totalBikes === 0) {
    document.getElementById('welcome-message').innerText = `Welcome to your premium dashboard! Let's get started by adding your first bike in inventory. Click the "+ Add Bike" button above.`;
  } else {
    document.getElementById('welcome-message').innerText = `Welcome back! You have ${availableBikes} available bikes ready for sale. Your net business profit is currently ${formatCurrency(profit)}. Keep up the excellent work! 🚀`;
  }

  // Welcome badges
  document.getElementById('welcome-roi-badge').innerHTML = `<i class="fa-solid fa-arrow-trend-up mr-1"></i>${roi}% Profit Return`;
  document.getElementById('welcome-roi-badge').className = roi >= 0 
    ? 'inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-xl'
    : 'inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold rounded-xl';
  
  document.getElementById('welcome-active-badge').innerHTML = `<i class="fa-solid fa-motorcycle mr-1"></i>${availableBikes} Available Stock`;
}

// Render administrative inventory cards grid
function renderInventoryGrid() {
  const container = document.getElementById('bike-grid');
  const emptyState = document.getElementById('inventory-empty-state');

  if (bikes.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  container.innerHTML = bikes.map((bike, index) => {
    const isSold = bike.status === 'Sold';
    const profit = isSold ? (bike.sellingPrice - bike.buyingPrice) : 0;
    const brandName = bike.brand === 'Default' ? '' : bike.brand;
    const bikeTitle = `${brandName} ${bike.model}`.trim();
    
    return `
      <div class="bike-card stagger-card flex flex-col justify-between bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm" style="animation-delay: ${index * 60}ms;">
        
        <!-- Image Header -->
        <div class="h-44 w-full relative overflow-hidden bg-slate-950/80 flex items-center justify-center border-b border-slate-800/55">
          ${getImageMarkup(bike.image)}
          
          <!-- Status Badge -->
          <span class="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold ${isSold ? 'badge-sold' : 'badge-available'}">
            ${bike.status}
          </span>
        </div>

        <!-- Detail Body -->
        <div class="p-5 flex-1 flex flex-col justify-between">
          <div class="space-y-3.5">
            <h3 class="text-lg font-bold text-white font-outfit leading-tight">${bikeTitle}</h3>
            
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center justify-center bg-slate-950 text-[10px] text-slate-500 font-extrabold px-2 py-0.5 rounded border border-slate-800 tracking-wider">NP</span>
              <span class="inline-flex items-center justify-center bg-slate-950 border border-slate-800/80 rounded-lg px-3 py-1 text-[11px] font-bold font-outfit uppercase tracking-widest text-accentCyan shadow-inner">
                ${bike.numberPlate || 'NO PLATE'}
              </span>
            </div>
          </div>

          <!-- Cost Summary -->
          <div class="mt-5 border-t border-slate-800/60 pt-4 flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400">Buying Capital:</span>
              <span class="font-bold text-slate-300 font-outfit">${formatCurrency(bike.buyingPrice)}</span>
            </div>

            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400">Asking Price:</span>
              <span class="font-bold text-accentCyan font-outfit">${formatCurrency(bike.askingPrice || 0)}</span>
            </div>
            
            ${isSold ? `
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-400">Selling Price:</span>
                <span class="font-bold text-white font-outfit">${formatCurrency(bike.sellingPrice)}</span>
              </div>
              <div class="flex items-center justify-between text-xs bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-lg mt-1">
                <span class="text-emerald-400 font-semibold">Net Profit:</span>
                <span class="font-extrabold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-outfit">${profit >= 0 ? '+' : ''}${formatCurrency(profit)}</span>
              </div>
            ` : ''}
          </div>

          <!-- Buttons -->
          <div class="flex items-center gap-2 mt-5">
            ${!isSold ? `
              <button onclick="openSellModal('${bike._id}', '${bikeTitle}', ${bike.buyingPrice})" class="flex-1 py-2 bg-gradient-to-r from-accentGreen to-emerald-600 text-white text-xs font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300">
                <i class="fa-solid fa-cash-register mr-1.5"></i>Record Sale
              </button>
            ` : ''}
            
            <button onclick="openEditModal('${bike._id}')" class="p-2 border border-slate-700/60 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/40 transition">
              <i class="fa-solid fa-pen text-xs"></i>
            </button>
            
            <button onclick="deleteBike('${bike._id}')" class="p-2 border border-rose-950/40 text-rose-500 hover:text-white rounded-xl hover:bg-rose-950/40 transition">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

// Render Month-on-Month Accounting Table
function renderAccountingTable() {
  const container = document.getElementById('accounting-table-rows');
  if (!container) return;

  if (monthlyData.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-slate-500 text-xs font-medium">No sales recorded yet to calculate monthly accounting.</td>
      </tr>
    `;
    return;
  }

  container.innerHTML = monthlyData.map(item => {
    const profit = item.profit;
    const margin = item.investment > 0 ? ((profit / item.investment) * 100).toFixed(0) : 0;
    
    return `
      <tr class="border-b border-slate-800/40">
        <td class="py-4 px-6 font-bold font-outfit text-white">${item.label}</td>
        <td class="py-4 px-6 text-center font-semibold text-slate-300">${item.bikesSold}</td>
        <td class="py-4 px-6 text-right text-slate-300 font-outfit">${formatCurrency(item.investment)}</td>
        <td class="py-4 px-6 text-right text-slate-100 font-outfit">${formatCurrency(item.revenue)}</td>
        <td class="py-4 px-6 text-right font-extrabold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-outfit">
          ${profit >= 0 ? '+' : ''}${formatCurrency(profit)}
        </td>
        <td class="py-4 px-6 text-right">
          <span class="px-2 py-0.5 rounded text-xs font-bold ${profit >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}">
            ${margin}%
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// CAPITAL POOL MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

// State tracking for edit mode
let capitalEditId = null;

// Update the Capital Pool panel on the dashboard
function updateCapitalPanel(totalCapital, capitalUsed, remainingCash, entries) {
  const elTotal = document.getElementById('capital-total');
  const elUsed = document.getElementById('capital-used');
  const elRemaining = document.getElementById('capital-remaining');
  const elBar = document.getElementById('capital-utilisation-bar');
  const elPct = document.getElementById('capital-utilisation-pct');
  const elCard = document.getElementById('capital-balance-card');
  const elIcon = document.getElementById('capital-balance-icon');

  if (!elTotal) return;

  elTotal.innerText = formatCurrency(totalCapital);
  elUsed.innerText = formatCurrency(capitalUsed);
  elRemaining.innerText = formatCurrency(remainingCash);

  // Color the remaining cash card
  if (remainingCash < 0) {
    elRemaining.className = 'text-xl font-black font-outfit text-rose-400';
    elCard.className = 'bg-slate-900/50 border border-rose-500/20 rounded-2xl p-4 flex items-center gap-4';
    elIcon.className = 'fa-solid fa-circle-exclamation text-rose-400 text-xl';
  } else if (remainingCash === 0) {
    elRemaining.className = 'text-xl font-black font-outfit text-amber-300';
    elCard.className = 'bg-slate-900/50 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4';
    elIcon.className = 'fa-solid fa-wallet text-amber-300 text-xl';
  } else {
    elRemaining.className = 'text-xl font-black font-outfit text-emerald-400';
    elCard.className = 'bg-slate-900/50 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4';
    elIcon.className = 'fa-solid fa-wallet text-emerald-400 text-xl';
  }

  // Progress bar
  const pct = totalCapital > 0 ? Math.min(Math.round((capitalUsed / totalCapital) * 100), 100) : 0;
  elBar.style.width = `${pct}%`;
  if (pct >= 90) {
    elBar.className = 'h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-700 transition-all duration-1000';
  } else if (pct >= 70) {
    elBar.className = 'h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-1000';
  } else {
    elBar.className = 'h-full rounded-full bg-gradient-to-r from-accentCyan to-accentIndigo transition-all duration-1000';
  }
  elPct.innerText = `${pct}% Used`;

  // Injection history
  renderCapitalHistory(entries);
}

// Render the list of capital injection history entries (with edit + delete buttons)
function renderCapitalHistory(entries) {
  const container = document.getElementById('capital-history-list');
  if (!container) return;

  if (!entries || entries.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-600 italic py-2">No capital added yet. Click "Add Capital" to begin.</p>`;
    return;
  }

  container.innerHTML = entries.map(entry => {
    const date = new Date(entry.addedAt || entry.createdAt);
    const dateStr = date.toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });
    const noteDisplay = entry.note ? `<span class="text-slate-500 ml-2 truncate max-w-[200px]">— ${entry.note}</span>` : '';
    // Escape note for passing into onclick safely
    const noteEscaped = (entry.note || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return `
      <div class="flex items-center justify-between bg-slate-900/60 border border-slate-800/40 rounded-xl px-4 py-2.5 group hover:border-slate-700/60 transition-all duration-200">
        <div class="flex items-center gap-3 min-w-0">
          <i class="fa-solid fa-circle-plus text-accentCyan text-sm opacity-70 shrink-0"></i>
          <div class="min-w-0 flex items-center flex-wrap gap-x-1">
            <span class="text-sm font-bold font-outfit text-emerald-400">+${formatCurrency(entry.amount)}</span>
            ${noteDisplay}
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0 ml-3">
          <span class="text-[10px] text-slate-600 font-medium hidden sm:block">${dateStr}</span>
          <!-- Edit button -->
          <button
            onclick="editCapitalEntry('${entry._id}', ${entry.amount}, '${noteEscaped}')"
            class="opacity-0 group-hover:opacity-100 transition p-1.5 text-accentCyan hover:text-white rounded-lg hover:bg-accentCyan/20"
            title="Edit this entry">
            <i class="fa-solid fa-pen text-xs"></i>
          </button>
          <!-- Delete button -->
          <button
            onclick="removeCapitalEntry('${entry._id}')"
            class="opacity-0 group-hover:opacity-100 transition p-1.5 text-rose-500 hover:text-rose-300 rounded-lg hover:bg-rose-950/30"
            title="Delete this entry">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Open Add Capital Modal (optionally pre-filled for editing)
function openAddCapitalModal(editId = null, editAmount = '', editNote = '') {
  capitalEditId = editId; // null = add mode, string = edit mode

  const modal = document.getElementById('add-capital-modal');
  const titleEl = document.getElementById('capital-modal-title');
  const subEl = document.getElementById('capital-modal-subtitle');
  const btnEl = document.getElementById('capital-submit-btn');

  document.getElementById('capital-amount').value = editAmount || '';
  document.getElementById('capital-note').value = editNote || '';
  document.getElementById('capital-modal-error').classList.add('hidden');

  if (editId) {
    // Edit mode UI
    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-pen-to-square text-accentCyan"></i> Edit Capital Entry';
    if (subEl) subEl.innerText = 'Correct the amount or label for this injection.';
    if (btnEl) btnEl.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
  } else {
    // Add mode UI
    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-piggy-bank text-accentCyan"></i> Add Capital Injection';
    if (subEl) subEl.innerText = 'Inject new funds into the business capital pool.';
    if (btnEl) btnEl.innerHTML = '<i class="fa-solid fa-plus"></i> Add to Pool';
  }

  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    modal.querySelector('.bg-slate-900').classList.remove('scale-95');
    document.getElementById('capital-amount').focus();
  }, 50);
}

// Trigger edit mode — called from history row edit buttons
function editCapitalEntry(id, amount, note) {
  openAddCapitalModal(id, amount, note);
}

// Close Add Capital Modal
function closeAddCapitalModal() {
  const modal = document.getElementById('add-capital-modal');
  modal.classList.add('opacity-0');
  modal.querySelector('.bg-slate-900').classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
    capitalEditId = null; // Reset edit state
  }, 300);
}

// Submit — handles both ADD (POST) and EDIT (PUT)
async function submitCapital(event) {
  event.preventDefault();

  const amount = parseFloat(document.getElementById('capital-amount').value);
  const note = document.getElementById('capital-note').value.trim();
  const errBox = document.getElementById('capital-modal-error');
  const errText = document.getElementById('capital-modal-error-text');
  const btn = document.getElementById('capital-submit-btn');

  errBox.classList.add('hidden');

  if (!amount || amount <= 0) {
    errText.innerText = 'Please enter a valid positive amount.';
    errBox.classList.remove('hidden');
    return;
  }

  const isEdit = !!capitalEditId;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-1"></i>' + (isEdit ? 'Updating...' : 'Saving...');

  try {
    const url = isEdit ? `/api/capital/${capitalEditId}` : '/api/capital';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, note })
    });

    if (res.ok) {
      closeAddCapitalModal();
      await fetchData();
      showToast(
        isEdit
          ? `Capital entry updated to ${formatCurrency(amount)} ✏️`
          : `Capital injection of ${formatCurrency(amount)} added! 💰`,
        'success'
      );
    } else {
      const data = await res.json();
      errText.innerText = data.error || 'Failed to save capital entry.';
      errBox.classList.remove('hidden');
    }
  } catch (err) {
    errText.innerText = 'Server unreachable. Please check your connection.';
    errBox.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = isEdit
      ? '<i class="fa-solid fa-floppy-disk"></i> Save Changes'
      : '<i class="fa-solid fa-plus"></i> Add to Pool';
  }
}

// Delete a capital entry
async function removeCapitalEntry(id) {
  if (!confirm('Remove this capital injection entry? This will recalculate your remaining cash balance.')) return;

  try {
    const res = await fetch(`/api/capital/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchData();
      showToast('Capital entry removed.', 'success');
    } else {
      showToast('Failed to remove entry.', 'error');
    }
  } catch (err) {
    showToast('Server unreachable.', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════

// Toggle charts between Profit and Volume modes
function toggleChartMode(mode) {
  currentChartMode = mode;
  
  const profitBtn = document.getElementById('btn-chart-profit');
  const salesBtn = document.getElementById('btn-chart-sales');
  
  if (mode === 'profit') {
    profitBtn.className = 'text-xs px-3 py-1.5 rounded-md font-semibold bg-gradient-to-r from-accentCyan to-accentIndigo text-white';
    salesBtn.className = 'text-xs px-3 py-1.5 rounded-md font-semibold text-slate-400 hover:text-white transition';
  } else {
    salesBtn.className = 'text-xs px-3 py-1.5 rounded-md font-semibold bg-gradient-to-r from-accentCyan to-accentIndigo text-white';
    profitBtn.className = 'text-xs px-3 py-1.5 rounded-md font-semibold text-slate-400 hover:text-white transition';
  }
  
  updateCharts();
}

// Update charts with Chart.js
function updateCharts() {
  const labels = monthlyData.map(item => item.label);
  
  const canvasProfit = document.getElementById('profitChart');
  if (!canvasProfit) return;

  const ctxProfit = canvasProfit.getContext('2d');
  if (profitChartInstance) {
    profitChartInstance.destroy();
  }

  const profitDatasets = currentChartMode === 'profit' 
    ? [
        {
          label: 'Net Monthly Profit',
          data: monthlyData.map(item => item.profit),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          type: 'line'
        },
        {
          label: 'Total Revenue',
          data: monthlyData.map(item => item.revenue),
          backgroundColor: 'rgba(99, 102, 241, 0.45)',
          borderRadius: 6,
          type: 'bar'
        }
      ]
    : [
        {
          label: 'Bikes Sold',
          data: monthlyData.map(item => item.bikesSold),
          backgroundColor: 'rgba(6, 182, 212, 0.55)',
          borderColor: '#06B6D4',
          borderRadius: 6,
          borderWidth: 1,
          type: 'bar'
        }
      ];

  profitChartInstance = new Chart(ctxProfit, {
    data: {
      labels: labels.length > 0 ? labels : ['No Data'],
      datasets: datasetsForEmptyCheck(profitDatasets)
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94A3B8', font: { family: 'Inter', weight: 'bold' } }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(148, 163, 184, 0.05)' }, ticks: { color: '#94A3B8' } },
        y: { grid: { color: 'rgba(148, 163, 184, 0.05)' }, ticks: { color: '#94A3B8' } }
      }
    }
  });

  const canvasComp = document.getElementById('comparisonChart');
  if (!canvasComp) return;

  const ctxComp = canvasComp.getContext('2d');
  if (comparisonChartInstance) {
    comparisonChartInstance.destroy();
  }

  const compDatasets = [
    {
      label: 'Capital Invested',
      data: monthlyData.map(item => item.investment),
      backgroundColor: 'rgba(245, 158, 11, 0.65)',
      borderRadius: 6,
    },
    {
      label: 'Revenue Returned',
      data: monthlyData.map(item => item.revenue),
      backgroundColor: 'rgba(16, 185, 129, 0.65)',
      borderRadius: 6,
    }
  ];

  comparisonChartInstance = new Chart(ctxComp, {
    type: 'bar',
    data: {
      labels: labels.length > 0 ? labels : ['No Data'],
      datasets: datasetsForEmptyCheck(compDatasets)
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94A3B8', font: { family: 'Inter', weight: 'bold' } }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(148, 163, 184, 0.05)' }, ticks: { color: '#94A3B8' } },
        y: { grid: { color: 'rgba(148, 163, 184, 0.05)' }, ticks: { color: '#94A3B8' } }
      }
    }
  });
}

function datasetsForEmptyCheck(datasets) {
  if (monthlyData.length === 0) {
    return datasets.map(set => ({
      ...set,
      data: [0]
    }));
  }
  return datasets;
}

// Tab switcher inside Admin Portal
function switchTab(tabId) {
  currentTab = tabId;
  
  document.querySelectorAll('.tab-content').forEach(sect => sect.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('#mobile-admin-nav button').forEach(btn => btn.classList.remove('active-mobile-btn'));

  const section = document.getElementById(`view-${tabId}`);
  if (section) section.classList.remove('hidden');
  
  const navBtn = document.getElementById(`nav-${tabId}`);
  if (navBtn) navBtn.classList.add('active');
  
  const mobileNavBtn = document.getElementById(`mobile-nav-${tabId}`);
  if (mobileNavBtn) mobileNavBtn.classList.add('active-mobile-btn');

  const title = document.getElementById('view-title');
  const desc = document.getElementById('view-desc');

  if (tabId === 'dashboard') {
    if (title) title.innerText = 'Business Dashboard';
    if (desc) desc.innerText = 'Real-time valuation, sales cycles, and monthly net margins.';
  } else if (tabId === 'inventory') {
    if (title) title.innerText = 'Bicycle Stock Registry';
    if (desc) desc.innerText = 'Manage all your premium bikes, filter status and record transactions.';
  } else if (tabId === 'analytics') {
    if (title) title.innerText = 'Capital & Profit Analytics';
    if (desc) desc.innerText = 'Consolidated month-on-month audit log of investment returns.';
  } else if (tabId === 'profile') {
    if (title) title.innerText = 'Store Owner Profile';
    if (desc) desc.innerText = 'Manage your contact details, business credentials and portal settings.';
  }

  setTimeout(() => {
    updateCharts();
  }, 100);
}

// Filter Stock Inventory Status
function filterStatus(status) {
  statusFilter = status;
  document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById(`filter-${status.toLowerCase()}`).classList.add('active');
  fetchData();
}

// Debounced inventory search
let searchTimeout;
function debounceFilter() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchFilter = document.getElementById('inventory-search').value.trim();
    fetchData();
  }, 400);
}

// Modal - Add Bike
function openAddModal() {
  const modal = document.getElementById('add-bike-modal');
  document.getElementById('modal-title').innerText = 'Add New Bike';
  document.getElementById('bike-form').reset();
  document.getElementById('bike-id').value = '';
  document.getElementById('bike-buydate').valueAsDate = new Date();
  
  const previewBox = document.getElementById('image-preview');
  previewBox.innerHTML = `<i class="fa-solid fa-image text-2xl mb-1"></i><span class="text-[10px]">No Photo</span>`;
  selectedPresetAvatar = '';
  document.querySelectorAll('.avatar-preset-btn').forEach(btn => btn.classList.remove('selected'));

  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    modal.querySelector('.bg-slate-900').classList.remove('scale-95');
  }, 50);
}

function closeAddModal() {
  const modal = document.getElementById('add-bike-modal');
  modal.classList.add('opacity-0');
  modal.querySelector('.bg-slate-900').classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

// Save Bike Record
async function saveBike(event) {
  event.preventDefault();
  
  const id = document.getElementById('bike-id').value;
  const rawModelInput = document.getElementById('bike-model').value.trim();
  let brand = 'Default';
  let model = rawModelInput;
  
  const spaceIndex = rawModelInput.indexOf(' ');
  if (spaceIndex !== -1) {
    brand = rawModelInput.substring(0, spaceIndex).trim();
    model = rawModelInput.substring(spaceIndex + 1).trim();
  } else {
    brand = rawModelInput;
  }

  const bikeData = {
    brand: brand,
    model: model,
    numberPlate: document.getElementById('bike-plate').value.toUpperCase(),
    buyingPrice: parseFloat(document.getElementById('bike-buyprice').value),
    askingPrice: parseFloat(document.getElementById('bike-askingprice').value) || 0,
    purchaseDate: document.getElementById('bike-buydate').value,
    image: selectedPresetAvatar
  };

  try {
    let res;
    if (id) {
      res = await fetch(`/api/bikes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bikeData)
      });
    } else {
      res = await fetch('/api/bikes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bikeData)
      });
    }

    if (res.ok) {
      closeAddModal();
      fetchData();
    } else {
      const err = await res.json();
      alert(`Error saving bike: ${err.error}`);
    }
  } catch (error) {
    console.error('Error submitting form:', error);
  }
}

// Edit existing Bike
async function openEditModal(id) {
  try {
    const res = await fetch('/api/bikes');
    const allBikes = await res.json();
    const bike = allBikes.find(b => b._id === id);

    if (bike) {
      openAddModal();
      document.getElementById('modal-title').innerText = 'Edit Bike Specifications';
      document.getElementById('bike-id').value = bike._id;
      document.getElementById('bike-model').value = bike.brand === 'Default' ? bike.model : `${bike.brand} ${bike.model}`;
      document.getElementById('bike-plate').value = bike.numberPlate || '';
      document.getElementById('bike-buyprice').value = bike.buyingPrice;
      document.getElementById('bike-askingprice').value = bike.askingPrice || 0;
      
      if (bike.purchaseDate) {
        document.getElementById('bike-buydate').value = bike.purchaseDate.substring(0, 10);
      }

      if (bike.image) {
        selectedPresetAvatar = bike.image;
        const previewBox = document.getElementById('image-preview');
        
        if (bike.image.startsWith('data:image')) {
          previewBox.innerHTML = `<img src="${bike.image}" class="w-full h-full object-cover rounded-xl" />`;
        } else {
          selectPresetAvatar(bike.image);
        }
      }
    }
  } catch (error) {
    console.error('Error editing bike:', error);
  }
}

// Delete bike listing
async function deleteBike(id) {
  if (confirm('Are you absolutely sure you want to delete this bike record from your database? This action is permanent.')) {
    try {
      const res = await fetch(`/api/bikes/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(`Error deleting bike: ${err.error}`);
      }
    } catch (error) {
      console.error('Error deleting bike:', error);
    }
  }
}

// Record Sale Modal
function openSellModal(id, title, buyingPrice) {
  const modal = document.getElementById('sell-bike-modal');
  document.getElementById('sell-bike-id').value = id;
  document.getElementById('sell-bike-summary-title').innerText = title;
  document.getElementById('sell-bike-summary-buyprice').innerText = formatCurrency(buyingPrice);
  document.getElementById('sell-price').value = '';
  document.getElementById('sell-date').valueAsDate = new Date();
  
  modal.dataset.buyPrice = buyingPrice;
  document.getElementById('sell-calculated-profit').innerText = formatCurrency(0);

  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    modal.querySelector('.bg-slate-900').classList.remove('scale-95');
  }, 50);
}

function calculateInstantProfit() {
  const modal = document.getElementById('sell-bike-modal');
  const buyPrice = parseFloat(modal.dataset.buyPrice || 0);
  const sellPrice = parseFloat(document.getElementById('sell-price').value || 0);
  
  const profit = sellPrice - buyPrice;
  const profitText = document.getElementById('sell-calculated-profit');
  profitText.innerText = formatCurrency(profit);
  profitText.className = profit >= 0 ? 'text-md font-bold font-outfit text-emerald-400' : 'text-md font-bold font-outfit text-rose-400';
}

function closeSellModal() {
  const modal = document.getElementById('sell-bike-modal');
  modal.classList.add('opacity-0');
  modal.querySelector('.bg-slate-900').classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

async function saveSale(event) {
  event.preventDefault();
  
  const id = document.getElementById('sell-bike-id').value;
  const sellData = {
    sellingPrice: parseFloat(document.getElementById('sell-price').value),
    saleDate: document.getElementById('sell-date').value
  };

  try {
    const res = await fetch(`/api/bikes/${id}/sell`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sellData)
    });

    if (res.ok) {
      closeSellModal();
      fetchData();
    } else {
      const err = await res.json();
      alert(`Error saving sale: ${err.error}`);
    }
  } catch (error) {
    console.error('Error submitting sales details:', error);
  }
}

// Export database records to locally saved JSON file
function exportData() {
  if (bikes.length === 0) {
    alert('There are no bikes in inventory to export.');
    return;
  }
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bikes, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `GK_Bike_Store_DB_Backup_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// Authenticate session state on admin.html
function checkLoginState() {
  const loginView = document.getElementById('login-view');
  const mainLayout = document.getElementById('main-layout');

  // Use sessionStorage so login clears when tab/browser closes
  if (sessionStorage.getItem('gk_store_logged_in') === 'true') {
    if (loginView) loginView.classList.add('hidden');
    if (mainLayout) {
      mainLayout.classList.remove('opacity-0');
      mainLayout.classList.add('opacity-100');
      
      // Load owner-specific profile and then reload bikes list/analytics data
      loadProfileFromDB().then(() => {
        fetchData();
      });

      // Trigger animations
      setTimeout(() => {
        initBlurTextAnimations();
      }, 100);
    }
  } else {
    if (loginView) {
      loginView.classList.remove('hidden');
      setTimeout(() => {
        loginView.querySelector('.scale-95')?.classList.remove('scale-95');
      }, 50);
    }
    if (mainLayout) mainLayout.classList.add('opacity-0');
  }
}

// Authenticate credentials via server API
async function handleLogin(event) {
  event.preventDefault();
  
  const pass = document.getElementById('login-password').value;
  const errorBox = document.getElementById('login-error');
  const submitBtn = event.target.querySelector('button[type="submit"]');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i>Verifying...';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      errorBox.classList.add('hidden');
      // Use sessionStorage — clears automatically when browser/tab closes
      sessionStorage.setItem('gk_store_logged_in', 'true');
      sessionStorage.setItem('gk_admin_token', data.token);
      sessionStorage.setItem('gk_admin_owner', data.owner || 'gk');
      // Remove any stale localStorage flag from old versions
      localStorage.removeItem('gk_store_logged_in');
      localStorage.removeItem('gk_admin_token');
      checkLoginState();
    } else {
      errorBox.classList.remove('hidden');
      errorBox.classList.add('animate-shake');
      setTimeout(() => errorBox.classList.remove('animate-shake'), 500);
    }
  } catch (err) {
    // Fallback to local password if server is unreachable
    const localPass = localStorage.getItem('gk_store_password') || 'gk2026';
    if (pass === localPass) {
      errorBox.classList.add('hidden');
      sessionStorage.setItem('gk_store_logged_in', 'true');
      sessionStorage.setItem('gk_admin_owner', 'gk');
      localStorage.removeItem('gk_store_logged_in');
      checkLoginState();
    } else if (pass === 'lm2026') {
      errorBox.classList.add('hidden');
      sessionStorage.setItem('gk_store_logged_in', 'true');
      sessionStorage.setItem('gk_admin_owner', 'lm');
      localStorage.removeItem('gk_store_logged_in');
      checkLoginState();
    } else {
      errorBox.classList.remove('hidden');
      errorBox.classList.add('animate-shake');
      setTimeout(() => errorBox.classList.remove('animate-shake'), 500);
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Authenticate & Enter';
  }
}

// Profile Settings database loading
async function loadProfileFromDB() {
  try {
    const owner = sessionStorage.getItem('gk_admin_owner') || 'gk';
    const res = await fetch(`/api/profile?owner=${owner}`);
    if (res.ok) {
      profileData = await res.json();
    }
  } catch (error) {
    console.warn('Error loading profile from DB, using fallback local storage:', error);
    const savedData = localStorage.getItem('gk_profile_data');
    if (savedData) {
      profileData = JSON.parse(savedData);
    }
  }
  initProfileSettings();
}

// Profile Settings customization
function initProfileSettings() {
  // Migrate old default password gk123 → gk2026
  const currentLocalPass = localStorage.getItem('gk_store_password');
  if (!currentLocalPass || currentLocalPass === 'gk123') {
    localStorage.setItem('gk_store_password', 'gk2026');
  }
  if (!localStorage.getItem('gk_store_username')) {
    localStorage.setItem('gk_store_username', 'admin');
  }

  selectedProfileAvatar = profileData.avatar || 'sports';

  // Populate profiles
  document.getElementById('prof-name').value = profileData.name || '';
  document.getElementById('prof-business').value = profileData.business || '';
  document.getElementById('prof-phone').value = profileData.phone || '';
  document.getElementById('prof-email').value = profileData.email || '';
  document.getElementById('prof-address').value = profileData.address || '';

  // Populate username field in credentials form
  const usernameInput = document.getElementById('cred-username');
  if (usernameInput) {
    usernameInput.value = localStorage.getItem('gk_store_username') || 'admin';
  }

  const avatarList = document.getElementById('profile-avatars-list');
  if (avatarList) {
    avatarList.innerHTML = presetAvatars.map(av => `
      <button type="button" onclick="selectProfileAvatar('${av.id}')" id="prof-av-${av.id}" class="avatar-preset-btn aspect-square rounded-xl border-2 border-slate-800/80 overflow-hidden relative transition-all duration-300 ${av.id === selectedProfileAvatar ? 'selected' : ''}">
        ${av.svg}
      </button>
    `).join('');
  }

  // Bind titles
  const logoText = document.querySelector('aside h1');
  if (logoText) logoText.innerText = profileData.business;

  const loginTitle = document.getElementById('login-title');
  if (loginTitle) {
    loginTitle.innerText = profileData.business;
    loginTitle.dataset.initialized = 'false';
  }

  document.getElementById('profile-card-name').innerText = profileData.name || 'Owner';
  document.getElementById('profile-card-role').innerText = `${profileData.business || 'Bike Store'} Proprietor`;
  document.getElementById('profile-card-phone').innerText = profileData.phone || '+94 77 123 4567';
  document.getElementById('profile-card-email').innerText = profileData.email || 'owner@gkbikestore.com';
  document.getElementById('profile-card-address').innerText = profileData.address || 'Colombo, Sri Lanka';

  const profileAvatarDisplay = document.getElementById('profile-avatar-display');
  if (profileAvatarDisplay) {
    const av = presetAvatars.find(a => a.id === selectedProfileAvatar) || presetAvatars[0];
    profileAvatarDisplay.innerHTML = av.svg;
  }
}

function selectProfileAvatar(id) {
  selectedProfileAvatar = id;
  document.querySelectorAll('#profile-avatars-list .avatar-preset-btn').forEach(btn => btn.classList.remove('selected'));
  const btn = document.getElementById(`prof-av-${id}`);
  if (btn) btn.classList.add('selected');
}

async function saveProfile(event) {
  event.preventDefault();

  profileData = {
    name: document.getElementById('prof-name').value.trim(),
    business: document.getElementById('prof-business').value.trim(),
    phone: document.getElementById('prof-phone').value.trim(),
    email: document.getElementById('prof-email').value.trim(),
    address: document.getElementById('prof-address').value.trim(),
    avatar: selectedProfileAvatar
  };

  const owner = sessionStorage.getItem('gk_admin_owner') || 'gk';
  try {
    const res = await fetch(`/api/profile?owner=${owner}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData)
    });
    if (res.ok) {
      localStorage.setItem('gk_profile_data', JSON.stringify(profileData));
      initProfileSettings();
      alert('GK Portal Profile updated successfully on DB! All titles and cards have been synchronized.');
    } else {
      throw new Error('Failed to save profile to database');
    }
  } catch (error) {
    localStorage.setItem('gk_profile_data', JSON.stringify(profileData));
    initProfileSettings();
    alert('GK Portal Profile updated locally! (Database sync offline).');
  }
}

// Change credentials via server API
async function changeCredentials(event) {
  event.preventDefault();

  const currentPass = document.getElementById('cred-current-pass').value;
  const newPass = document.getElementById('cred-new-pass').value;
  const confirmPass = document.getElementById('cred-confirm-pass').value;
  const newUsername = document.getElementById('cred-username').value.trim();

  if (!currentPass) {
    alert('Please enter your current password to authorize changes.');
    return;
  }

  if (newPass) {
    if (newPass !== confirmPass) {
      alert('New passwords do not match. Please verify confirmation.');
      return;
    }
    if (newPass.length < 4) {
      alert('Password must be at least 4 characters long.');
      return;
    }

    // Call the server to change the password in MongoDB
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass })
      });
      const data = await res.json();

      if (!res.ok) {
        alert(`Password change failed: ${data.error}`);
        return;
      }
      // Also update local fallback
      localStorage.setItem('gk_store_password', newPass);
    } catch (err) {
      // Server unreachable - update locally only
      const localPass = localStorage.getItem('gk_store_password') || 'gk2026';
      if (currentPass !== localPass) {
        alert('Incorrect current password. Verification failed.');
        return;
      }
      localStorage.setItem('gk_store_password', newPass);
    }
  } else {
    // No new password - just verify current
    const localPass = localStorage.getItem('gk_store_password') || 'gk2026';
    if (currentPass !== localPass) {
      alert('Incorrect current password. Verification failed.');
      return;
    }
  }

  if (newUsername) {
    localStorage.setItem('gk_store_username', newUsername);
  }

  // Reset form
  document.getElementById('cred-current-pass').value = '';
  document.getElementById('cred-new-pass').value = '';
  document.getElementById('cred-confirm-pass').value = '';

  // Show success toast
  showToast('Portal credentials updated successfully! New password is active.', 'success');
}

// Toast notification helper
function showToast(message, type = 'success') {
  const existing = document.getElementById('gk-toast');
  if (existing) existing.remove();

  const colors = type === 'success'
    ? 'bg-emerald-900/80 border-emerald-500/30 text-emerald-200'
    : 'bg-rose-900/80 border-rose-500/30 text-rose-200';
  const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';

  const toast = document.createElement('div');
  toast.id = 'gk-toast';
  toast.className = `fixed bottom-8 right-6 z-[200] flex items-center gap-3 px-5 py-4 ${colors} border backdrop-blur-xl rounded-2xl shadow-2xl text-sm font-semibold transition-all duration-500 translate-y-4 opacity-0`;
  toast.innerHTML = `<i class="fa-solid ${icon} text-lg"></i><span>${message}</span>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => toast.remove(), 500);
  }, 3500);
}

// Log out admin to home index
function logoutOwner() {
  if (confirm('Are you sure you want to logout of the GK Bike Store management portal?')) {
    sessionStorage.removeItem('gk_store_logged_in');
    sessionStorage.removeItem('gk_admin_token');
    localStorage.removeItem('gk_store_logged_in'); // clean up any old localStorage flag
    window.location.href = '/';
  }
}

// Blur-in Text animation engine
function initBlurTextAnimations() {
  const elements = document.querySelectorAll('.blur-text-animate');
  elements.forEach(el => {
    if (el.dataset.initialized === 'true') return;
    el.dataset.initialized = 'true';

    const text = el.innerText.trim();
    const animateBy = el.dataset.animateBy || 'chars';
    el.innerHTML = '';
    el.classList.remove('opacity-0');
    
    const segments = animateBy === 'words' ? text.split(' ') : text.split('');
    const delay = parseInt(el.dataset.delay || '40', 10);
    
    segments.forEach((seg, i) => {
      const span = document.createElement('span');
      span.className = 'blur-char';
      span.innerHTML = seg === ' ' ? '&nbsp;' : seg;
      span.style.transitionDelay = `${i * delay}ms`;
      el.appendChild(span);
      
      if (animateBy === 'words' && i < segments.length - 1) {
        const space = document.createElement('span');
        space.innerHTML = '&nbsp;';
        el.appendChild(space);
      }
    });

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          el.querySelectorAll('.blur-char').forEach(span => span.classList.add('active'));
        }, 100);
        observer.unobserve(el);
      }
    }, { threshold: 0.1 });
    
    observer.observe(el);
  });
}
