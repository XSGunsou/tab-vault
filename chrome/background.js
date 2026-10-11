chrome.alarms.onAlarm.addListener(async (alarm) => {
  const { vault } = await chrome.storage.local.get({ vault: [] });
  const item = vault.find((i) => i.id === alarm.name);

  if (item) {
    chrome.notifications.create(alarm.name, {
      type: "basic",
      iconUrl: "icon.png",
      title: `TabVault Reminder: ${item.category}`,
      message: item.note ? item.note : `You have ${item.tabs.length} tabs waiting in this group.`
    });
  }
});