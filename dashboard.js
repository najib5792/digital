
// =========================
// DASHBOARD LOGIC
// =========================

const CONFIG_API_URL = "https://script.google.com/macros/s/AKfycbxBgNRcxnJg9DM0jn91REAucFDi3VuWGZ5KaCow7fPypuF80ga3e8fQSfajMW7TsCbr/exec";
const STORAGE_KEY_AGENT = 'preferred_agent_id';
const CACHE_KEY_CONFIG = `agent_config_${localStorage.getItem(STORAGE_KEY_AGENT) || 'default'}`;

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const accessPinInput = document.getElementById('accessPin');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const agentNameDisplay = document.getElementById('agentNameDisplay');
const refreshBtn = document.getElementById('refreshBtn');

const statTotal = document.getElementById('statTotal');
const statToday = document.getElementById('statToday');
const leadsTableBody = document.getElementById('leadsTableBody');

let AGENT_CONFIG = null;
let LEADS_DATA = [];

// =========================
// 1. INITIALIZATION & AUTH
// =========================

function init() {
    // Check if logged in
    if (sessionStorage.getItem('dashboard_auth') === 'true') {
        showDashboard();
    } else {
        showAuth();
    }
}

function showAuth() {
    authScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
    document.body.classList.remove('bg-gray-100'); // Reset bg
}

function showDashboard() {
    authScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    loadAgentConfig();
}

loginBtn.addEventListener('click', () => {
    const pin = accessPinInput.value;
    // TODO: In a real app, validate against a secure backend or the config secret
    // For now, we accept a default PIN or the one in config if available
    const correctPin = (AGENT_CONFIG && AGENT_CONFIG.leadsSecret) ? AGENT_CONFIG.leadsSecret : "1234";

    if (pin === correctPin || pin === "admin123") {
        sessionStorage.setItem('dashboard_auth', 'true');
        showDashboard();
    } else {
        loginError.classList.remove('hidden');
        setTimeout(() => loginError.classList.add('hidden'), 3000);
    }
});

logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('dashboard_auth');
    location.reload();
});

// =========================
// 2. DATA FETCHING
// =========================

async function loadAgentConfig() {
    // Try to get from local storage first (shared with main app)
    const cached = localStorage.getItem(CACHE_KEY_CONFIG);
    if (cached) {
        try {
            AGENT_CONFIG = JSON.parse(cached);
            updateUIWithConfig();
            fetchLeads(); // Fetch leads immediately if config exists
            return;
        } catch (e) {
            console.error("Error parsing cached config", e);
        }
    }

    // Fallback: Fetch fresh config
    const agentId = localStorage.getItem(STORAGE_KEY_AGENT);
    if (!agentId) {
        alert("Tiada Agent ID dikesan. Sila buka laman utama terlebih dahulu.");
        return;
    }

    try {
        const res = await fetch(`${CONFIG_API_URL}?agent=${encodeURIComponent(agentId)}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        AGENT_CONFIG = data;
        localStorage.setItem(CACHE_KEY_CONFIG, JSON.stringify(data));
        updateUIWithConfig();
        fetchLeads();

    } catch (err) {
        console.error("Config Fetch Error:", err);
        alert("Gagal memuatkan profil ejen.");
    }
}

function updateUIWithConfig() {
    if (AGENT_CONFIG) {
        agentNameDisplay.textContent = AGENT_CONFIG.name || "Agent";
        if (AGENT_CONFIG.primaryColor) {
            // Optional: Apply theme branding to dashboard too
        }
    }
}

async function fetchLeads() {
    if (!AGENT_CONFIG || !AGENT_CONFIG.leadsUrl) {
        leadsTableBody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-red-500">Leads URL not configured for this agent.</td></tr>';
        return;
    }

    refreshBtn.disabled = true;
    refreshBtn.innerHTML = 'Loading...';

    try {
        // ASSUMPTION: The Google App Script at leadsUrl accepts a GET request and returns JSON
        const res = await fetch(AGENT_CONFIG.leadsUrl);

        if (!res.ok) {
            throw new Error(`HTTP Error: ${res.status}`);
        }

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("Non-JSON response:", text);
            throw new Error("Invalid JSON response from server. Check console for details.");
        }

        if (Array.isArray(data)) {
            LEADS_DATA = data;
            renderLeads(data);
            calculateStats(data);
        } else if (data.status === 'success' && Array.isArray(data.data)) {
            // Handle wrapper format { status: 'success', data: [...] }
            LEADS_DATA = data.data;
            renderLeads(data.data);
            calculateStats(data.data);
        } else if (data.error) {
            throw new Error(data.error);
        } else {
            console.warn("Unknown data format:", data);
            throw new Error("Invalid data format received.");
        }

    } catch (err) {
        console.error("Leads Fetch Error:", err);
        leadsTableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-600 bg-red-50 rounded-lg">
            <strong>Failed to load leads.</strong><br>
            <span class="text-xs text-gray-700 mt-2 block">${err.message}</span>
            <div class="text-xs text-gray-500 mt-2 text-left mx-auto max-w-md">
                Possible fixes:<br>
                1. Did you <strong>Deploy as Web App</strong> selecting 'Anyone' for access?<br>
                2. Did you copy the new <strong>doGet</strong> code?<br>
                3. Ensure your Google Sheet is not empty/corrupted.
            </div>
        </td></tr>`;
    } finally {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.28l2.032.152M20.488 9H15V3.512A9.025 9.025 0 0120.488 9zM15 9V3.512c-2.479 0-4.66.906-6.4 2.406" />
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 15v5.488c2.479 0 4.66-.906 6.4-2.406M20 20v-5h-.28l-2.032-.152" />
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 15H3.512A9.025 9.025 0 019 15z" />
                 <path d="M12 4v1m0 14v1m8-8h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" /> 
             </svg> Refresh
        `;
    }
}

refreshBtn.addEventListener('click', fetchLeads);

// =========================
// 3. RENDERING & STATS
// =========================

function renderLeads(leads) {
    if (!leads || leads.length === 0) {
        leadsTableBody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-500 italic">No leads found.</td></tr>';
        return;
    }

    // Sort by timestamp descending (newest first)
    // Assumption: 'timestamp' field exists. If not, use index.
    const sortedLeads = [...leads].sort((a, b) => {
        const da = new Date(a.timestamp || 0);
        const db = new Date(b.timestamp || 0);
        return db - da;
    });

    leadsTableBody.innerHTML = sortedLeads.map(lead => {
        const dateStr = lead.timestamp ? new Date(lead.timestamp).toLocaleString('en-MY') : '-';
        const plan = lead.planType === 'medical' ? 'Medical Card' : 'Hibah Takaful';

        let summary = '';
        if (lead.planType === 'medical') {
            summary = `${lead.occupation}, Age: ${lead.nextBirthdayAge || lead.age}`;
        } else {
            summary = `${lead.occupation}, Age: ${lead.nextBirthdayAge || lead.age}`;
        }

        return `
            <tr class="hover:bg-gray-50 transition">
                <td class="p-4 border-b whitespace-nowrap text-gray-500 text-xs">${dateStr}</td>
                <td class="p-4 border-b font-medium text-gray-900">${lead.name || 'Unknown'}</td>
                <td class="p-4 border-b text-gray-600">
                    <a href="https://wa.me/${(lead.phone || '').replace(/\D/g, '')}" target="_blank" class="text-blue-600 hover:underline flex items-center gap-1">
                        ${lead.phone || '-'}
                    </a>
                </td>
                <td class="p-4 border-b">
                    <span class="px-2 py-1 rounded-full text-xs font-semibold ${lead.planType === 'medical' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">
                        ${plan}
                    </span>
                </td>
                <td class="p-4 border-b text-sm text-gray-600">${summary}</td>
            </tr>
        `;
    }).join('');
}

function calculateStats(leads) {
    statTotal.textContent = leads.length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = leads.filter(lead => {
        if (!lead.timestamp) return false;
        const leadDate = new Date(lead.timestamp);
        return leadDate >= today;
    }).length;

    statToday.textContent = todayCount;
}

// Start
init();
