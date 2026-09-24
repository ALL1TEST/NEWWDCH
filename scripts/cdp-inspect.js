async function run() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  console.log('Tabs:', tabs.map(t => ({ id: t.id, url: t.url })));
  const tab = tabs.find(t => t.url.includes('#media')) || tabs[0];
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = id++;
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === curId) {
        ws.removeEventListener('message', handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await new Promise(r => ws.addEventListener('open', r));
  await new Promise(r => setTimeout(r, 2000));

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const main = document.querySelector('main');
      const mediaRoot = main ? main.firstElementChild : null;
      const contentArea = mediaRoot ? mediaRoot.querySelector('.overflow-y-auto') : null;
      const topbar = document.querySelector('header');
      const sidebarWrapper = document.querySelector('[data-slot="sidebar-wrapper"]');

      function b(el, name) {
        if (!el) return { name, exists: false };
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return {
          name,
          top: r.top, bottom: r.bottom, height: r.height, width: r.width,
          paddingBottom: s.paddingBottom, paddingTop: s.paddingTop,
          paddingLeft: s.paddingLeft, paddingRight: s.paddingRight,
          marginBottom: s.marginBottom, marginTop: s.marginTop,
          overflowY: s.overflowY, heightStyle: s.height,
          bg: s.backgroundColor
        };
      }

      return {
        windowHeight: window.innerHeight,
        topbar: b(topbar, 'topbar'),
        sidebarWrapper: b(sidebarWrapper, 'sidebarWrapper'),
        main: b(main, 'main'),
        mediaRoot: b(mediaRoot, 'mediaRoot'),
        contentArea: b(contentArea, 'contentArea')
      };
    })()`,
    returnByValue: true
  });

  console.log('DOM INSPECTION RESULTS:');
  console.log(JSON.stringify(res.value, null, 2));
  ws.close();
}
run().catch(console.error);
