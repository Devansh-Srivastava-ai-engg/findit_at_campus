import fs from 'node:fs/promises';

const debuggerPort = 9222;
const outputPath = 'C:/Users/Devansh/Downloads/FindIt_at_Campus_Project/report_build/findit-report-modal.png';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForTab() {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${debuggerPort}/json`)).json();
      const tab = tabs.find(item => item.type === 'page');
      if (tab) return tab;
    } catch {
      // Edge is still starting.
    }
    await delay(200);
  }
  throw new Error('Could not obtain an Edge debugging target.');
}

const tab = await waitForTab();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
});

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, message => {
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
  });
}

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1100,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url: 'http://localhost:3000/' });
await delay(1400);
await send('Runtime.evaluate', {
  expression: "document.querySelector('#browseReportBtn').click()",
  awaitPromise: true,
});
await delay(250);
const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
await fs.writeFile(outputPath, Buffer.from(shot.data, 'base64'));
ws.close();
