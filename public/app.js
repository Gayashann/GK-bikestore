// GK Motorcycle - Public Customer Showroom Controller

// State Management
let bikes = [];
let profileData = {
  name: 'GK Motorcycle Administrator',
  business: 'GK Motorcycle',
  phone: '+94 77 123 4567',
  email: 'admin@gkmotorcycle.com',
  address: 'Colombo, Sri Lanka',
  avatar: 'sports'
};

// SVG Preset Fallbacks (Updated with Orange/Cyan Theme Colors)
const presetAvatars = [
  {
    id: 'sports',
    svg: `<svg viewBox="0 0 100 60" class="w-full h-full p-2"><rect width="100" height="60" rx="12" fill="#1E293B"/><path d="M25 45a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm50 0a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" fill="none" stroke="#ff5c00" stroke-width="3"/><path d="M25 37l15-18h20l15 18M40 19l10 15m0 0h20l15-15" fill="none" stroke="#00e5ff" stroke-width="3"/><circle cx="50" cy="20" r="3" fill="#ffffff"/></svg>`
  },
  {
    id: 'cruiser',
    svg: `<svg viewBox="0 0 100 60" class="w-full h-full p-2"><rect width="100" height="60" rx="12" fill="#1E293B"/><path d="M20 45a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm55 0a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" fill="none" stroke="#00e5ff" stroke-width="3"/><path d="M20 37h30l25-10M50 37l5-15h12" fill="none" stroke="#E2E8F0" stroke-width="3"/><circle cx="67" cy="22" r="3" fill="#ff5c00"/></svg>`
  },
  {
    id: 'adventure',
    svg: `<svg viewBox="0 0 100 60" class="w-full h-full p-2"><rect width="100" height="60" rx="12" fill="#1E293B"/><path d="M22 45a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm52 0a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" fill="none" stroke="#10B981" stroke-width="3"/><path d="M22 37l12-14h18l12 14M34 23l14 8h15M48 31l12-19" fill="none" stroke="#ff5c00" stroke-width="3"/></svg>`
  },
  {
    id: 'scooter',
    svg: `<svg viewBox="0 0 100 60" class="w-full h-full p-2"><rect width="100" height="60" rx="12" fill="#1E293B"/><path d="M24 45a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm48 0a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" fill="none" stroke="#EC4899" stroke-width="3"/><path d="M24 39c5-8 12-14 20-14h16c3 0 6 3 6 6v13M60 25l6-10" fill="none" stroke="#E2E8F0" stroke-width="3"/><circle cx="66" cy="15" r="2.5" fill="#00e5ff"/></svg>`
  }
];

// Document Load Listener
document.addEventListener('DOMContentLoaded', () => {
  initProfileSettings();
  fetchData();
});

// Load profile settings from LocalStorage
function initProfileSettings() {
  const savedData = localStorage.getItem('gk_profile_data');
  if (savedData) {
    profileData = JSON.parse(savedData);
  }
  
  // Set default business to GK Motorcycle if not customized or matching old values
  if (!savedData || profileData.business === 'GK Bike Store' || profileData.business === 'Kinetic Velocity') {
    profileData.business = 'GK Motorcycle';
  }
  
  // Update store title dynamic branding
  const logoText = document.getElementById('public-logo-text');
  if (logoText) logoText.innerText = profileData.business;

  // Populate Contact section
  const contactPhone = document.getElementById('contact-phone');
  const contactAddress = document.getElementById('contact-address');
  const contactEmail = document.getElementById('contact-email');
  const contactWaBtn = document.getElementById('contact-wa-btn');

  if (contactPhone) contactPhone.innerText = profileData.phone || '+94 77 123 4567';
  if (contactAddress) contactAddress.innerText = profileData.address || 'Colombo, Sri Lanka';
  if (contactEmail) contactEmail.innerText = profileData.email || 'owner@gkmotorcycle.com';
  if (contactWaBtn) {
    const cleanPhone = (profileData.phone || '+94771234567').replace(/[^0-9+]/g, '');
    const waText = encodeURIComponent(`Hi! I'm interested in one of the motorcycles listed on your showroom. Could you please share more details?`);
    contactWaBtn.href = `https://wa.me/${cleanPhone}?text=${waText}`;
  }
}

// Fetch available bikes from backend
async function fetchData() {
  try {
    const res = await fetch('/api/bikes');
    if (res.ok) {
      bikes = await res.json();
      renderPublicShowroom();
    }
  } catch (error) {
    console.error('Error fetching public bike list:', error);
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

// Image preview mapper
function getImageMarkup(imageValue) {
  if (!imageValue) {
    return `
      <div class="w-full h-full flex flex-col items-center justify-center bg-slate-950/80 text-slate-600 select-none">
        <span class="material-symbols-outlined text-4xl mb-2 opacity-40">photo_camera</span>
        <span class="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">No Photo Uploaded</span>
      </div>
    `;
  }

  if (imageValue.startsWith('data:image')) {
    return `<img src="${imageValue}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />`;
  }

  // Preset fallback
  const preset = presetAvatars.find(p => p.id === imageValue);
  if (preset) {
    return `<div class="w-24 h-24 text-slate-400 opacity-80 flex items-center justify-center">${preset.svg}</div>`;
  }

  return `
    <div class="w-full h-full flex flex-col items-center justify-center bg-slate-950/80 text-slate-600 select-none">
      <span class="material-symbols-outlined text-4xl mb-2 opacity-40">photo_camera</span>
      <span class="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">No Photo Uploaded</span>
    </div>
  `;
}

// Render available bikes in showroom
function renderPublicShowroom() {
  const container = document.getElementById('public-bike-grid');
  const emptyState = document.getElementById('public-empty-state');
  if (!container) return;

  // Show ONLY 'Available' bikes
  const availableBikes = bikes.filter(b => b.status === 'Available');

  // Apply public search query filter
  const searchInput = document.getElementById('public-search');
  const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
  
  const filteredBikes = availableBikes.filter(bike => {
    const brand = bike.brand || '';
    const model = bike.model || '';
    const name = `${brand} ${model}`.toLowerCase();
    const plate = (bike.numberPlate || '').toLowerCase();
    return name.includes(searchQuery) || plate.includes(searchQuery);
  });

  if (filteredBikes.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  container.innerHTML = filteredBikes.map((bike, index) => {
    const brandName = bike.brand === 'Default' ? '' : bike.brand;
    const bikeTitle = `${brandName} ${bike.model}`.trim();
    const priceFormatted = formatCurrency(bike.askingPrice || 0);
    const plateFormatted = bike.numberPlate || 'N/A';
    
    // WhatsApp URL build
    const phoneToUse = bike.ownerPhone || profileData.phone || '+94 77 123 4567';
    const cleanedPhone = phoneToUse.replace(/[^0-9+]/g, '');
    const waText = encodeURIComponent(`Hi, I am interested in buying your motorcycle: ${bikeTitle} (Plate: ${plateFormatted}) listed on your showroom for ${priceFormatted}. Please let me know its availability for inspection!`);
    const waLink = `https://wa.me/${cleanedPhone}?text=${waText}`;

    return `
      <div class="bike-card stagger-card flex flex-col justify-between bg-slate-900/40 border border-slate-800/80 backdrop-blur rounded-2xl overflow-hidden shadow-md hover:shadow-2xl hover:border-primary/20 transition-all duration-300 group" style="animation-delay: ${index * 60}ms;">
        
        <!-- Image Container -->
        <div class="h-56 w-full relative overflow-hidden bg-slate-950 flex items-center justify-center border-b border-slate-800/50">
          ${getImageMarkup(bike.image)}
          
          <!-- Price Tag overlay -->
          <span class="absolute top-4 left-4 bg-primary text-white text-xs font-black px-3.5 py-1.5 rounded-xl shadow-lg border border-orange-400/20">
            ${priceFormatted}
          </span>

          <!-- Status badge -->
          <span class="absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
            Available
          </span>
        </div>

        <!-- Details -->
        <div class="p-6 flex-1 flex flex-col justify-between">
          <div class="space-y-4">
            <h3 class="text-xl font-bold text-white font-headline-md uppercase tracking-wide leading-tight">${bikeTitle}</h3>
            
            <div class="flex items-center justify-between">
              <!-- Plate Badge -->
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center justify-center bg-slate-950 text-[10px] text-slate-400 font-extrabold px-2 py-0.5 rounded tracking-wider uppercase font-sans border border-slate-800">NP</span>
                <span class="inline-flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-1 text-[11px] font-black font-sans uppercase tracking-widest text-primary shadow-inner">
                  ${plateFormatted}
                </span>
              </div>

              ${bike.year ? `
                <span class="text-xs text-slate-400 font-medium">Year: <strong class="text-slate-200">${bike.year}</strong></span>
              ` : ''}
            </div>

            <!-- Specific specs (Condition & Mileage) -->
            <div class="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-850">
              <span class="flex items-center gap-1">
                <span class="material-symbols-outlined text-sm text-slate-500">tune</span>
                Condition: <strong class="text-slate-200 font-semibold">${bike.condition || 'Excellent'}</strong>
              </span>
              ${bike.mileage ? `
              <span class="flex items-center gap-1">
                <span class="material-symbols-outlined text-sm text-slate-500">speed</span>
                Mileage: <strong class="text-slate-200 font-semibold">${bike.mileage} km</strong>
              </span>
              ` : ''}
            </div>
          </div>

          <!-- WhatsApp Inquiry Button -->
          <div class="mt-6 pt-4 border-t border-slate-850">
            <a href="${waLink}" target="_blank" class="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg hover:shadow-emerald-500/15 transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
              <i class="fa-brands fa-whatsapp text-lg"></i>
              <span>Inquire via WhatsApp</span>
            </a>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

// Live Search debounced filter
let publicSearchTimeout;
function debouncePublicFilter() {
  clearTimeout(publicSearchTimeout);
  publicSearchTimeout = setTimeout(() => {
    renderPublicShowroom();
  }, 300);
}

// Interactive Legendary Superbikes Switcher Data
const legendBikes = {
  s1000rr: {
    brand: 'BMW MOTORRAD',
    name: 'S1000RR Carbon Edition',
    desc: 'The ultimate racetrack weapon. Featuring a 999cc inline-four engine with BMW ShiftCam technology, producing an absolute masterclass of power, agility, and pure electronic control.',
    power: '205 HP',
    engine: '999 CC',
    speed: '303 km/h',
    image: '/images/s1000rr.png'
  },
  r1: {
    brand: 'YAMAHA MOTOR',
    name: 'YZF-R1 Racing Edition',
    desc: 'Derived from Yamaha MotoGP heritage. Features the legendary crossplane crankshaft engine offering incredibly linear torque delivery, magnesium wheels, and cutting-edge aerodynamics.',
    power: '197 HP',
    engine: '998 CC',
    speed: '298 km/h',
    image: '/images/yamaha_r1.png'
  },
  ducati: {
    brand: 'DUCATI MOTOR',
    name: 'Panigale V4 S Premium',
    desc: 'Pure Italian racing pedigree. Powered by the Desmosedici Stradale 90-degree V4 engine. A breathtaking combination of sheer horsepower, advanced winglets, and luxurious design.',
    power: '210 HP',
    engine: '1,103 CC',
    speed: '315 km/h',
    image: '/images/ducati_v4.png'
  },
  user_bike: {
    brand: 'YAMAHA JAPAN',
    name: 'WR250X Custom Supermoto',
    desc: 'A gorgeous, track-ready high performance single-cylinder machine. Tuned perfectly with white fairings, robust frame engineering, agile handling, and supreme throttle response.',
    power: '31 HP',
    engine: '250 CC',
    speed: '145 km/h',
    image: '/images/user_bike.png'
  }
};

function switchLegendBike(key) {
  const data = legendBikes[key];
  if (!data) return;

  // Update classes for buttons
  const keys = ['s1000rr', 'r1', 'ducati', 'user_bike'];
  keys.forEach(k => {
    const btn = document.getElementById(`btn-legend-${k}`);
    if (btn) {
      if (k === key) {
        btn.className = "flex-1 min-w-[100px] py-3 px-4 rounded-xl border font-bold uppercase text-xs tracking-wider transition-all duration-300 bg-primary text-white border-primary shadow-lg shadow-primary/20";
      } else {
        btn.className = "flex-1 min-w-[100px] py-3 px-4 rounded-xl border border-slate-800 text-slate-400 font-bold uppercase text-xs tracking-wider transition-all duration-300 hover:border-slate-700 hover:text-white";
      }
    }
  });

  // Apply beautiful fade/slide animation to details and image
  const brandEl = document.getElementById('legend-bike-brand');
  const nameEl = document.getElementById('legend-bike-name');
  const descEl = document.getElementById('legend-bike-desc');
  const powerEl = document.getElementById('legend-spec-power');
  const engineEl = document.getElementById('legend-spec-engine');
  const speedEl = document.getElementById('legend-spec-speed');
  const imgEl = document.getElementById('legend-bike-image');

  // Fade out
  const elements = [brandEl, nameEl, descEl, powerEl, engineEl, speedEl, imgEl];
  elements.forEach(el => {
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      el.style.transition = 'all 0.3s ease-in-out';
    }
  });

  setTimeout(() => {
    // Set values
    if (brandEl) brandEl.innerText = data.brand;
    if (nameEl) nameEl.innerText = data.name;
    if (descEl) descEl.innerText = data.desc;
    if (powerEl) powerEl.innerText = data.power;
    if (engineEl) engineEl.innerText = data.engine;
    if (speedEl) speedEl.innerText = data.speed;
    if (imgEl) {
      imgEl.src = data.image;
      imgEl.style.transform = 'scale(1.05)';
    }

    // Fade in and slide up
    elements.forEach(el => {
      if (el) {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }
    });

    setTimeout(() => {
      if (imgEl) imgEl.style.transform = 'scale(1)';
    }, 300);

  }, 300);
}

