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
  
  // Clear container cleanly
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const term = searchTerm.toLowerCase();
  const filtered = vault.filter(item => {
    if (!term) return true;
    const matchCat = item.category.toLowerCase().includes(term);
    const matchNote = item.note.toLowerCase().includes(term);
    const matchTab = item.tabs.some(t => t.title.toLowerCase().includes(term) || t.url.toLowerCase().includes(term));
    return matchCat || matchNote || matchTab;
  });

  if (filtered.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.style.textAlign = "center";
    emptyDiv.style.color = "#71717a";
    emptyDiv.style.fontSize = "12px";
    emptyDiv.style.padding = "12px";
    emptyDiv.textContent = "No matching tab groups";
    container.appendChild(emptyDiv);
    return;
  }

  filtered.forEach((item) => {
    const hasIncognito = item.tabs.some(t => t.incognito);

    const card = document.createElement("div");
    card.className = "group-card";

    // Title header
    const titleDiv = document.createElement("div");
    titleDiv.className = "group-title";
    titleDiv.textContent = `${item.category} • ${item.tabs.length} tabs (${item.date})${hasIncognito ? " 🕶" : ""}`;
    card.appendChild(titleDiv);

    // Note preview (if present)
    if (item.note) {
      const noteDiv = document.createElement("div");
      noteDiv.className = "group-note";
      noteDiv.textContent = `“${item.note}”`;
      card.appendChild(noteDiv);
    }

    // Tab links container
    const linksContainer = document.createElement("div");
    linksContainer.className = "tab-links hidden";
    item.tabs.forEach(t => {
      const link = document.createElement("a");
      link.href = t.url;
      link.target = "_blank";
      link.className = "tab-link";
      link.title = t.url;
      link.textContent = t.title;
      linksContainer.appendChild(link);
    });
    card.appendChild(linksContainer);

    // Action buttons container
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "card-actions";

    const viewBtn = document.createElement("button");
    viewBtn.className = "view-btn";
    viewBtn.textContent = "View Tabs";
    viewBtn.onclick = () => {
      const isHidden = linksContainer.classList.toggle("hidden");
      viewBtn.textContent = isHidden ? "View Tabs" : "Hide Tabs";
    };

    const restoreBtn = document.createElement("button");
    restoreBtn.className = "primary-btn restore-btn";
    restoreBtn.textContent = "Restore All";
    restoreBtn.onclick = () => {
      item.tabs.forEach(t => chrome.tabs.create({ url: t.url }));
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.onclick = async () => {
      const updatedVault = vault.filter(v => v.id !== item.id);
      await chrome.storage.local.set({ vault: updatedVault });
      chrome.alarms.clear(item.id);
      renderVault(searchTerm);
    };

    actionsDiv.appendChild(viewBtn);
    actionsDiv.appendChild(restoreBtn);
    actionsDiv.appendChild(deleteBtn);
    card.appendChild(actionsDiv);

    container.appendChild(card);
  });
}