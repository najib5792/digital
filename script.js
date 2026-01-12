// =========================
// 1. CONFIG AGEN & DETECT SLUG
// =========================

const CONFIG_API_URL = "https://script.google.com/macros/s/AKfycbxBgNRcxnJg9DM0jn91REAucFDi3VuWGZ5KaCow7fPypuF80ga3e8fQSfajMW7TsCbr/exec";

// =========================
// PLAN CONFIGURATION (CONFIG-DRIVEN)
// =========================
// HOW TO ADD A NEW PLAN:
// 1. Add an entry to HIBAH_PLAN_CONFIG with a unique key (e.g., 'newPlan')
// 2. Ensure your pricing data source includes the corresponding keys (e.g., 'hibahNewPlan')
// 3. Add benefits to PLAN_BENEFITS using the same key
// 4. Add corresponding HTML elements in index.html with matching IDs
//
// HOW TO DELETE A PLAN:
// 1. Remove the plan's entry from HIBAH_PLAN_CONFIG
// 2. Remove corresponding entries from PLAN_BENEFITS
// 3. Remove or hide the corresponding HTML elements
// =========================

const HIBAH_PLAN_CONFIG = {
    // Each plan key maps to its configuration
    // =========================================
    // HIBAH NOVA 150 - Lower coverage option
    // =========================================
    nova150: {
        displayName: 'Hibah Nova 150',
        pricingKey: 'hibahNova150',         // Key in pricing data from API
        minAge: 1,                           // Minimum age (no adjustment needed)
        maxAge: 60,                          // Maximum age for eligibility
        priceElementId: 'nova150Monthly',    // ID of price display element
        selectBtnId: 'selectNova150Btn',     // ID of select button
        benefitsContainerId: 'nova150-benefits', // ID of benefits container
        variants: {
            waiver: {
                pricingKey: 'hibahNova150Waiver',
                checkboxId: 'nova150WaiverCheck',
                containerId: 'nova150CheckContainer',
                labelId: 'nova150CheckLabel',
                benefitsKey: 'nova150Waiver',
                label: 'Add-on Waiver',
                disabledLabel: 'Add-on Waiver'
            },
            ci: {
                pricingKey: 'hibahNova150CI',
                checkboxId: 'nova150CICheck',
                containerId: 'nova150CICheckContainer',
                labelId: 'nova150CICheckLabel',
                benefitsKey: 'nova150CI',
                label: 'Add-on CI + Waiver',
                disabledLabel: 'Add-on CI + Waiver'
            }
        },
        customPricingFn: null,
        premiumKey: 'nova150Premium'
    },
    // =========================================
    // HIBAH NOVA - Standard coverage
    // =========================================
    nova: {
        displayName: 'Hibah Nova',
        pricingKey: 'hibahNova',           // Key in pricing data from API
        minAge: 25,                         // Minimum age (younger ages use this)
        maxAge: 60,                         // Maximum age for eligibility
        priceElementId: 'novaMonthly',      // ID of price display element
        selectBtnId: 'selectNovaBtn',       // ID of select button
        benefitsContainerId: 'nova-benefits', // ID of benefits container
        // Variants (add-ons) - set to null if not available
        variants: {
            waiver: {
                pricingKey: 'hibahNovaWaiver',
                checkboxId: 'novaWaiverCheck',
                containerId: 'novaCheckContainer',
                labelId: 'novaCheckLabel',
                benefitsKey: 'novaWaiver',
                label: 'Add-on Waiver',
                disabledLabel: 'Add-on Waiver'
            },
            ci: {
                pricingKey: 'hibahNovaCI',
                checkboxId: 'novaCICheck',
                containerId: 'novaCICheckContainer',
                labelId: 'novaCICheckLabel',
                benefitsKey: 'novaCI',
                label: 'Add-on CI + Waiver',
                disabledLabel: 'Add-on CI + Waiver'
            }
        },
        // Special pricing function (null = use standard getPremium)
        customPricingFn: null,
        // quotationData key prefix for storing premiums
        premiumKey: 'novaPremium'
    },
    chinta: {
        displayName: 'Hibah Chinta',
        pricingKey: 'hibahChinta',
        minAge: 20,
        maxAge: 60,
        priceElementId: 'chintaMonthly',
        selectBtnId: 'selectChintaBtn',
        benefitsContainerId: 'chinta-benefits',
        variants: {
            waiver: {
                pricingKey: 'hibahChintaWaiver',
                checkboxId: 'chintaWaiverCheck',
                containerId: 'chintaCheckContainer',
                labelId: 'chintaCheckLabel',
                benefitsKey: 'chintaWaiver',
                label: 'Add-on Waiver',
                disabledLabel: 'Add-on Waiver'
            },
            ci: {
                pricingKey: 'hibahChintaCI',
                checkboxId: 'chintaCICheck',
                containerId: 'chintaCICheckContainer',
                labelId: 'chintaCILabel',
                benefitsKey: 'chintaCI',
                label: 'Add-on CI + Waiver',
                disabledLabel: 'Add-on CI + Waiver'
            }
        },
        customPricingFn: null,
        premiumKey: 'chintaPremium'
    },
    inspirasi: {
        displayName: 'Hibah Inspirasi',
        pricingKey: 'hibahInspirasi',
        minAge: null,                       // No minimum age adjustment
        maxAge: 70,
        priceElementId: 'inspirasiMonthly',
        selectBtnId: 'selectInspirasiBtn',
        benefitsContainerId: 'inspirasi-benefits',
        variants: null,                     // No variants for this plan
        // Custom pricing function for Inspirasi (different column names)
        customPricingFn: 'inspirasi',
        premiumKey: 'inspirasiPremium'
    },
    evo: {
        displayName: 'Hibah Evo',
        pricingKey: 'hibahEvo',
        minAge: null,
        maxAge: 80,
        priceElementId: 'evo50Value',
        selectBtnId: 'selectEvo50Btn',
        benefitsContainerId: null,          // Evo doesn't use benefits container
        variants: null,
        customPricingFn: 'evo',             // Special pricing for Evo
        premiumKey: 'evo50Value',
        isValueNotPremium: true             // This shows sum assured, not premium
    }
};

// Mapping from API pricing keys to internal hibahPriceData keys
// This allows the processPricingData function to dynamically map data
const PRICING_KEY_MAP = {};
Object.keys(HIBAH_PLAN_CONFIG).forEach(planKey => {
    const config = HIBAH_PLAN_CONFIG[planKey];
    // Map main plan
    PRICING_KEY_MAP[config.pricingKey] = planKey;
    // Map variants using their benefitsKey for consistency
    if (config.variants) {
        Object.keys(config.variants).forEach(variantKey => {
            const variant = config.variants[variantKey];
            // e.g., 'hibahNovaWaiver' -> 'novaWaiver'
            PRICING_KEY_MAP[variant.pricingKey] = variant.benefitsKey;
        });
    }
});

function getAgentIdFromPath() {
    const hostname = window.location.hostname;

    // 1. Abaikan localhost/google preview (Return NULL supaya jadi Landing Page secara default di local)
    // Kalau nak test ejen di local, baru hardcode sementara. UNTUK DEPLOY, BIAR NULL.
    if (hostname.includes('googleusercontent') || hostname.includes('localhost')) {
        return null;
    }

    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);

    // 2. Jika tiada path (contoh: getquote.my/), return NULL -> Landing Page
    if (!parts.length) return null;

    const candidate = parts[parts.length - 1].toLowerCase();

    // 3. Jika URL berakhir dengan index.html, return NULL -> Landing Page
    if (candidate.includes('index.html') || candidate.includes('preview')) return null;

    return candidate; // Ini akan jadi ID ejen (contoh: 'najib')
}

// === LOGIC STICKY AGENT ID ===
let detectedId = getAgentIdFromPath();
const STORAGE_KEY_AGENT = 'preferred_agent_id';

if (detectedId && detectedId !== 'null') {
    localStorage.setItem(STORAGE_KEY_AGENT, detectedId);
} else {
    detectedId = null;
}

const AGENT_ID = detectedId;
const CACHE_KEY_CONFIG = `agent_config_${AGENT_ID || 'default'}`;
const CACHE_KEY_PRICING = `pricing_data_${AGENT_ID || 'default'}`;

console.log("Current Agent ID:", AGENT_ID);

let URL_HARGA_BARU = "";
let URL_LEADS_LAMA = "";
let AGENT_CONFIG = null;
window.AGENT_WHATSAPP = null;

let medicalPriceData150 = [];
let medicalPriceData200 = [];
// Dynamically initialize hibahPriceData based on PRICING_KEY_MAP
// New plans are automatically included when added to HIBAH_PLAN_CONFIG
let hibahPriceData = {};
Object.values(PRICING_KEY_MAP).forEach(key => { hibahPriceData[key] = []; });
let isPricingLoaded = false;

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

const PLAN_BENEFITS = {
    // =========================================
    // HIBAH NOVA 150 BENEFITS
    // =========================================
    nova150: [
        { icon: 'skull', text: 'Kematian/Lumpuh:', value: 'RM150k' },
        { icon: 'plane', text: 'Kematian Haji/Umrah:', value: 'RM300k' },
        { icon: 'coins', text: 'Nilai Tunai (Surrender Value)', value: '' },
        { icon: 'clock', text: 'Khairat Kematian:', value: 'RM2,000' },
        { icon: 'shieldCheck', text: 'Coverage:', value: 'Sehingga Umur 60' },
        { icon: 'tag', text: 'Harga:', value: 'Tetap' }
    ],
    nova150Waiver: [
        { icon: 'skull', text: 'Kematian/Lumpuh:', value: 'RM150k' },
        { icon: 'plane', text: 'Kematian Haji/Umrah:', value: 'RM300k' },
        { icon: 'coins', text: 'Nilai Tunai (Surrender Value)', value: '' },
        { icon: 'clock', text: 'Khairat Kematian:', value: 'RM2,000' },
        { icon: 'checkCircle', text: 'Waiver Sakit Kritikal', subtext: '(Dikecualikan Caruman)', highlight: true },
        { icon: 'shieldCheck', text: 'Coverage:', value: 'Sehingga Umur 60' },
        { icon: 'tag', text: 'Harga:', value: 'Tetap' }
    ],
    nova150CI: [
        { icon: 'skull', text: 'Kematian/Lumpuh:', value: 'RM150k' },
        { icon: 'plane', text: 'Kematian Haji/Umrah:', value: 'RM300k' },
        { icon: 'shieldAlert', text: 'Sakit Kritikal:', value: 'RM100,000', highlight: true },
        { icon: 'checkCircle', text: 'Waiver Sakit Kritikal', subtext: '(Dikecualikan Caruman)', highlight: true },
        { icon: 'coins', text: 'Nilai Tunai (Surrender Value)', value: '' },
        { icon: 'clock', text: 'Khairat Kematian:', value: 'RM2,000' },
        { icon: 'shieldCheck', text: 'Coverage:', value: 'Sehingga Umur 60' },
        { icon: 'tag', text: 'Harga:', value: 'Tetap' }
    ],
    // =========================================
    // HIBAH NOVA BENEFITS (Standard)
    // =========================================
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
    chinta: [
        { icon: 'skull', text: 'Kematian/Lumpuh:', value: 'RM800k' },
        { icon: 'plane', text: 'Kematian Haji/Umrah:', value: 'RM1.6 Juta' },
        { icon: 'coins', text: 'Nilai Tunai (Surrender Value)', value: '' },
        { icon: 'clock', text: 'Khairat Kematian:', value: 'RM5,000' },
        { icon: 'shieldCheck', text: 'Coverage:', value: 'Sehingga Umur 60' },
        { icon: 'tag', text: 'Harga:', value: 'Tetap' }
    ],
    chintaWaiver: [
        { icon: 'skull', text: 'Kematian/Lumpuh:', value: 'RM800k' },
        { icon: 'plane', text: 'Kematian Haji/Umrah:', value: 'RM1.6 Juta' },
        { icon: 'checkCircle', text: 'Waiver Sakit Kritikal', subtext: '(Dikecualikan Caruman)', highlight: true },
        { icon: 'coins', text: 'Nilai Tunai (Surrender Value)', value: '' },
        { icon: 'clock', text: 'Khairat Kematian:', value: 'RM5,000' },
        { icon: 'shieldCheck', text: 'Coverage:', value: 'Sehingga Umur 60' },
        { icon: 'tag', text: 'Harga:', value: 'Tetap' }
    ],
    chintaCI: [
        { icon: 'skull', text: 'Kematian/Lumpuh:', value: 'RM800k' },
        { icon: 'plane', text: 'Kematian Haji/Umrah:', value: 'RM1.6 Juta' },
        { icon: 'shieldAlert', text: 'Sakit Kritikal:', value: 'RM100,000', highlight: true },
        { icon: 'checkCircle', text: 'Waiver Sakit Kritikal', subtext: '(Dikecualikan Caruman)', highlight: true },
        { icon: 'coins', text: 'Nilai Tunai (Surrender Value)', value: '' },
        { icon: 'clock', text: 'Khairat Kematian:', value: 'RM5,000' },
        { icon: 'shieldCheck', text: 'Coverage:', value: 'Sehingga Umur 60' },
        { icon: 'tag', text: 'Harga:', value: 'Tetap' }
    ],
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

    document.title = `Quotation Takaful - ${data.name || 'GETQUOTE'}`;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', `Dapatkan Quotation Takaful dari ${data.name}`);

    if (data.photo) {
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage) ogImage.setAttribute('content', data.photo);
    }

    if (agentSkeleton) agentSkeleton.classList.add('hidden');

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

    // UPDATE WARNA DARI CONFIG SHEET
    if (data.primaryColor) {
        document.documentElement.style.setProperty('--primary-color', data.primaryColor);
        // Tukar warna browser bar ikut tema ejen
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) metaTheme.setAttribute('content', data.primaryColor);
    }

    if (data.secondaryColor) {
        document.documentElement.style.setProperty('--secondary-color', data.secondaryColor);
    }
}

function processPricingData(data) {
    // Medical card data (remains static as it's a separate product type)
    medicalPriceData150 = data.medical150 || [];
    medicalPriceData200 = data.medical200 || [];

    // Dynamically map Hibah pricing data based on PRICING_KEY_MAP
    // This allows new plans to be added without modifying this function
    Object.keys(PRICING_KEY_MAP).forEach(apiKey => {
        const internalKey = PRICING_KEY_MAP[apiKey];
        hibahPriceData[internalKey] = data[apiKey] || [];
    });

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
    if (!AGENT_ID) return;

    renderHibahBenefits();

    let hasCache = false;
    const cachedConfig = localStorage.getItem(CACHE_KEY_CONFIG);

    if (cachedConfig) {
        try {
            const configData = JSON.parse(cachedConfig);
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
                        localStorage.removeItem(CACHE_KEY_PRICING);
                    }
                } catch (e) { }
            }

            if (!isPricingLoaded && configData.hargaUrl) {
                fetchPricingData(configData.hargaUrl);
            }

        } catch (e) {
            localStorage.removeItem(CACHE_KEY_CONFIG);
        }
    } else {
        if (agentSkeleton) agentSkeleton.classList.remove('hidden');
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

    const payload = Object.assign({}, {
        token: (AGENT_CONFIG && AGENT_CONFIG.leadsSecret) || undefined,
        slug: AGENT_ID || undefined,
        agentName: (AGENT_CONFIG && AGENT_CONFIG.name) || undefined,
        source: window.location.href || undefined
    }, data);

    // Try a normal CORS POST first (ideal). If CORS blocks (or network error), retry with no-cors as a best-effort fallback.
    fetch(URL_LEADS_LAMA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(res => {
        if (!res.ok) console.warn('Lead submission returned non-OK status', res.status);
        else console.log('Lead submitted (CORS)');
    }).catch(err => {
        console.warn('CORS POST failed, retrying with no-cors fallback', err);
        fetch(URL_LEADS_LAMA, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(e => console.error('Lead submission failed (no-cors)', e));
    });
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
        // For females, use 'p' column regardless of smoking status
        // (Most Takaful products have same rate for female smokers/non-smokers)
        val = item.p || item['p waiver'] || item.P || item['P Waiver'] || item.p_waiver || item.P_Waiver;
    } else {
        // For males, differentiate between smoker and non-smoker
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

// =========================
// CUSTOM PRICING FUNCTIONS
// =========================
// These handle special pricing logic for plans that don't use standard getPremium
function getInspirasiPremium(priceInfo, gender, smoker) {
    if (!priceInfo) return null;
    if (gender === 'perempuan') {
        return smoker === 'ya' ? priceInfo.p_s : priceInfo.p_ns;
    } else {
        return smoker === 'ya' ? priceInfo.l_s : priceInfo.l_ns;
    }
}

function getEvoPremium(priceInfo, gender, smoker) {
    if (!priceInfo) return 0;
    if (gender === 'perempuan') {
        return priceInfo.rm50_p;
    } else {
        return smoker === 'ya' ? priceInfo.rm50_ls : priceInfo.rm50_lns;
    }
}

// Map custom pricing function names to actual functions
const CUSTOM_PRICING_FNS = {
    'inspirasi': getInspirasiPremium,
    'evo': getEvoPremium
};

function calculateHibah(name, age, gender, smoker, occupation, dob, phone) {
    // Initialize quotationData with base info
    const calculatedPremiums = {
        name, dob, phone, occupation, gender, smoker, nextBirthdayAge: age,
        planType: 'hibah'
    };

    // Loop through all plans defined in HIBAH_PLAN_CONFIG
    Object.keys(HIBAH_PLAN_CONFIG).forEach(planKey => {
        const config = HIBAH_PLAN_CONFIG[planKey];

        // Determine effective age (apply minimum age if needed)
        let effectiveAge = age;
        if (config.minAge && age < config.minAge) {
            effectiveAge = config.minAge;
        }

        // Check if age is within plan's eligible range
        const isEligible = age <= config.maxAge;

        // Get pricing data for this plan
        const priceData = hibahPriceData[planKey] || [];
        const priceInfo = priceData.find(item => item.age == effectiveAge);

        // Calculate premium using appropriate function
        let premium = null;
        if (isEligible && priceInfo) {
            if (config.customPricingFn && CUSTOM_PRICING_FNS[config.customPricingFn]) {
                premium = CUSTOM_PRICING_FNS[config.customPricingFn](priceInfo, gender, smoker);
            } else {
                premium = getPremium(priceInfo, gender, smoker);
            }
        }

        // Store premium in calculatedPremiums
        calculatedPremiums[config.premiumKey] = premium;

        // Update UI elements for this plan
        const priceEl = document.getElementById(config.priceElementId);
        const selectBtn = document.getElementById(config.selectBtnId);

        if (priceEl) {
            if (config.isValueNotPremium) {
                // For Evo, show as formatted number
                priceEl.textContent = (premium || 0).toLocaleString();
            } else {
                priceEl.textContent = premium ? premium.toFixed(2) : "N/A";
            }
        }
        if (selectBtn) {
            selectBtn.disabled = !premium;
        }

        // Handle variants (waiver, CI add-ons)
        if (config.variants) {
            Object.keys(config.variants).forEach(variantKey => {
                const variant = config.variants[variantKey];
                // Use the benefitsKey to look up pricing data (matches PRICING_KEY_MAP)
                const variantDataKey = variant.benefitsKey;
                const variantPriceData = hibahPriceData[variantDataKey] || [];
                const variantPriceInfo = variantPriceData.find(item => item.age == effectiveAge);

                let variantPremium = null;
                if (isEligible && variantPriceInfo) {
                    variantPremium = getPremium(variantPriceInfo, gender, smoker);
                }

                // Store variant premium using the benefitsKey to match expected naming (e.g., 'novaWaiverPremium', 'novaCIPremium')
                const variantPremiumKey = variant.benefitsKey + 'Premium';
                calculatedPremiums[variantPremiumKey] = variantPremium;

                // Update variant UI elements
                const checkbox = document.getElementById(variant.checkboxId);
                const container = document.getElementById(variant.containerId);
                const label = document.getElementById(variant.labelId);

                if (checkbox) {
                    checkbox.checked = false;
                    if (!variantPremium) {
                        checkbox.disabled = true;
                        if (container) container.classList.add('checkbox-disabled');
                        if (label) label.textContent = variant.disabledLabel;
                    } else {
                        checkbox.disabled = false;
                        if (container) container.classList.remove('checkbox-disabled');
                        if (label) label.textContent = variant.label;
                    }
                }
            });
        }

        // Render benefits for plans that have a benefits container
        if (config.benefitsContainerId) {
            renderSingleHibahBenefit(planKey, planKey);
        }
    });

    // Set global quotationData
    quotationData = calculatedPremiums;

    // Update result display
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

// Nova 150 variant update handler
function updateNova150Card(e) {
    const isWaiver = document.getElementById('nova150WaiverCheck').checked;
    const isCI = document.getElementById('nova150CICheck').checked;
    const priceDisplay = document.getElementById('nova150Monthly');

    if (e && e.target.id === 'nova150CICheck' && isCI) {
        document.getElementById('nova150WaiverCheck').checked = false;
    } else if (e && e.target.id === 'nova150WaiverCheck' && isWaiver) {
        document.getElementById('nova150CICheck').checked = false;
    }

    const finalWaiver = document.getElementById('nova150WaiverCheck').checked;
    const finalCI = document.getElementById('nova150CICheck').checked;

    if (finalCI && quotationData.nova150CIPremium) {
        priceDisplay.textContent = quotationData.nova150CIPremium.toFixed(2);
        renderSingleHibahBenefit('nova150', 'nova150CI');
    } else if (finalWaiver && quotationData.nova150WaiverPremium) {
        priceDisplay.textContent = quotationData.nova150WaiverPremium.toFixed(2);
        renderSingleHibahBenefit('nova150', 'nova150Waiver');
    } else if (quotationData.nova150Premium) {
        priceDisplay.textContent = quotationData.nova150Premium.toFixed(2);
        renderSingleHibahBenefit('nova150', 'nova150');
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
            if (!isPricingLoaded) {
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
            // Nova 150 plans
            if (planName === 'Hibah Nova 150') planKey = 'nova150';
            else if (planName === 'Hibah Nova 150 (Waiver)') planKey = 'nova150Waiver';
            else if (planName === 'Hibah Nova 150 (Add-on CI + Waiver)') planKey = 'nova150CI';
            // Nova plans
            else if (planName === 'Hibah Nova') planKey = 'nova';
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

// Nova 150 button and checkbox handlers
document.getElementById('selectNova150Btn').addEventListener('click', () => {
    const isWaiver = document.getElementById('nova150WaiverCheck').checked;
    const isCI = document.getElementById('nova150CICheck').checked;
    if (isCI) sendWhatsAppMessage('Hibah Nova 150 (Add-on CI + Waiver)', quotationData.nova150CIPremium);
    else if (isWaiver) sendWhatsAppMessage('Hibah Nova 150 (Waiver)', quotationData.nova150WaiverPremium);
    else sendWhatsAppMessage('Hibah Nova 150', quotationData.nova150Premium);
});

document.getElementById('nova150WaiverCheck').addEventListener('change', updateNova150Card);
document.getElementById('nova150CICheck').addEventListener('change', updateNova150Card);

// Nova button handler
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

function renderSingleHibahBenefit(containerKey, benefitsKey) {
    const container = document.getElementById(`${containerKey}-benefits`);
    const benefits = PLAN_BENEFITS[benefitsKey] || [];
    if (!container) return;

    container.innerHTML = '';

    benefits.forEach(b => {
        const iconSvg = icons[b.icon] || icons.shieldCheck || '';

        let iconWrapper = `<div class="icon-wrapper w-9 h-9 rounded-full bg-blue-100 text-corporate-secondary-blue-text" style="background-color: #dbeafe !important;">${iconSvg}</div>`;

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
    // Dynamically render benefits for all plans that have a benefits container
    Object.keys(HIBAH_PLAN_CONFIG).forEach(planKey => {
        const config = HIBAH_PLAN_CONFIG[planKey];
        if (config.benefitsContainerId) {
            renderSingleHibahBenefit(planKey, planKey);
        }
    });
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
// 6. VIEW CONTROL: LANDING VS APP
// =========================
window.addEventListener('DOMContentLoaded', () => {
    const landingView = document.getElementById('landing-view');
    const appView = document.getElementById('app-view');

    // === LOGIC REDIRECT BUTANG GO ===
    const goBtn = document.getElementById('goToAgentBtn');
    const slugInput = document.getElementById('agentSlugInput');

    if (goBtn && slugInput) {
        const doRedirect = () => {
            const val = slugInput.value.trim().toLowerCase();
            if (val) {
                window.location.href = `/${val}`;
            }
        };

        goBtn.addEventListener('click', doRedirect);
        slugInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') doRedirect();
        });
    }

    // === LOGIC TUKAR WARNA BACKGROUND DAN VIEW ===
    if (!AGENT_ID) {
        // --- MODE LANDING PAGE (MERAH) ---
        if (landingView) landingView.classList.remove('hidden');
        if (appView) appView.classList.add('hidden');

        // 1. Tambah class khas landing page (Override jadi Merah)
        document.body.classList.add('landing-mode');

        // 2. Tukar theme color browser (Mobile) jadi merah
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) metaTheme.setAttribute('content', '#7f1d1d');

    } else {
        // --- MODE EJEN / APP (WARNA DARI GOOGLE SHEET) ---
        if (landingView) landingView.classList.add('hidden');
        if (appView) appView.classList.remove('hidden');

        // 1. Buang class landing page (Kembali ke variable CSS asal)
        document.body.classList.remove('landing-mode');

        // 2. Default theme color (Biru) sementara tunggu Config load
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) metaTheme.setAttribute('content', '#1e3a8a');

        initializeApp();
    }
});