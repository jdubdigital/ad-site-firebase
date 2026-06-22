const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const https = require('node:https');
const net = require('node:net');

const externalAssetRoot = '_external';
const maxExternalFiles = 48;
const maxExternalFileBytes = 4 * 1024 * 1024;
const maxExternalTotalBytes = 10 * 1024 * 1024;
const maxRedirects = 4;
const requestTimeoutMs = 10000;

const contentTypeExtensions = new Map([
  ['application/javascript', 'js'],
  ['application/json', 'json'],
  ['application/octet-stream', 'bin'],
  ['application/wasm', 'wasm'],
  ['font/otf', 'otf'],
  ['font/ttf', 'ttf'],
  ['font/woff', 'woff'],
  ['font/woff2', 'woff2'],
  ['image/gif', 'gif'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/svg+xml', 'svg'],
  ['image/webp', 'webp'],
  ['model/gltf+json', 'gltf'],
  ['model/gltf-binary', 'glb'],
  ['text/css', 'css'],
  ['text/javascript', 'js'],
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm']
]);

const vendorableExtensions = new Set([
  'bin',
  'css',
  'gif',
  'glb',
  'gltf',
  'jpeg',
  'jpg',
  'js',
  'json',
  'mp3',
  'mp4',
  'otf',
  'png',
  'svg',
  'ttf',
  'wasm',
  'webm',
  'webp',
  'woff',
  'woff2'
]);

const privacyCsp = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  'sandbox allow-scripts',
  'frame-ancestors *'
].join('; ');

function extensionForUrl(url) {
  const match = String(url?.pathname || '').match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '';
}

function normalizedContentType(value) {
  return String(value || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
}

function extensionForResource(url, contentType) {
  const pathExtension = extensionForUrl(url);
  const normalizedType = normalizedContentType(contentType);
  if (normalizedType === 'application/octet-stream' && vendorableExtensions.has(pathExtension)) return pathExtension;

  const contentExtension = contentTypeExtensions.get(normalizedType);
  if (contentExtension) return contentExtension;
  return vendorableExtensions.has(pathExtension) ? pathExtension : '';
}

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIp(address) {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version !== 6) return true;

  const normalized = address.toLowerCase();
  const dottedIpv4 = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dottedIpv4) return isPrivateIpv4(dottedIpv4[1]);

  if (normalized.startsWith('::ffff:')) {
    const tail = normalized.slice('::ffff:'.length).split(':').filter(Boolean);
    if (tail.length === 2) {
      const high = Number.parseInt(tail[0], 16);
      const low = Number.parseInt(tail[1], 16);
      if (Number.isFinite(high) && Number.isFinite(low)) {
        return isPrivateIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
      }
    }
    return true;
  }

  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:')
  ) {
    return true;
  }
  return false;
}

async function resolvePublicAddress(hostname) {
  const addressLiteral = String(hostname || '').replace(/^\[|\]$/g, '');
  if (net.isIP(addressLiteral)) {
    if (isPrivateIp(addressLiteral)) throw new Error('Private network addresses are not allowed.');
    return { address: addressLiteral, family: net.isIP(addressLiteral) };
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isPrivateIp(item.address))) {
    throw new Error('The resource host does not resolve exclusively to public addresses.');
  }

  return addresses[0];
}

function validateRemoteUrl(value, baseUrl = '') {
  let url;
  try {
    if (String(value || '').startsWith('//')) url = new URL(`https:${value}`);
    else if (baseUrl) url = new URL(value, baseUrl);
    else url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
  url.hash = '';
  return url;
}

function requestBuffer(url, address, byteLimit) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      {
        protocol: 'https:',
        hostname: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        servername: url.hostname,
        agent: false,
        headers: {
          accept: '*/*',
          'accept-encoding': 'identity',
          'user-agent': 'AdArchive-Asset-Vendor/1.0'
        },
        lookup(_hostname, options, callback) {
          if (options?.all) callback(null, [address]);
          else callback(null, address.address, address.family);
        }
      },
      (response) => {
        const status = Number(response.statusCode || 0);
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          resolve({ redirect: new URL(response.headers.location, url).toString() });
          return;
        }

        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`Resource returned HTTP ${status || 'error'}.`));
          return;
        }

        const declaredLength = Number(response.headers['content-length'] || 0);
        if (declaredLength > byteLimit) {
          response.destroy();
          reject(new Error('Resource exceeds the external asset size limit.'));
          return;
        }

        const chunks = [];
        let bytes = 0;
        response.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > byteLimit) {
            response.destroy(new Error('Resource exceeds the external asset size limit.'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: response.headers['content-type'] || ''
          });
        });
        response.on('error', reject);
      }
    );

    request.setTimeout(requestTimeoutMs, () => request.destroy(new Error('External resource request timed out.')));
    request.on('error', reject);
  });
}

async function fetchPublicResource(urlValue, redirectCount = 0) {
  const url = validateRemoteUrl(urlValue);
  if (!url) throw new Error('Only public HTTPS render resources are supported.');
  if (redirectCount > maxRedirects) throw new Error('External resource redirected too many times.');

  const address = await resolvePublicAddress(url.hostname);
  const result = await requestBuffer(url, address, maxExternalFileBytes);
  if (result.redirect) return fetchPublicResource(result.redirect, redirectCount + 1);
  return { ...result, url };
}

async function asyncReplace(input, expression, replacer) {
  const matches = [...input.matchAll(expression)];
  if (!matches.length) return input;

  let output = '';
  let cursor = 0;
  for (const match of matches) {
    output += input.slice(cursor, match.index);
    output += await replacer(match);
    cursor = match.index + match[0].length;
  }
  return output + input.slice(cursor);
}

function previewAssetUrl(adId, path) {
  return `/api/html5/${encodeURIComponent(adId)}/${String(path)
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}

function isIgnoredUrl(value) {
  return /^(?:#|data:|blob:|about:|javascript:|mailto:|tel:)/i.test(String(value || '').trim());
}

function isLikelyStaticResource(value, baseUrl = '') {
  const url = validateRemoteUrl(value, baseUrl);
  return Boolean(url && vendorableExtensions.has(extensionForUrl(url)));
}

function neutralizeNavigation(html) {
  return html
    .replace(
      /<script\b(?=[^>]*\bsrc=(["'])(?:https?:)?\/\/s0\.2mdn\.net\/ads\/studio\/Enabler\.js(?:[?#][^"']*)?\1)[^>]*>\s*<\/script>/gi,
      ''
    )
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/<meta\b(?=[^>]*http-equiv\s*=\s*(["'])?refresh\1?)[^>]*>/gi, '')
    .replace(/<(?:iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed)\s*>/gi, '')
    .replace(/<(?:iframe|object|embed)\b[^>]*\/?>/gi, '')
    .replace(/\s+ping\s*=\s*(["'])[\s\S]*?\1/gi, '')
    .replace(/(<a\b[^>]*?)\s+href\s*=\s*(["'])[\s\S]*?\2/gi, '$1 href="#"')
    .replace(/(<form\b[^>]*?)\s+action\s*=\s*(["'])[\s\S]*?\2/gi, '$1 action="#"')
    .replace(/<form\b(?![^>]*\bonsubmit=)([^>]*)>/gi, '<form$1 onsubmit="return false">');
}

function createBundler({ adId, files, mimeTypes }) {
  const remotePaths = new Map();
  const remoteDomains = new Set();
  let externalBytes = 0;
  let externalFiles = 0;

  async function vendor(rawUrl, baseUrl = '', required = true) {
    if (isIgnoredUrl(rawUrl)) return rawUrl;
    const remoteUrl = validateRemoteUrl(rawUrl, baseUrl);
    if (!remoteUrl) return rawUrl;

    const key = remoteUrl.toString();
    if (remotePaths.has(key)) return previewAssetUrl(adId, remotePaths.get(key));
    if (externalFiles >= maxExternalFiles) throw new Error(`HTML5 previews can vendor at most ${maxExternalFiles} external files.`);

    let fetched;
    try {
      fetched = await fetchPublicResource(key);
    } catch (error) {
      if (!required) return 'about:blank';
      throw new Error(`Unable to safely copy ${remoteUrl.hostname}: ${error.message}`);
    }

    const extension = extensionForResource(fetched.url, fetched.contentType);
    if (!extension || !vendorableExtensions.has(extension)) {
      if (!required) return 'about:blank';
      throw new Error(`Unsupported external resource type from ${remoteUrl.hostname}.`);
    }

    externalBytes += fetched.buffer.length;
    externalFiles += 1;
    if (externalBytes > maxExternalTotalBytes) {
      throw new Error('External render dependencies exceed the 10 MB privacy-vendoring limit.');
    }

    const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 24);
    const path = `${externalAssetRoot}/${hash}.${extension}`;
    const file = {
      path,
      buffer: fetched.buffer,
      contentType: mimeTypes[extension] || fetched.contentType || 'application/octet-stream',
      remoteUrl: fetched.url.toString()
    };

    remotePaths.set(key, path);
    remotePaths.set(fetched.url.toString(), path);
    remoteDomains.add(fetched.url.hostname);
    files.push(file);

    await rewriteFile(file);
    return previewAssetUrl(adId, path);
  }

  async function rewriteCss(css, baseUrl = '') {
    let output = await asyncReplace(
      css,
      /@import\s+(?:url\(\s*)?(["'])([^"']+)\1\s*\)?([^;]*);/gi,
      async (match) => {
        const nextUrl = await vendor(match[2], baseUrl, true);
        return `@import url("${nextUrl}")${match[3] || ''};`;
      }
    );

    output = await asyncReplace(output, /url\(\s*(["']?)([^"'()]+)\1\s*\)/gi, async (match) => {
      const value = match[2].trim();
      if (isIgnoredUrl(value)) return match[0];
      const nextUrl = await vendor(value, baseUrl, true);
      return `url("${nextUrl}")`;
    });
    return output;
  }

  async function rewriteJavaScript(source, baseUrl = '') {
    let output = await asyncReplace(
      source,
      /(\b(?:import|export)\s+(?:[\s\S]*?\sfrom\s*)?|\bimport\s*\(\s*|\bimportScripts\s*\(\s*|\bnew\s+(?:Worker|SharedWorker)\s*\(\s*)(["'])([^"']+)\2/gi,
      async (match) => `${match[1]}${match[2]}${await vendor(match[3], baseUrl, true)}${match[2]}`
    );

    output = await asyncReplace(output, /(["'`])((?:https:)?\/\/[^"'`\\\s]+)\1/gi, async (match) => {
      if (isLikelyStaticResource(match[2], baseUrl)) {
        return `${match[1]}${await vendor(match[2], baseUrl, true)}${match[1]}`;
      }
      return `${match[1]}about:blank${match[1]}`;
    });

    return output
      .replace(
        /\b(?:window|self|document|top|parent)\s*(?:\.\s*location|\[\s*["']location["']\s*\])(?:\s*\.\s*href|\[\s*["']href["']\s*\])?\s*=\s*[^;\n]+;?/gi,
        'void 0;'
      )
      .replace(/\blocation\s*\.\s*href\s*=\s*[^;\n]+;?/gi, 'void 0;')
      .replace(
        /\b(?:window\s*\.\s*)?location\s*\.\s*(?:assign|replace)\s*\([^;\n]*\)\s*;?/gi,
        'void 0;'
      );
  }

  async function rewriteGltf(buffer, baseUrl = '') {
    let document;
    try {
      document = JSON.parse(buffer.toString('utf8'));
    } catch {
      return buffer;
    }

    for (const collection of [document.buffers || [], document.images || []]) {
      for (const item of collection) {
        if (!item?.uri || isIgnoredUrl(item.uri)) continue;
        item.uri = await vendor(item.uri, baseUrl, true);
      }
    }
    return Buffer.from(JSON.stringify(document));
  }

  async function rewriteHtml(html) {
    let output = neutralizeNavigation(html);

    output = await asyncReplace(output, /<link\b[^>]*>/gi, async (match) => {
      const tag = match[0];
      const href = tag.match(/\bhref\s*=\s*(?:(["'])([^"']+)\1|([^\s>]+))/i);
      if (!href) return tag;
      const hrefValue = href[2] || href[3];
      const hrefQuote = href[1] || '"';
      if (isIgnoredUrl(hrefValue)) return tag;

      const rel = tag.match(/\brel\s*=\s*(["'])([^"']+)\1/i)?.[2]?.toLowerCase() || '';
      const renders = rel.split(/\s+/).some((value) => ['stylesheet', 'icon', 'preload', 'modulepreload'].includes(value));
      if (!renders && validateRemoteUrl(hrefValue)) return '';
      if (!validateRemoteUrl(hrefValue)) return tag;

      const nextUrl = await vendor(hrefValue, '', true);
      return tag.replace(href[0], `href=${hrefQuote}${nextUrl}${hrefQuote}`);
    });

    output = await asyncReplace(
      output,
      /(<script\b[^>]*\bsrc\s*=\s*)(["'])((?:https:)?\/\/[^"']+)\2/gi,
      async (match) => `${match[1]}${match[2]}${await vendor(match[3], '', true)}${match[2]}`
    );

    output = await asyncReplace(
      output,
      /(\b(?:src|poster)\s*=\s*)(["'])((?:https:)?\/\/[^"']+)\2/gi,
      async (match) => `${match[1]}${match[2]}${await vendor(match[3], '', true)}${match[2]}`
    );

    output = await asyncReplace(
      output,
      /(\b(?:src|poster)\s*=\s*)((?:https:)?\/\/[^\s"'`>]+)/gi,
      async (match) => `${match[1]}"${await vendor(match[2], '', true)}"`
    );

    output = await asyncReplace(output, /\bsrcset\s*=\s*(["'])([^"']+)\1/gi, async (match) => {
      const candidates = [];
      for (const candidate of match[2].split(',')) {
        const [url, ...descriptor] = candidate.trim().split(/\s+/);
        candidates.push(`${await vendor(url, '', true)}${descriptor.length ? ` ${descriptor.join(' ')}` : ''}`);
      }
      return `srcset=${match[1]}${candidates.join(', ')}${match[1]}`;
    });

    output = await asyncReplace(output, /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, async (match) => {
      return match[0].replace(match[1], await rewriteCss(match[1]));
    });

    output = await asyncReplace(output, /\bstyle\s*=\s*(["'])([^"']*)\1/gi, async (match) => {
      return `style=${match[1]}${await rewriteCss(match[2])}${match[1]}`;
    });

    output = await asyncReplace(output, /\bon[a-z]+\s*=\s*(["'])([\s\S]*?)\1/gi, async (match) => {
      return match[0].replace(match[2], await rewriteJavaScript(match[2]));
    });

    output = await asyncReplace(output, /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script\s*>/gi, async (match) => {
      return match[0].replace(match[1], await rewriteJavaScript(match[1]));
    });

    return output;
  }

  async function rewriteFile(file) {
    const extension = String(file.path).split('.').pop().toLowerCase();
    const baseUrl = file.remoteUrl || '';

    if (extension === 'css') {
      file.buffer = Buffer.from(await rewriteCss(file.buffer.toString('utf8'), baseUrl));
    } else if (extension === 'js') {
      file.buffer = Buffer.from(await rewriteJavaScript(file.buffer.toString('utf8'), baseUrl));
    } else if (extension === 'gltf') {
      file.buffer = await rewriteGltf(file.buffer, baseUrl);
    } else if (extension === 'html' || extension === 'htm') {
      file.buffer = Buffer.from(await rewriteHtml(file.buffer.toString('utf8')));
    }
  }

  return {
    async bundle() {
      const originalFiles = files.slice();
      for (const file of originalFiles) await rewriteFile(file);
      return {
        files,
        externalFileCount: externalFiles,
        externalBytes,
        externalDomains: [...remoteDomains].sort()
      };
    }
  };
}

async function bundleHtml5PrivacyAssets({ adId, files, mimeTypes }) {
  return createBundler({ adId, files, mimeTypes }).bundle();
}

module.exports = {
  bundleHtml5PrivacyAssets,
  privacyCsp
};
