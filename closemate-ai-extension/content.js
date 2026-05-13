(() => {
  const BUTTON_ID = "cm-ai-analyze-button";
  const PANEL_ID = "cm-ai-panel";
  const TONE_SELECT_ID = "cm-tone-select";

  const toneOptions = [
    "Friendly & Warm",
    "Professional",
    "Soft Closing",
    "Direct Closing",
    "Follow Up",
    "Malay Casual",
    "Malay Professional",
    "Sabah Friendly",
    "Kelantan Friendly"
  ];

  const defaultAnalysis = {
    lead_score: "N/A",
    emotion: "N/A",
    objection: "N/A",
    summary: "No summary returned.",
    suggested_reply: "No suggested reply returned.",
    follow_up: "No follow-up returned.",
    next_action: "No next action returned."
  };

  function createAnalyzeButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.textContent = "Analyze Chat";
    button.addEventListener("click", handleAnalyzeChat);
    document.body.appendChild(button);
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="cm-panel-header">
        <h2>CloseMate AI</h2>
        <button id="cm-panel-close" aria-label="Close">×</button>
      </div>
      <div class="cm-panel-content">
        <div class="cm-controls">
          <label for="${TONE_SELECT_ID}" class="cm-label">Reply Tone</label>
          <select id="${TONE_SELECT_ID}" class="cm-select">
            ${toneOptions.map((tone) => `<option value="${escapeHtml(tone)}">${escapeHtml(tone)}</option>`).join("")}
          </select>
        </div>
        <div id="cm-panel-content-body">
          <p class="cm-muted">Click <strong>Analyze Chat</strong> to begin.</p>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    panel.querySelector("#cm-panel-close")?.addEventListener("click", () => panel.classList.remove("open"));
  }

  function getSelectedTone() {
    const toneSelect = document.getElementById(TONE_SELECT_ID);
    return toneSelect?.value || "Friendly & Warm";
  }

  function getVisibleMessages() {
    const selectors = [
      '[data-testid="msg-container"]',
      '[data-testid="conversation-panel-messages"] [role="row"]',
      '.copyable-text'
    ];
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

  async function callAnalysisAPI(messages, tone) {
    const { closemateApiBaseUrl = "http://localhost:8787" } = await chrome.storage.sync.get("closemateApiBaseUrl");
    const baseUrl = (closemateApiBaseUrl || "http://localhost:8787").replace(/\/$/, "");
    const endpoint = `${baseUrl}/analyze-chat`;

    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, tone })
      });
    } catch (error) {
      throw new Error(`Cannot reach backend at ${endpoint}. Start backend server and verify popup Backend URL. Original error: ${error.message || error}`);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API ${response.status}: ${text}`);
    }

    return response.json();
  }

  function setCopyHandler(buttonId, textToCopy) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(textToCopy);
        const original = button.textContent;
        button.textContent = "Copied!";
        setTimeout(() => {
          button.textContent = original;
        }, 1500);
      } catch {
        button.textContent = "Copy failed";
        setTimeout(() => {
          button.textContent = buttonId === "cm-copy-reply" ? "Copy Reply" : "Copy Follow Up";
        }, 1500);
      }
    });
  }

  function renderAnalysis(analysis) {
    const panel = document.getElementById(PANEL_ID);
    const content = document.getElementById("cm-panel-content-body");
    if (!panel || !content) return;

    const data = { ...defaultAnalysis, ...analysis };
    panel.classList.add("open");

    content.innerHTML = `
      <div class="cm-grid">
        <div class="cm-card"><span>Lead Score</span><strong>${escapeHtml(String(data.lead_score))}</strong></div>
        <div class="cm-card"><span>Emotion</span><strong>${escapeHtml(String(data.emotion))}</strong></div>
      </div>
      <div class="cm-block"><h3>Objection</h3><p>${escapeHtml(String(data.objection))}</p></div>
      <div class="cm-block"><h3>Summary</h3><p>${escapeHtml(String(data.summary))}</p></div>
      <div class="cm-block">
        <div class="cm-block-head"><h3>Suggested Reply</h3><button id="cm-copy-reply" class="cm-copy-btn">Copy Reply</button></div>
        <p class="cm-reply-box">${escapeHtml(String(data.suggested_reply))}</p>
      </div>
      <div class="cm-block">
        <div class="cm-block-head"><h3>Follow Up</h3><button id="cm-copy-follow-up" class="cm-copy-btn">Copy Follow Up</button></div>
        <p>${escapeHtml(String(data.follow_up))}</p>
      </div>
      <div class="cm-block"><h3>Next Action</h3><p>${escapeHtml(String(data.next_action))}</p></div>
    `;

    setCopyHandler("cm-copy-reply", String(data.suggested_reply));
    setCopyHandler("cm-copy-follow-up", String(data.follow_up));
  }

  function escapeHtml(text) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function handleAnalyzeChat() {
    const content = document.getElementById("cm-panel-content-body");
    const panel = document.getElementById(PANEL_ID);
    panel?.classList.add("open");
    if (content) content.innerHTML = '<p class="cm-muted">Analyzing visible chat…</p>';

    try {
      const messages = getVisibleMessages();
      const tone = getSelectedTone();
      if (!messages.length) throw new Error("No visible messages found. Open a chat and scroll to load messages.");
      const analysis = await callAnalysisAPI(messages, tone);
      renderAnalysis(analysis);
    } catch (error) {
      if (content) content.innerHTML = `<p class="cm-error">${escapeHtml(error.message || "Analysis failed")}</p>`;
    }
  }

  createAnalyzeButton();
  createPanel();
})();
