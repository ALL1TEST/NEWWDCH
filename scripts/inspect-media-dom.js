const { chromium } = require('playwright');

(async () => {
  try {
    const browser = await chromium.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:3000/#media', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const info = await page.evaluate(() => {
      const main = document.querySelector('main');
      const mediaRoot = main ? main.firstElementChild : null;
      const contentArea = mediaRoot ? mediaRoot.querySelector('.overflow-y-auto') : null;
      const wrapper = document.querySelector('[data-slot="sidebar-wrapper"]');

      function getBox(el) {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          className: el.className,
          rect: { top: r.top, bottom: r.bottom, height: r.height, width: r.width },
          padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
          margin: `${s.marginTop} ${s.marginRight} ${s.marginBottom} ${s.marginLeft}`,
          overflowY: s.overflowY,
          backgroundColor: s.backgroundColor,
          height: s.height
        };
      }

      return {
        windowHeight: window.innerHeight,
        wrapper: getBox(wrapper),
        main: getBox(main),
        mediaRoot: getBox(mediaRoot),
        contentArea: getBox(contentArea)
      };
    });

    console.log(JSON.stringify(info, null, 2));
    await browser.close();
  } catch (e) {
    console.error(e);
  }
})();
