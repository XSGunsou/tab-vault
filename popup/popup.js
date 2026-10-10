document.addEventListener("DOMContentLoaded", () => {
  renderVault();

  document.getElementById("saveCurrentBtn").addEventListener("click", () => saveTabs(false));
  document.getElementById("saveAllBtn").addEventListener("click", () => saveTabs(true));
  document.getElementById("searchInput").addEventListener("input", (e) => renderVault(e.target.value));
});

async function saveTabs(allTabs) {
  const group = document.getElementById("groupName").value.trim() || "General";
  const note = document.getElementById("noteText").value.trim();
  const reminderMinutes = parseInt(document.getElementById("reminderTime").value, 10);

  const queryOptions = allTabs ? { currentWindow: true } : { active: true, currentWindow: true };
  const rawTabs = await chrome.tabs.query(queryOptions);

  const tabList = rawTabs
    .filter(t => !t.url.startsWith("chrome://") && !t.url.startsWith("about:") && !t.url.startsWith("chrome-extension://"))
    .map(t => ({ title: t.title || t.url, url: t.url, incognito: t.incognito }));

  if (tabList.length === 0) return;

  const entry = {
    id: "group_" + Date.now(),
    date: new Date().toLocaleDateString(),
    category: group,
    note: note,
    tabs: tabList
  };

  const data = await chrome.storage.local.get({ vault: [] });
  data.vault.unshift(entry);
  await chrome.storage.local.set({ vault: data.vault });

  if (reminderMinutes > 0) {
    chrome.alarms.create(entry.id, { delayInMinutes: reminderMinutes });
  }

  const idsToClose = rawTabs.map(t => t.id);
  await chrome.tabs.remove(idsToClose);

  // Clear fields and re-render
  document.getElementById("groupName").value = "";
  document.getElementById("noteText").value = "";
  document.getElementById("reminderTime").value = "0";
  renderVault();
}

async function renderVault(searchTerm = "") {
  const { vault } = await chrome.storage.local.get({ vault: [] });
  const container = document.getElementById("vaultList");
  document.getElementById("count").textContent = `${vault.length} group${vault.length === 1 ? "" : "s"}`;
  container.innerHTML = "";

  const term = searchTerm.toLowerCase();
  const filtered = vault.filter(item => {
    if (!term) return true;
    const matchCat = item.category.toLowerCase().includes(term);
    const matchNote = item.note.toLowerCase().includes(term);
    const matchTab = item.tabs.some(t => t.title.toLowerCase().includes(term) || t.url.toLowerCase().includes(term));
    return matchCat || matchNote || matchTab;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#71717a; font-size:12px; padding:12px;">No matching tab groups</div>`;
    return;
  }

  filtered.forEach((item) => {
    const hasIncognito = item.tabs.some(t => t.incognito);

    const card = document.createElement("div");
    card.className = "group-card";
    card.innerHTML = `
      <div class="group-title">${item.category} • ${item.tabs.length} tabs (${item.date})${hasIncognito ? " 🕶" : ""}</div>
      ${item.note ? `<div class="group-note">“${item.note}”</div>` : ""}
      <div class="tab-links hidden">
        ${item.tabs.map(t => `
          <a href="${t.url}" target="_blank" class="tab-link" title="${t.url}">
            ${t.title}
          </a>
        `).join("")}
      </div>
      <div class="card-actions">
        <button class="view-btn">View Tabs</button>
        <button class="primary-btn restore-btn">Restore All</button>
        <button class="delete-btn">Delete</button>
      </div>
    `;

    const viewBtn = card.querySelector(".view-btn");
    const linksContainer = card.querySelector(".tab-links");
    viewBtn.onclick = () => {
      const isHidden = linksContainer.classList.toggle("hidden");
      viewBtn.textContent = isHidden ? "View Tabs" : "Hide Tabs";
    };

    card.querySelector(".restore-btn").onclick = () => {
      item.tabs.forEach(t => chrome.tabs.create({ url: t.url }));
    };

    card.querySelector(".delete-btn").onclick = async () => {
      const updatedVault = vault.filter(v => v.id !== item.id);
      await chrome.storage.local.set({ vault: updatedVault });
      chrome.alarms.clear(item.id);
      renderVault(searchTerm);
    };

    container.appendChild(card);
  });
}