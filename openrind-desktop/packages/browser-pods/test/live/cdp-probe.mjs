// Failure diagnostics only. This bypasses the product relay, not OpenShell policy.
const version = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
async function call(method, params = {}, sessionId) {
  const request = ++id;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.removeEventListener('message', message); reject(new Error(`${method}: timeout`)); }, 3000);
    const message = event => {
      const reply = JSON.parse(event.data);
      if (reply.id !== request) return;
      clearTimeout(timer); ws.removeEventListener('message', message);
      if (reply.error) reject(new Error(`${method}: ${JSON.stringify(reply.error)}`));
      else resolve(reply.result);
    };
    ws.addEventListener('message', message);
    ws.send(JSON.stringify({ id: request, method, params, sessionId }));
  });
}
try {
  const { targetInfos } = await call('Target.getTargets');
  console.log(targetInfos.map(({ type, title, url }) => ({ type, title, url })));
  const { sessionId } = await call('Target.attachToTarget', { targetId: targetInfos.find(t => t.type === 'page').targetId, flatten: true });
  console.log(await call('Runtime.runIfWaitingForDebugger', {}, sessionId));
  console.log(await call('Runtime.evaluate', { expression: 'location.href', returnByValue: true }, sessionId));
  console.log(await call('Page.navigate', { url: 'https://example.com' }, sessionId));
} catch (error) { console.log(error.message); }
finally { ws.close(); }
