// =========================
// 1. CONFIG AGEN & DETECT SLUG
// =========================

// URL Apps Script that reads the Google Sheet agent config
const CONFIG_API_URL = "https://script.google.com/macros/s/AKfycbxBgNRcxnJg9DM0jn91REAucFDi3VuWGZ5KaCow7fPypuF80ga3e8fQSfajMW7TsCbr/exec";

function getAgentIdFromPath() {
  const hostname = window.location.hostname;
  if (hostname.includes('googleusercontent') || hostname.includes('localhost') || hostname === '') {
    return 'bj'; // Default Demo Agent ID
  }

  const path = window.location.pathname; 
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return 'bj';
  const candidate = parts[parts.length - 1].toLowerCase();
  if (candidate.includes('index.html') || candidate.includes('preview')) return 'bj';
  return candidate;
}

const AGENT_ID = getAgentIdFromPath();
const CACHE_KEY_CONFIG = `agent_config_${AGENT_ID || 'default'}`;
const CACHE_KEY_PRICING = `pricing_data_${AGENT_ID || 'default'}`;

// Variables
let URL_HARGA_BARU = "";
let URL_LEADS_LAMA = "";
let AGENT_CONFIG = null;
window.AGENT_WHATSAPP = null;

// Pricing Data
let medicalPriceData150 = [];
let medicalPriceData200 = [];
let hibahPriceData = { nova: [], novaWaiver: [], novaCI: [], chinta: [], chintaWaiver: [], chintaCI: [], inspirasi: [], evo: [] };
let isPricingLoaded = false;

// --- DOM Elements ---
const form = document.getElementById('quotationForm');
const medicalResultDiv = document.getElementById('medicalCardResult');
const hibahResultDiv = document.getElementById('hibahResult');
const errorMessageDiv = document.getElementById('error-message');
const agentSkeleton = document.getElementById('agent-skeleton');
let quotationData = {};

function showError(message) {
    if (errorMessageDiv) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.classList.remove('hidden');
    }
}

// =========================
// 2. HARDCODED BENEFITS DATA
// =========================

const icons = {
    skull: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-skull"><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="12" r="1"/></svg>',
    coins: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-coins"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>',
    clock: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    shieldCheck: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-check"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>',
    tag: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tag"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>',
    plane: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plane"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
    checkCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-circle-2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
    shieldAlert: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-alert"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
    bed: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bed"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>',
    // Medical
    bilik: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bed"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>',
    tahunan: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar-1"><path d="M11 14h1v4"/><path d="M16 2v4"/><path d="M3 10h18"/><path d="M8 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/></svg>',
    seumur: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-infinity"><path d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8"/></svg>',
    kanser: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-alert"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
    klinik: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hospital"><path d="M12 7v4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M14 9h-4"/><path d="M18 11h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"/><path d="M18 21V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16"/></svg>',
    deductible: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
    waiver: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
    elaun: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#000000" d="M12 12.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7ZM10.5 16a1.5 1.5 0 1 1 3 0a1.5 1.5 0 0 1-3 0Z"/><path fill="#000000" d="M17.526 5.116L14.347.659L2.658 9.997L2.01 9.99V10H1.5v12h21V10h-.962l-1.914-5.599l-2.098.715ZM19.425 10H9.397l7.469-2.546l1.522-.487L19.425 10ZM15.55 5.79L7.84 8.418l6.106-4.878l1.604 2.25ZM3.5 18.169v-4.34A3.008 3.008 0 0 0 5.33 12h13.34a3.009 3.009 0 0 0 1.83 1.83v4.34A3.009 3.009 0 0 0 18.67 20H5.332A3.01 3.01 0 0 0 3.5 18.169Z"/></svg>',
    cross: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
};

// Hardcoded Plan Benefits Matching the Image
const PLAN_BENEFITS = {
    // === HIBAH NOVA ===
    nova: [
        { icon: 'skull', text: 'Kematian/Lumpuh:', value: 'RM250k' },
        { icon: 'plane', text: 'Kematian Haji/Umrah:', value: 'RM500k' },
        { icon: 'coins', text: 'Nilai Tunai (Surrender Value)', value: '' },
        { icon: 'clock', text: 'Khairat Kematian:', value: 'RM2,000' },
        { icon: 'shieldCheck', text: 'Coverage:', value: 'Sehingga Umur 60' },
        { icon: 'tag', text: 'Harga:', value: 'Tetap' }
    ],
    novaWaiver: [
        { icon: 'skull', text: 'Kematian/Lumpuh:', value: 'RM250k' },
        { icon: 'plane', text: 'Kematian Haji/Umrah:', value: 'RM500k' },
        { icon: 'coins', text: 'Nilai Tunai (Surrender Value)', value: '' },
        { icon: 'clock', text: 'Khairat Kematian:', value: 'RM2,000' },
        { icon: 'checkCircle', text: 'Waiver Sakit Kritikal', subtext: '(Dikecualikan Caruman)', highlight: true },
        { icon: 'shieldCheck', text: 'Coverage:', value: 'Sehingga Umur 60' },
        { icon: 'tag', text: 'Harga:', value: 'Tetap' }
    ],
    novaCI: [
        { icon: 'skull', text: 'Kematian/Lumpuh:', value: 'RM250k' },
        { icon: 'plane', text: 'Kematian Haji/Umrah:', value: 'RM500k' },
        { icon: 'shieldAlert', text: 'Sakit Kritikal:', value: 'RM 100,000', highlight: true },
        { icon: 'checkCircle', text: 'Waiver Sakit Kritikal', subtext: '(Dikecualikan Caruman)', highlight: true },
        { icon: 'coins', text: 'Nilai Tunai (Surrender Value)', value: '' },
        { icon: 'clock', text: 'Khairat Kematian:', value: 'RM2,000' },
        { icon: 'shieldCheck', text: 'Coverage:', value: 'Sehingga Umur 60' },
        { icon: 'tag', text: 'Harga:', value: 'Tetap' }
    ],

    // === HIBAH CHINTA ===
    chinta: [
        { icon: 'skull', text: 'Kematian/Lumpuh:', value: 'RM800k' },
        { icon: 'plane', text: 'Kematian Haji/Umrah:', value: 'RM1.6 Juta' },
        // REMOVED 'Sakit Kritikal' from here (Basic Plan)
        { icon: 'coins', text: 'Nilai Tunai (Surrender Value)', value: '' },
        { icon: 'clock', text: 'Khairat Kematian:', value: 'RM5,000' },
        { icon: 'shieldCheck', text: 'Coverage:', value: 'Sehingga Umur 60' },
        { icon: 'tag', text: 'Harga:', value: 'Tetap' }
    ],
    chintaWaiver: [
        { icon: 'skull', text: 'Kematian/Lumpuh:', value: 'RM800k' },
        { icon: 'plane', text: 'Kematian Haji/Umrah:', value: 'RM1.6 Juta' },
        // REMOVED 'Sakit Kritikal' lump sum from here (Waiver Plan usually just waives payment)
        { icon: 'checkCircle', text: 'Waiver Sakit Kritikal', subtext: '(Dikecualikan Caruman)', highlight: true },
        { icon: 'coins', text: 'Nilai Tunai (Surrender Value)', value: '' },
        { icon: 'clock', text: 'Khairat Kematian:', value: 'RM5,000' },
        { icon: 'shieldCheck', text: 'Coverage:', value: 'Sehingga Umur 60' },
        { icon: 'tag', text: 'Harga:', value: 'Tetap' }
    ],
    chintaCI: [
        { icon: 'skull', text: 'Kematian/Lumpuh:', value: 'RM800k' },
        { icon: 'plane', text: 'Kematian Haji/Umrah:', value: 'RM1.6 Juta' },
        { icon: 'shieldAlert', text: 'Sakit Kritikal:', value: 'RM100,000', highlight: true }, // KEEPS IT HERE (CI Plan)
        { icon: 'checkCircle', text: 'Waiver Sakit Kritikal', subtext: '(Dikecualikan Caruman)', highlight: true },
        { icon: 'coins', text: 'Nilai Tunai (Surrender Value)', value: '' },
        { icon: 'clock', text: 'Khairat Kematian:', value: 'RM5,000' },
        { icon: 'shieldCheck', text: 'Coverage:', value: 'Sehingga Umur 60' },
        { icon: 'tag', text: 'Harga:', value: 'Tetap' }
    ],

    // === HIBAH INSPIRASI ===
    inspirasi: [
        { icon: 'skull', text: 'Kematian/Lumpuh:', value: 'RM100k' },
        { icon: 'skull', text: 'Kematian Kemalangan:', value: 'RM200k' },
        { icon: 'shieldAlert', text: 'Sakit Kritikal:', value: 'RM50k' },
        { icon: 'bed', text: 'Elaun Wad:', value: 'RM50 / hari' },
        { icon: 'shieldCheck', text: 'Coverage:', value: 'Sehingga Umur 70' },
        { icon: 'tag', text: 'Harga:', value: 'Berubah setiap 5 tahun' }
    ]
};

const getMedicalBenefits = (roomRate, annualLimit) => [
    { id: 'hibah', icon: icons.skull, text: "Hibah Kematian/Lumpuh:", value: "RM15,000", included: 'both' },
    { id: 'bilik', icon: icons.bilik, text: "Bilik Hospital:", value: `RM${roomRate} / hari`, included: 'both' },
    { id: 'tahunan', icon: icons.tahunan, text: "Had Tahunan:", value: annualLimit, included: 'both' },
    { id: 'seumur', icon: icons.seumur, text: "Had Seumur Hidup:", value: "Tiada Had", included: 'both' },
    { id: 'kanser', icon: icons.kanser, text: "Rawatan Kanser & Dialisis", value: "(Outpatient)", included: 'both' },
    { id: 'klinik', icon: icons.klinik, text: "Rawatan Klinik 12 Penyakit", value: "(Outpatient)", included: 'both' },
    { id: 'saving', icon: icons.coins, text: "Nilai Tunai", value: "(Surrender Value)", included: 'both' },
    { id: 'deductible', icon: icons.deductible, text: "Deductible:", value: "RM500", included: 'both' },
    { id: 'waiver', icon: icons.waiver, text: "Waiver Sakit Kritikal", value: "", included: 'full' },
    { id: 'elaun', icon: icons.elaun, text: "Elaun Wad Swasta:", value: "RM100 / hari", included: 'full' }
];

// =========================
// 3. LOGIC CACHING & UI
// =========================

function updateAgentUI(data) {
    if (!data) return;

    AGENT_CONFIG = data;
    URL_HARGA_BARU = data.hargaUrl;
    URL_LEADS_LAMA = data.leadsUrl;
    window.AGENT_WHATSAPP = data.whatsapp;

    // --- CUSTOMIZE META TAGS & TITLE START ---
    
    // 1. Change the Browser Tab Title
    document.title = `Quotation Takaful - ${data.name || 'GETQUOTE'}`;

    // 2. Change the Meta Title (for sharing)
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
        ogTitle.setAttribute('content', `Dapatkan Quotation Takaful dari ${data.name}`);
    }

    // 3. Change the WhatsApp Thumbnail (Agent Photo)
    if (data.photo) {
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage) {
            ogImage.setAttribute('content', data.photo);
        }
    }
    
    const currentUrl = window.location.href;
    const ogUrlMeta = document.querySelector('meta[property="og:url"]');
    if (ogUrlMeta) {
        ogUrlMeta.setAttribute('content', currentUrl);
    }
    // --- CUSTOMIZE META TAGS END ---

    if(agentSkeleton) agentSkeleton.classList.add('hidden');

    const elAgency = document.getElementById('agent-agency');
    const elName = document.getElementById('agent-name');
    const elCompany = document.getElementById('agent-company');
    const elImg = document.getElementById('agent-img');

    if (elAgency) elAgency.textContent = data.agency || "Takaful Agent";
    if (elName) elName.textContent = data.name || "Agent Takaful";
    if (elCompany) elCompany.textContent = data.company || "Takaful Company";
    if (elImg && data.photo) {
         elImg.src = data.photo;
    }

    const socialMap = {
        'link-fb': data.facebook,
        'link-ig': data.instagram,
        'link-tt': data.tiktok,
        'link-wa': data.whatsapp ? `https://wa.me/${data.whatsapp}` : null
    };

    for (const [id, url] of Object.entries(socialMap)) {
        const el = document.getElementById(id);
        if (el) {
            if (url) {
                el.href = url;
                el.classList.remove('pointer-events-none', 'opacity-50');
            } else {
                el.href = '#';
                el.classList.add('pointer-events-none', 'opacity-50');
            }
        }
    }

    if (data.primaryColor || data.secondaryColor) {
        document.documentElement.style.setProperty('--primary-color', data.primaryColor || '#FFFFFF');
        document.documentElement.style.setProperty('--secondary-color', data.secondaryColor || '#FFFFFF');
    }
}

function processPricingData(data) {
    medicalPriceData150 = data.medical150 || [];
    medicalPriceData200 = data.medical200 || [];
    hibahPriceData.nova = data.hibahNova || [];
    hibahPriceData.novaWaiver = data.hibahNovaWaiver || [];
    hibahPriceData.novaCI = data.hibahNovaCI || [];
    hibahPriceData.chinta = data.hibahChinta || [];
    hibahPriceData.chintaWaiver = data.hibahChintaWaiver || [];
    hibahPriceData.chintaCI = data.hibahChintaCI || [];
    hibahPriceData.inspirasi = data.hibahInspirasi || [];
    hibahPriceData.evo = data.hibahEvo || [];
    isPricingLoaded = true;
    console.log("Pricing Data Ready (Source: " + (data._source || "Unknown") + ")");
}

async function fetchPricingData(url) {
    if (!url) return;
    try {
        const res = await fetch(url);
        const data = await res.json();
        data._ts = Date.now();
        data._source = "Network";
        localStorage.setItem(CACHE_KEY_PRICING, JSON.stringify(data));
        processPricingData(data);
    } catch (error) {
        console.error("Failed to fetch pricing:", error);
    }
}

async function initializeApp() {
    if (!AGENT_ID) {
        showError("Ralat: ID ejen tidak dijumpai.");
        return;
    }

    renderHibahBenefits();
    
    let hasCache = false;
    const cachedConfig = localStorage.getItem(CACHE_KEY_CONFIG);
    
    if (cachedConfig) {
        try {
            const configData = JSON.parse(cachedConfig);
            console.log("Loaded Config from Cache");
            updateAgentUI(configData);
            hasCache = true;
            
            const cachedPricing = localStorage.getItem(CACHE_KEY_PRICING);
            if (cachedPricing) {
                  try {
                      const pricingData = JSON.parse(cachedPricing);
                      const ageMs = Date.now() - (pricingData._ts || 0);
                      if (ageMs < 1 * 60 * 1000) {
                          pricingData._source = "Cache";
                          processPricingData(pricingData);
                      } else {
                          console.log("Pricing Cache Expired");
                          localStorage.removeItem(CACHE_KEY_PRICING);
                      }
                  } catch(e) { console.error("Invalid Pricing Cache"); }
            }

            if (!isPricingLoaded && configData.hargaUrl) {
                fetchPricingData(configData.hargaUrl);
            }

        } catch (e) {
            console.error("Cache Parse Error", e);
            localStorage.removeItem(CACHE_KEY_CONFIG);
        }
    } else {
        if(agentSkeleton) agentSkeleton.classList.remove('hidden');
    }

    try {
        const res = await fetch(`${CONFIG_API_URL}?agent=${encodeURIComponent(AGENT_ID)}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        localStorage.setItem(CACHE_KEY_CONFIG, JSON.stringify(data));
        updateAgentUI(data);

        if (!isPricingLoaded || (hasCache && data.hargaUrl !== URL_HARGA_BARU)) {
            fetchPricingData(data.hargaUrl);
        }

    } catch (err) {
        console.error("Network Config Error:", err);
        if (!hasCache) showError("Gagal memuatkan data. Sila refresh.");
    }
}


// =========================
// 4. HANTAR LEADS
// =========================
function submitLeadData(data) {
    if (!URL_LEADS_LAMA) return;
    fetch(URL_LEADS_LAMA, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    }).catch(e => console.error("Lead submission failed", e));
}

// =========================
// 5. HELPER FUNCTIONS
// =========================

const dobInput = document.getElementById('dob');
if (dobInput) {
    dobInput.addEventListener('input', function (e) {
        let input = e.target.value.replace(/\D/g, '');
        if (input.length > 8) input = input.substring(0, 8);
        let formatted = input;
        if (input.length > 2) formatted = input.substring(0, 2) + '/' + input.substring(2);
        if (input.length > 4) formatted = formatted.substring(0, 5) + '/' + formatted.substring(5);
        e.target.value = formatted;
    });
}

function setupIconOptions(groupName) {
    const options = document.querySelectorAll(`.${groupName}-option`);
    const hiddenInput = document.getElementById(groupName);
    options.forEach(option => {
        option.addEventListener('click', () => {
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            hiddenInput.value = option.dataset.value;
        });
    });
}

function calculateNextBirthdayAge(dob) {
    let birthDate;
    if (dob.includes('/')) {
        const parts = dob.split('/');
        birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
    } else {
        birthDate = new Date(dob);
    }
    const today = new Date();
    if (isNaN(birthDate.getTime())) return 0;
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age + 1;
}

function getPremium(item, gender, smoker) {
    if (!item) return null;
    let val = null;
    if (gender === 'perempuan') {
        if (smoker === 'tidak') {
            val = item.p || item['p waiver'] || item.P || item['P Waiver'] || item.p_waiver || item.P_Waiver;
        }
    } else {
        if (smoker === 'ya') {
            val = item.l_s || item['l_s waiver'] || item.L_S || item['L_S Waiver'] || item.l_s_waiver || item.L_S_Waiver;
        } else {
            val = item.l_ns || item['l_ns waiver'] || item.L_NS || item['L_NS Waiver'] || item.l_ns_waiver || item.L_NS_Waiver;
        }
    }
    return val;
}

function calculateMedicalCard(name, age, gender, smoker, occupation, dob, phone) {
    const priceInfo150 = medicalPriceData150.find(item => item.age == age);
    let basicPremium150 = null, fullPremium150 = null;
    if (priceInfo150) {
        if (gender === 'perempuan') {
            if (smoker === 'tidak') {
                basicPremium150 = priceInfo150.p_basic;
                fullPremium150 = priceInfo150.p_full;
            }
        } else {
            basicPremium150 = smoker === 'ya' ? priceInfo150.l_s_basic : priceInfo150.l_ns_basic;
            fullPremium150 = smoker === 'ya' ? priceInfo150.l_s_full : priceInfo150.l_ns_full;
        }
    }

    const priceInfo200 = medicalPriceData200.find(item => item.age == age);
    let basicPremium200 = null, fullPremium200 = null;
    if (priceInfo200) {
        if (gender === 'perempuan') {
            if (smoker === 'tidak') {
                basicPremium200 = priceInfo200.p_basic;
                fullPremium200 = priceInfo200.p_full;
            }
        } else {
            basicPremium200 = smoker === 'ya' ? priceInfo200.l_s_basic : priceInfo200.l_ns_basic;
            fullPremium200 = smoker === 'ya' ? priceInfo200.l_s_full : priceInfo200.l_ns_full;
        }
    }

    if (!priceInfo150 || !priceInfo200) {
        showError(`Maaf, tiada data harga Medical Card untuk umur ${age} tahun.`);
        return;
    }

    quotationData = { 
        name, dob, phone, occupation, gender, smoker, nextBirthdayAge: age, 
        basicPremium150, fullPremium150, basicPremium200, fullPremium200, 
        planType: 'medical' 
    };

    document.getElementById('resultNameMC').textContent = name;
    document.getElementById('resultAgeMC').textContent = age;

    document.getElementById('basicMonthly150').textContent = basicPremium150 ? basicPremium150.toFixed(2) : "N/A";
    document.getElementById('fullMonthly150').textContent = fullPremium150 ? fullPremium150.toFixed(2) : "N/A";
    document.getElementById('basicMonthly200').textContent = basicPremium200 ? basicPremium200.toFixed(2) : "N/A";
    document.getElementById('fullMonthly200').textContent = fullPremium200 ? fullPremium200.toFixed(2) : "N/A";

    document.getElementById('selectBasicBtn150').disabled = !basicPremium150;
    document.getElementById('selectFullBtn150').disabled = !fullPremium150;
    document.getElementById('selectBasicBtn200').disabled = !basicPremium200;
    document.getElementById('selectFullBtn200').disabled = !fullPremium200;

    medicalResultDiv.classList.add('is-visible');
    medicalResultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function calculateHibah(name, age, gender, smoker, occupation, dob, phone) {
    let novaPremium = null;
    let novaWaiverPremium = null;
    let novaCIPremium = null;

    if (age <= 60) {
        const novaAge = age < 25 ? 25 : age;
        const novaPriceInfo = hibahPriceData.nova.find(item => item.age == novaAge);
        novaPremium = getPremium(novaPriceInfo, gender, smoker);

        const novaWaiverInfo = (hibahPriceData.novaWaiver || []).find(item => item.age == novaAge);
        novaWaiverPremium = getPremium(novaWaiverInfo, gender, smoker);

        const novaCIInfo = (hibahPriceData.novaCI || []).find(item => item.age == novaAge);
        novaCIPremium = getPremium(novaCIInfo, gender, smoker);
    }

    document.getElementById('novaMonthly').textContent = novaPremium ? novaPremium.toFixed(2) : "N/A";
    document.getElementById('selectNovaBtn').disabled = !novaPremium;

    const novaCheck = document.getElementById('novaWaiverCheck');
    const novaContainer = document.getElementById('novaCheckContainer');
    const novaLabel = document.getElementById('novaCheckLabel');

    const novaCICheck = document.getElementById('novaCICheck');
    const novaCIContainer = document.getElementById('novaCICheckContainer');
    const novaCILabel = document.getElementById('novaCICheckLabel');

    if (novaCheck) novaCheck.checked = false;
    if (novaCICheck) novaCICheck.checked = false;

    if (novaCheck) {
        if (!novaWaiverPremium) {
            novaCheck.disabled = true;
            if (novaContainer) novaContainer.classList.add('checkbox-disabled');
            if (novaLabel) novaLabel.textContent = "Add-on Waiver (Tidak Ditawarkan)";
        } else {
            novaCheck.disabled = false;
            if (novaContainer) novaContainer.classList.remove('checkbox-disabled');
            if (novaLabel) novaLabel.textContent = "Add-on Waiver";
        }
    }

    if (novaCICheck) {
        if (!novaCIPremium) {
            novaCICheck.disabled = true;
            if (novaCIContainer) novaCIContainer.classList.add('checkbox-disabled');
            if (novaCILabel) novaCILabel.textContent = "Add-on CI + Waiver (Tidak Ditawarkan)";
        } else {
            novaCICheck.disabled = false;
            if (novaCIContainer) novaCIContainer.classList.remove('checkbox-disabled');
            if (novaCILabel) novaCILabel.textContent = "Add-on CI + Waiver";
        }
    }

    let chintaPremium = null;
    let chintaWaiverPremium = null;
    let chintaCIPremium = null;

    if (age <= 60) {
        const chintaAge = age < 20 ? 20 : age;
        const chintaPriceInfo = hibahPriceData.chinta.find(item => item.age == chintaAge);
        chintaPremium = getPremium(chintaPriceInfo, gender, smoker);

        const chintaWaiverInfo = (hibahPriceData.chintaWaiver || []).find(item => item.age == chintaAge);
        chintaWaiverPremium = getPremium(chintaWaiverInfo, gender, smoker);

        const chintaCIInfo = (hibahPriceData.chintaCI || []).find(item => item.age == chintaAge);
        chintaCIPremium = getPremium(chintaCIInfo, gender, smoker);
    }

    document.getElementById('chintaMonthly').textContent = chintaPremium ? chintaPremium.toFixed(2) : "N/A";
    document.getElementById('selectChintaBtn').disabled = !chintaPremium;

    const chintaCheck = document.getElementById('chintaWaiverCheck');
    const chintaContainer = document.getElementById('chintaCheckContainer');
    const chintaLabel = document.getElementById('chintaCheckLabel');

    const chintaCICheck = document.getElementById('chintaCICheck');
    const chintaCIContainer = document.getElementById('chintaCICheckContainer');
    const chintaCILabel = document.getElementById('chintaCILabel');

    if (chintaCheck) chintaCheck.checked = false;
    if (chintaCICheck) chintaCICheck.checked = false;

    if (chintaCheck) {
        if (!chintaWaiverPremium) {
            chintaCheck.disabled = true;
            if (chintaContainer) chintaContainer.classList.add('checkbox-disabled');
            if (chintaLabel) chintaLabel.textContent = "Add-on Waiver (Tidak Ditawarkan)";
        } else {
            chintaCheck.disabled = false;
            if (chintaContainer) chintaContainer.classList.remove('checkbox-disabled');
            if (chintaLabel) chintaLabel.textContent = "Add-on Waiver";
        }
    }

    if (chintaCICheck) {
        if (!chintaCIPremium) {
            chintaCICheck.disabled = true;
            if (chintaCIContainer) chintaCIContainer.classList.add('checkbox-disabled');
            if (chintaCILabel) chintaCILabel.textContent = "Add-on CI + Waiver (Tidak Ditawarkan)";
        } else {
            chintaCICheck.disabled = false;
            if (chintaCIContainer) chintaCIContainer.classList.remove('checkbox-disabled');
            if (chintaCILabel) chintaCILabel.textContent = "Add-on CI + Waiver";
        }
    }

    const inspirasiPriceInfo = hibahPriceData.inspirasi.find(item => item.age == age);
    let inspirasiPremium = null;
    if (inspirasiPriceInfo) {
        if (gender === 'perempuan') {
            inspirasiPremium = smoker === 'ya' ? inspirasiPriceInfo.p_s : inspirasiPriceInfo.p_ns;
        } else {
            inspirasiPremium = smoker === 'ya' ? inspirasiPriceInfo.l_s : inspirasiPriceInfo.l_ns;
        }
    }
    document.getElementById('inspirasiMonthly').textContent = inspirasiPremium ? inspirasiPremium.toFixed(2) : "N/A";
    document.getElementById('selectInspirasiBtn').disabled = !inspirasiPremium;

    let evo50Value = 0;
    if (hibahPriceData.evo && hibahPriceData.evo.length > 0) {
        const evoData = hibahPriceData.evo.find(item => item.age == age);
        if (evoData) {
            if (gender === 'perempuan') {
                evo50Value = evoData.rm50_p;
            } else {
                evo50Value = smoker === 'ya' ? evoData.rm50_ls : evoData.rm50_lns;
            }
        }
    }
    document.getElementById('evo50Value').textContent = evo50Value.toLocaleString();

    quotationData = {
        name, dob, phone, occupation, gender, smoker, nextBirthdayAge: age,
        novaPremium, novaWaiverPremium, novaCIPremium,
        chintaPremium, chintaWaiverPremium, chintaCIPremium,
        inspirasiPremium,
        evo50Value,
        planType: 'hibah'
    };

    renderSingleHibahBenefit('nova', 'nova');
    renderSingleHibahBenefit('chinta', 'chinta');
    renderSingleHibahBenefit('inspirasi', 'inspirasi');


    document.getElementById('resultNameHibah').textContent = name;
    document.getElementById('resultAgeHibah').textContent = age;
    hibahResultDiv.classList.add('is-visible');
    hibahResultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateNovaCard(e) {
    const isWaiver = document.getElementById('novaWaiverCheck').checked;
    const isCI = document.getElementById('novaCICheck').checked;
    const priceDisplay = document.getElementById('novaMonthly');

    if (e && e.target.id === 'novaCICheck' && isCI) {
        document.getElementById('novaWaiverCheck').checked = false;
    } else if (e && e.target.id === 'novaWaiverCheck' && isWaiver) {
        document.getElementById('novaCICheck').checked = false;
    }

    const finalWaiver = document.getElementById('novaWaiverCheck').checked;
    const finalCI = document.getElementById('novaCICheck').checked;

    if (finalCI && quotationData.novaCIPremium) {
        priceDisplay.textContent = quotationData.novaCIPremium.toFixed(2);
        renderSingleHibahBenefit('nova', 'novaCI');
    } else if (finalWaiver && quotationData.novaWaiverPremium) {
        priceDisplay.textContent = quotationData.novaWaiverPremium.toFixed(2);
        renderSingleHibahBenefit('nova', 'novaWaiver');
    } else if (quotationData.novaPremium) {
        priceDisplay.textContent = quotationData.novaPremium.toFixed(2);
        renderSingleHibahBenefit('nova', 'nova');
    }
}

function updateChintaCard(e) {
    const isWaiver = document.getElementById('chintaWaiverCheck').checked;
    const isCI = document.getElementById('chintaCICheck').checked;
    const priceDisplay = document.getElementById('chintaMonthly');

    if (e && e.target.id === 'chintaCICheck' && isCI) {
        document.getElementById('chintaWaiverCheck').checked = false;
    } else if (e && e.target.id === 'chintaWaiverCheck' && isWaiver) {
        document.getElementById('chintaCICheck').checked = false;
    }

    const finalWaiver = document.getElementById('chintaWaiverCheck').checked;
    const finalCI = document.getElementById('chintaCICheck').checked;

    if (finalCI && quotationData.chintaCIPremium) {
        priceDisplay.textContent = quotationData.chintaCIPremium.toFixed(2);
        renderSingleHibahBenefit('chinta', 'chintaCI');
    } else if (finalWaiver && quotationData.chintaWaiverPremium) {
        priceDisplay.textContent = quotationData.chintaWaiverPremium.toFixed(2);
        renderSingleHibahBenefit('chinta', 'chintaWaiver');
    } else if (quotationData.chintaPremium) {
        priceDisplay.textContent = quotationData.chintaPremium.toFixed(2);
        renderSingleHibahBenefit('chinta', 'chinta');
    }
}

document.getElementById('novaWaiverCheck').addEventListener('change', updateNovaCard);
document.getElementById('novaCICheck').addEventListener('change', updateNovaCard);
document.getElementById('chintaWaiverCheck').addEventListener('change', updateChintaCard);
document.getElementById('chintaCICheck').addEventListener('change', updateChintaCard);

function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

function handleFormSubmit() {
    if (!isPricingLoaded) {
        const btn = document.getElementById('calculateBtn');
        btn.innerHTML = '<div class="loader"></div> SEDANG MEMPROSES...';
        setTimeout(() => {
             if(!isPricingLoaded) {
                showError("Data harga sedang dimuat turun dari server. Sila cuba sebentar lagi.");
                btn.innerHTML = 'GET QUOTATION';
             } else {
                 handleFormSubmit();
             }
        }, 1500);
        return;
    }

    if (medicalResultDiv) medicalResultDiv.classList.remove('is-visible');
    if (hibahResultDiv) hibahResultDiv.classList.remove('is-visible');
    if (errorMessageDiv) errorMessageDiv.classList.add('hidden');

    const planType = getVal('planType');
    const name = getVal('name');
    const dob = getVal('dob');
    const phone = getVal('phone');
    const gender = getVal('gender');
    const smoker = getVal('smoker');
    const occupation = getVal('occupation');

    if (!planType || !name || !dob || !phone || !gender || !smoker || !occupation) {
        showError("Sila lengkapkan semua butiran di dalam borang (Pastikan anda memilih ikon Pelan, Jantina dan Status Merokok).");
        return;
    }

    const nextBirthdayAge = calculateNextBirthdayAge(dob);
    if (nextBirthdayAge < 1 || nextBirthdayAge > 60) {
        showError("Maaf, sebut harga hanya tersedia untuk umur antara 1 hingga 60 tahun.");
        return;
    }

    if (planType === 'medical') {
        calculateMedicalCard(name, nextBirthdayAge, gender, smoker, occupation, dob, phone);
    } else if (planType === 'hibah') {
        calculateHibah(name, nextBirthdayAge, gender, smoker, occupation, dob, phone);
    }
    
    document.getElementById('calculateBtn').innerHTML = 'GET QUOTATION';

    submitLeadData({ planType, name, dob, phone, gender, smoker, occupation, agentId: AGENT_ID });
}

if (form) {
    form.addEventListener('submit', function (event) {
        event.preventDefault();
        handleFormSubmit();
    });
}

function sendWhatsAppMessage(planName, premiumOrValue) {
    if (Object.keys(quotationData).length === 0) return;
    const data = quotationData;
    let benefitsText = "";
    let message = "";

    if (planName.includes("Hibah Evo")) {
        const sumAssured = premiumOrValue;
        let evoBenefits = "";
        evoBenefits += `\n- Kematian/Lumpuh: RM${sumAssured.toLocaleString()}`;
        evoBenefits += `\n- Nilai Tunai (Surrender Value)`;
        evoBenefits += `\n- Khairat Kematian: RM2,000`;
        evoBenefits += `\n- Coverage: Sehingga Umur 80`;
        evoBenefits += `\n- Harga: Tetap`;

        message = `Salam, saya berminat dengan Pakej Takaful - GETQUOTE.\n\nBerikut adalah butiran saya:\n*Nama:* ${data.name}\n*Umur Seterusnya:* ${data.nextBirthdayAge} Tahun\n*Nombor Telefon:* ${data.phone}\n*Pekerjaan:* ${data.occupation}\n*Jantina:* ${data.gender.charAt(0).toUpperCase() + data.gender.slice(1)}\n*Status Merokok:* ${data.smoker.charAt(0).toUpperCase() + data.smoker.slice(1)}\n\n*Pakej Pilihan:* ${planName}\n*Caruman Bulanan:* RM50.00\n\n*Manfaat Pelan:*\n${evoBenefits}\n\nBoleh bantu saya untuk langkah seterusnya? Terima kasih.`;
    } else {
        if (!premiumOrValue) return;

        if (data.planType === 'medical') {
            let roomRate, annualLimit, isFullPlan;
            if (planName.includes('150')) {
                roomRate = 150;
                annualLimit = 'RM1.5 Juta';
            } else {
                roomRate = 200;
                annualLimit = 'RM2.0 Juta';
            }
            isFullPlan = planName.includes('Premium');
            const benefits = getMedicalBenefits(roomRate, annualLimit);
            benefits.forEach(b => {
                const includeBenefit = b.included === 'both' || (b.included === 'full' && isFullPlan);
                if (includeBenefit) {
                    benefitsText += `\n- ${b.text} ${b.value || ''}`;
                }
            });
        } else if (data.planType === 'hibah') {
            let planKey;
            if (planName === 'Hibah Nova') planKey = 'nova';
            else if (planName === 'Hibah Nova (Waiver)') planKey = 'novaWaiver';
            else if (planName === 'Hibah Nova (Add-on CI + Waiver)') planKey = 'novaCI';
            else if (planName === 'Hibah Chinta') planKey = 'chinta';
            else if (planName === 'Hibah Chinta (Waiver)') planKey = 'chintaWaiver';
            else if (planName === 'Hibah Chinta (Add-on CI + Waiver)') planKey = 'chintaCI';
            else if (planName.includes('Inspirasi')) planKey = 'inspirasi';

            if (planKey) {
                const benefits = PLAN_BENEFITS[planKey];
                if (benefits) {
                    benefits.forEach(b => {
                        benefitsText += `\n- ${b.text} ${b.value || ''}`;
                    });
                }
            }
        }
        message = `Salam, saya berminat dengan Pakej Takaful - GETQUOTE.\n\nBerikut adalah butiran saya:\n*Nama:* ${data.name}\n*Umur Seterusnya:* ${data.nextBirthdayAge} Tahun\n*Nombor Telefon:* ${data.phone}\n*Pekerjaan:* ${data.occupation}\n*Jantina:* ${data.gender.charAt(0).toUpperCase() + data.gender.slice(1)}\n*Status Merokok:* ${data.smoker.charAt(0).toUpperCase() + data.smoker.slice(1)}\n\n*Pakej Pilihan:* ${planName}\n*Caruman Bulanan:* RM${typeof premiumOrValue === 'number' ? premiumOrValue.toFixed(2) : premiumOrValue}\n\n*Manfaat Pelan:*\n${benefitsText}\n\nBoleh bantu saya untuk langkah seterusnya? Terima kasih.`;
    }
    const targetPhone = (window.AGENT_WHATSAPP || "60173225153").replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

document.getElementById('selectNovaBtn').addEventListener('click', () => {
    const isWaiver = document.getElementById('novaWaiverCheck').checked;
    const isCI = document.getElementById('novaCICheck').checked;
    if (isCI) sendWhatsAppMessage('Hibah Nova (Add-on CI + Waiver)', quotationData.novaCIPremium);
    else if (isWaiver) sendWhatsAppMessage('Hibah Nova (Waiver)', quotationData.novaWaiverPremium);
    else sendWhatsAppMessage('Hibah Nova', quotationData.novaPremium);
});

document.getElementById('selectChintaBtn').addEventListener('click', () => {
    const isWaiver = document.getElementById('chintaWaiverCheck').checked;
    const isCI = document.getElementById('chintaCICheck').checked;
    if (isCI) sendWhatsAppMessage('Hibah Chinta (Add-on CI + Waiver)', quotationData.chintaCIPremium);
    else if (isWaiver) sendWhatsAppMessage('Hibah Chinta (Waiver)', quotationData.chintaWaiverPremium);
    else sendWhatsAppMessage('Hibah Chinta', quotationData.chintaPremium);
});

document.getElementById('selectInspirasiBtn')
  .addEventListener('click', () =>
    sendWhatsAppMessage('Hibah Inspirasi', quotationData.inspirasiPremium)
  );

document.getElementById('selectEvo50Btn')
  .addEventListener('click', () =>
    sendWhatsAppMessage('Hibah Evo 50', quotationData.evo50Value)
  );

document.getElementById('selectBasicBtn150')
  .addEventListener('click', () =>
    sendWhatsAppMessage('Plan Basic Evolusi 150', quotationData.basicPremium150)
  );

document.getElementById('selectFullBtn150')
  .addEventListener('click', () =>
    sendWhatsAppMessage('Plan Premium Evolusi 150', quotationData.fullPremium150)
  );

document.getElementById('selectBasicBtn200')
  .addEventListener('click', () =>
    sendWhatsAppMessage('Plan Basic Evolusi 200', quotationData.basicPremium200)
  );

document.getElementById('selectFullBtn200')
  .addEventListener('click', () =>
    sendWhatsAppMessage('Plan Premium Evolusi 200', quotationData.fullPremium200)
  );


setupIconOptions('planType');
setupIconOptions('gender');
setupIconOptions('smoker');

function renderMedicalBenefits(containerId, roomRate, annualLimit) {
    const container = document.getElementById(containerId);
    const benefits = getMedicalBenefits(roomRate, annualLimit);
    container.innerHTML = '';
    const isBasic = containerId.includes('basic');
    const isPlan200 = roomRate === 200;
    benefits.forEach(b => {
        const iconColor = b.id === 'deductible' ? 'text-corporate-secondary-blue-text' : 'text-black-600';
        const iconWrapper = `<div class="icon-wrapper w-9 h-9 rounded-full ${iconColor}">${b.icon}</div>`;
        let valueHtml;
        if (isPlan200 && (b.id === 'bilik' || b.id === 'tahunan')) {
            valueHtml = `<strong class="highlight-benefit">${b.value}</strong>`;
        } else {
            valueHtml = `<strong>${b.value}</strong>`;
        }
        if (b.included === 'both' || (b.included === 'full' && !isBasic)) {
            container.innerHTML += `<div class="benefit-item">${iconWrapper}<div>${b.text} ${valueHtml}</div></div>`;
        } else if (isBasic && b.included === 'full') {
            container.innerHTML += `<div class="benefit-item text-gray-400 line-through"><div class="icon-wrapper w-9 h-9 rounded-full bg-gray-200 text-gray-500">${icons.cross}</div><div>${b.text} <strong>${b.value}</strong></div></div>`;
        }
    });
}

function renderAllMedicalBenefits() {
    renderMedicalBenefits('basic-benefits-150', 150, 'RM1.5 Juta');
    renderMedicalBenefits('full-benefits-150', 150, 'RM1.5 Juta');
    renderMedicalBenefits('basic-benefits-200', 200, 'RM2.0 Juta');
    renderMedicalBenefits('full-benefits-200', 200, 'RM2.0 Juta');
}

// =========================================================================
// RENDER HIBAH BENEFITS (UPDATED WITH HIGHLIGHT LOGIC)
// =========================================================================
function renderSingleHibahBenefit(containerKey, benefitsKey) {
  const container = document.getElementById(`${containerKey}-benefits`);
  const benefits = PLAN_BENEFITS[benefitsKey] || [];
  if (!container) return;

  container.innerHTML = '';

  benefits.forEach(b => {
    const iconSvg = icons[b.icon] || icons.shieldCheck || '';
    
    // Normal Icon Style
    let iconWrapper = `<div class="icon-wrapper w-9 h-9 rounded-full bg-blue-100 text-corporate-secondary-blue-text" style="background-color: #dbeafe !important;">${iconSvg}</div>`;
    
    // Check if highlight (yellow box) is needed
    let itemClass = "benefit-item";
    if (b.highlight) {
        itemClass += " bg-yellow-50 border border-yellow-200 rounded-lg p-2 -mx-2 mb-2";
    }

    const valueHtml = b.value ? `<strong>${b.value}</strong>` : '';
    const subtextHtml = b.subtext ? `<div class="text-xs text-blue-600 font-bold">${b.subtext}</div>` : '';

    container.innerHTML += `
        <div class="${itemClass}">
            ${iconWrapper}
            <div>
                <div>${b.text} ${valueHtml}</div>
                ${subtextHtml}
            </div>
        </div>
    `;
  });
}

function renderHibahBenefits() {
    renderSingleHibahBenefit('inspirasi', 'inspirasi');
    renderSingleHibahBenefit('nova', 'nova');
    renderSingleHibahBenefit('chinta', 'chinta');
}

renderAllMedicalBenefits();

function autoRecalculateIfVisible() {
    const isMCVisible = medicalResultDiv && medicalResultDiv.classList.contains('is-visible');
    const isHVisible = hibahResultDiv && hibahResultDiv.classList.contains('is-visible');
    if (!isMCVisible && !isHVisible) return;

    const planType = getVal('planType');
    const name = getVal('name');
    const dob = getVal('dob');
    const phone = getVal('phone');
    const gender = getVal('gender');
    const smoker = getVal('smoker');
    const occupation = getVal('occupation');
    const nextBirthdayAge = calculateNextBirthdayAge(dob);

    if (!planType || !name || !dob || !phone || !gender || !smoker || !occupation) return;
    if (nextBirthdayAge < 1 || nextBirthdayAge > 60) return;

    if (planType === 'medical') calculateMedicalCard(name, nextBirthdayAge, gender, smoker, occupation, dob, phone);
    if (planType === 'hibah') calculateHibah(name, nextBirthdayAge, gender, smoker, occupation, dob, phone);
}

// =========================
// 6. BOOTSTRAP: INITIALIZE APP
// =========================
window.addEventListener('DOMContentLoaded', initializeApp);