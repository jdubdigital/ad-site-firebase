const assert = require('node:assert/strict');
const test = require('node:test');
const { bundleHtml5PrivacyAssets, privacyCsp } = require('./html5-privacy');

test('privacy CSP allows local rendering but no third-party HTTPS sources', () => {
  assert.match(privacyCsp, /default-src 'none'/);
  assert.match(privacyCsp, /sandbox allow-scripts/);
  assert.match(privacyCsp, /frame-ancestors \*/);
  assert.doesNotMatch(privacyCsp, /(?:^|;\s*)[^;]*\bhttps:/);
});

test('navigation and arbitrary tracker URLs are neutralized', async () => {
  const files = [
    {
      path: 'index.html',
      contentType: 'text/html; charset=utf-8',
      buffer: Buffer.from(`
        <script src="https://s0.2mdn.net/ads/studio/Enabler.js"></script>
        <a href="https://tracker.example/click">Open</a>
        <form action="https://tracker.example/form"></form>
        <script>
          fetch("https://tracker.example/collect");
          navigator.sendBeacon("https://tracker.example/beacon", "view");
          window.location = ["https:", "//tracker.example/navigation"].join("");
        </script>
      `)
    }
  ];

  const result = await bundleHtml5PrivacyAssets({
    adId: 'privacy-test',
    files,
    mimeTypes: {}
  });
  const html = result.files[0].buffer.toString('utf8');

  assert.equal(result.externalFileCount, 0);
  assert.doesNotMatch(html, /tracker\.example/);
  assert.doesNotMatch(html, /2mdn\.net|Enabler\.js/);
  assert.match(html, /href="#"/);
  assert.match(html, /action="#"/);
  assert.match(html, /about:blank/);
  assert.doesNotMatch(html, /window\.location\s*=/);
});

test('server-side dependency vendoring rejects private network targets', async () => {
  const files = [
    {
      path: 'index.html',
      contentType: 'text/html; charset=utf-8',
      buffer: Buffer.from('<img src="https://127.0.0.1/private.png">')
    }
  ];

  await assert.rejects(
    bundleHtml5PrivacyAssets({
      adId: 'privacy-test',
      files,
      mimeTypes: { png: 'image/png' }
    }),
    /Private network addresses are not allowed/
  );

  const mappedIpv6Files = [
    {
      path: 'index.html',
      contentType: 'text/html; charset=utf-8',
      buffer: Buffer.from('<img src="https://[::ffff:7f00:1]/private.png">')
    }
  ];

  await assert.rejects(
    bundleHtml5PrivacyAssets({
      adId: 'privacy-test',
      files: mappedIpv6Files,
      mimeTypes: { png: 'image/png' }
    }),
    /public HTTPS|Private network addresses are not allowed/
  );
});
