const input = document.getElementById('apiUrl');
const btn = document.getElementById('saveBtn');

chrome.storage.sync.get('closemateApiBaseUrl').then(({ closemateApiBaseUrl }) => {
  input.value = closemateApiBaseUrl || 'http://localhost:8787';
});

btn.addEventListener('click', async () => {
  const value = input.value.trim() || 'http://localhost:8787';
  await chrome.storage.sync.set({ closemateApiBaseUrl: value });
  btn.textContent = 'Saved';
  setTimeout(() => (btn.textContent = 'Save'), 1200);
});
