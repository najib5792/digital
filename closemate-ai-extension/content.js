(() => {
  const BUTTON_ID = "cm-ai-analyze-button";
  const PANEL_ID = "cm-ai-panel";

  // For production, replace this with deployed backend URL.
  // Example:
  // const CLOSEMATE_API_URL = "https://your-backend-domain.com/analyze-chat";
  const CLOSEMATE_API_URL = "http://localhost:8787/analyze-chat";

  const TONES = [
    "Friendly & Warm", "Professional", "Soft Closing", "Direct Closing", "Follow Up",
    "Malay Casual", "Malay Professional", "Sabah Friendly", "Kelantan Friendly"
  ];

  const FALLBACK = {
    lead_score: 0,
    emotion: "Unknown",
    objection: "Unable to detect",
    summary: "Unable to analyze the chat.",
    suggested_reply: "Maaf, sistem tak dapat analyze chat ni buat masa sekarang. Cuba sekali lagi ya.",
    follow_up: "Boleh cuba refresh WhatsApp Web dan tekan Analyze Chat semula.",
    next_action: "Try again"
  };

  function createAnalyzeButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.textContent = "Analyze Chat";
    button.addEventListener("click", handleAnalyze);
    document.body.appendChild(button);
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="cm-panel-header"><h2>CloseMate AI</h2><button id="cm-panel-close" aria-label="Close">×</button></div>
      <div class="cm-panel-content">
        <div class="cm-config-card">
          <label class="cm-label" for="cm-license">License Key</label>
          <input id="cm-license" class="cm-input" type="text" placeholder="Enter your license key" />
          <div class="cm-row"><button id="cm-save-license" class="cm-mini-btn">Save License Key</button><span id="cm-license-status" class="cm-status"></span></div>
          <p class="cm-help">Your license key is required before using Analyze Chat.</p>
        </div>
        <div class="cm-config-card">
          <label class="cm-label" for="cm-api-key">Gemini API Key</label>
          <div class="cm-inline-field">
            <input id="cm-api-key" class="cm-input" type="password" placeholder="Enter your Gemini API key" />
            <button id="cm-toggle-api" class="cm-ghost-btn" type="button">Show</button>
          </div>
          <div class="cm-row"><button id="cm-save-api" class="cm-mini-btn">Save API Key</button><span id="cm-api-status" class="cm-status"></span></div>
          <p class="cm-help">Your Gemini API key is stored only in your browser.</p>
        </div>
        <div class="cm-config-card">
          <label class="cm-label" for="cm-tone">Reply Tone</label>
          <select id="cm-tone" class="cm-select">${TONES.map((t)=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}</select>
        </div>
        <button id="cm-analyze-btn" class="cm-main-btn">Analyze Chat</button>
        <div id="cm-panel-content-body"><p class="cm-muted">Configure keys, then click Analyze Chat.</p></div>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector("#cm-panel-close")?.addEventListener("click", () => panel.classList.remove("open"));
    bindPanelEvents();
    loadSavedConfig();
  }

  function bindPanelEvents() {
    document.getElementById("cm-save-license")?.addEventListener("click", async () => {
      const val = (document.getElementById("cm-license")?.value || "").trim();
      await chrome.storage.local.set({ closemate_license_key: val });
      setStatus("cm-license-status", "License key saved");
    });
    document.getElementById("cm-save-api")?.addEventListener("click", async () => {
      const val = (document.getElementById("cm-api-key")?.value || "").trim();
      await chrome.storage.local.set({ closemate_gemini_api_key: val });
      setStatus("cm-api-status", "API key saved");
    });
    document.getElementById("cm-tone")?.addEventListener("change", async (e) => {
      await chrome.storage.local.set({ closemate_reply_tone: e.target.value });
    });
    document.getElementById("cm-toggle-api")?.addEventListener("click", () => {
      const input = document.getElementById("cm-api-key");
      const btn = document.getElementById("cm-toggle-api");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Hide" : "Show";
    });
    document.getElementById("cm-analyze-btn")?.addEventListener("click", handleAnalyze);
  }

  async function loadSavedConfig() {
    const data = await chrome.storage.local.get(["closemate_license_key", "closemate_gemini_api_key", "closemate_reply_tone"]);
    document.getElementById("cm-license").value = data.closemate_license_key || "";
    document.getElementById("cm-api-key").value = data.closemate_gemini_api_key || "";
    document.getElementById("cm-tone").value = data.closemate_reply_tone || "Malay Casual";
    if (!data.closemate_reply_tone) {
      await chrome.storage.local.set({ closemate_reply_tone: "Malay Casual" });
    }
  }

  function setStatus(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    setTimeout(() => { el.textContent = ""; }, 1500);
  }

  function getVisibleMessages() { /* unchanged selectors */
    const selectors = ['[data-testid="msg-container"]','[data-testid="conversation-panel-messages"] [role="row"]','.copyable-text'];
    const collected = [];
    selectors.some((selector) => {
      const nodes = [...document.querySelectorAll(selector)];
      if (!nodes.length) return false;
      nodes.forEach((node) => {
        const text = (node.innerText || "").trim();
        if (!text) return;
        const meta = node.getAttribute("data-pre-plain-text") || "";
        collected.push(meta ? `${meta} ${text}`.trim() : text);
      });
      return collected.length > 0;
    });
    return [...new Set(collected)].slice(-80);
  }

  async function handleAnalyze() {
    const panel = document.getElementById(PANEL_ID);
    const body = document.getElementById("cm-panel-content-body");
    const analyzeBtn = document.getElementById("cm-analyze-btn");
    panel?.classList.add("open");

    const license_key = (document.getElementById("cm-license")?.value || "").trim();
    const gemini_api_key = (document.getElementById("cm-api-key")?.value || "").trim();
    const tone = document.getElementById("cm-tone")?.value || "Malay Casual";

    if (!license_key) return renderError("Please enter your license key first.");
    if (!gemini_api_key) return renderError("Please enter your Gemini API key first.");

    const messages = getVisibleMessages();
    if (!messages.length) return renderError("No chat messages found. Please open a WhatsApp chat first.");

    await chrome.storage.local.set({ closemate_license_key: license_key, closemate_gemini_api_key: gemini_api_key, closemate_reply_tone: tone });

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "Analyzing...";
    body.innerHTML = '<p class="cm-muted">Reading chat and preparing reply...</p>';

    try {
      const response = await fetch(CLOSEMATE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_key, gemini_api_key, tone, messages })
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 403) return renderError("Invalid license key. Please check your key or contact support.");
        if (response.status === 401) return renderError(data.error || "Unauthorized request.");
        const msg = String(data.error || "").toLowerCase();
        if (msg.includes("api key") || msg.includes("permission") || msg.includes("auth")) return renderError("Invalid Gemini API key. Please check your API key.");
        return renderError("Unable to analyze this chat right now. Please try again.");
      }
      renderAnalysis({ ...FALLBACK, ...data });
    } catch {
      renderError("Unable to connect to CloseMate AI backend. Please make sure the backend is running or update the API URL.");
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = "Analyze Chat";
    }
  }

  function renderError(message) {
    const body = document.getElementById("cm-panel-content-body");
    if (body) body.innerHTML = `<p class="cm-error">${escapeHtml(message)}</p>`;
  }

  function renderAnalysis(data) {
    const body = document.getElementById("cm-panel-content-body");
    body.innerHTML = `
      <div class="cm-grid"><div class="cm-card"><span>Lead Score</span><strong>${Math.max(0, Math.min(100, Number(data.lead_score) || 0))}/100</strong></div><div class="cm-card"><span>Emotion</span><strong>${escapeHtml(String(data.emotion))}</strong></div></div>
      <div class="cm-block"><h3>Objection</h3><p>${escapeHtml(String(data.objection))}</p></div>
      <div class="cm-block"><h3>Summary</h3><p>${escapeHtml(String(data.summary))}</p></div>
      <div class="cm-block"><div class="cm-block-head"><h3>Suggested Reply</h3><button id="cm-copy-reply" class="cm-copy-btn">Copy Reply</button></div><p class="cm-reply-box">${escapeHtml(String(data.suggested_reply))}</p></div>
      <div class="cm-block"><div class="cm-block-head"><h3>Follow Up</h3><button id="cm-copy-follow-up" class="cm-copy-btn">Copy Follow Up</button></div><p class="cm-reply-box">${escapeHtml(String(data.follow_up))}</p></div>
      <div class="cm-block"><h3>Next Action</h3><p>${escapeHtml(String(data.next_action))}</p></div>`;
    bindCopy("cm-copy-reply", String(data.suggested_reply), "Copy Reply");
    bindCopy("cm-copy-follow-up", String(data.follow_up), "Copy Follow Up");
  }

  function bindCopy(id, text, label) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = label; }, 1500);
    });
  }

  function escapeHtml(text) { return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

  createAnalyzeButton();
  createPanel();
})();
