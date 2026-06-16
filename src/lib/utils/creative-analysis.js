const sizePattern = /(?:^|[^0-9])([1-9][0-9]{1,3})\s*[xX]\s*([1-9][0-9]{1,3})(?=$|[^0-9])/g;

function sizeFromNumbers(width, height) {
  const cleanWidth = Number(width);
  const cleanHeight = Number(height);
  if (!cleanWidth || !cleanHeight) return '';
  return `${Math.round(cleanWidth)}x${Math.round(cleanHeight)}`;
}

function sortSizes(sizes) {
  return [...new Set(sizes)]
    .filter(Boolean)
    .sort((a, b) => {
      const [aWidth, aHeight] = a.split('x').map(Number);
      const [bWidth, bHeight] = b.split('x').map(Number);
      return bWidth * bHeight - aWidth * aHeight || bWidth - aWidth || bHeight - aHeight;
    });
}

function detectSizesFromText(value) {
  const sizes = [];
  const text = String(value || '');
  let match;

  sizePattern.lastIndex = 0;
  while ((match = sizePattern.exec(text))) {
    sizes.push(sizeFromNumbers(match[1], match[2]));
  }

  return sizes;
}

function fileTitle(fileName) {
  return String(fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isZipFile(file) {
  return (
    String(file?.name || '').toLowerCase().endsWith('.zip') ||
    file?.type === 'application/zip' ||
    file?.type === 'application/x-zip-compressed'
  );
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        type: file.type === 'image/gif' ? 'gif' : 'image',
        label: file.type === 'image/gif' ? 'GIF' : 'Image',
        size: sizeFromNumbers(image.naturalWidth, image.naturalHeight),
        sizes: [sizeFromNumbers(image.naturalWidth, image.naturalHeight)].filter(Boolean)
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to read image dimensions.'));
    };
    image.src = url;
  });
}

function readVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');

    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        type: 'video',
        label: 'Video',
        size: sizeFromNumbers(video.videoWidth, video.videoHeight),
        sizes: [sizeFromNumbers(video.videoWidth, video.videoHeight)].filter(Boolean)
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to read video dimensions.'));
    };
    video.src = url;
  });
}

function findEndOfCentralDirectory(view) {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, view.byteLength - 66000);

  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === signature) return offset;
  }

  return -1;
}

function readZipEntries(buffer) {
  const view = new DataView(buffer);
  const decoder = new TextDecoder();
  const endOffset = findEndOfCentralDirectory(view);
  if (endOffset < 0) return [];

  const centralDirectorySize = view.getUint32(endOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(endOffset + 16, true);
  const entries = [];
  let offset = centralDirectoryOffset;
  const end = Math.min(view.byteLength, centralDirectoryOffset + centralDirectorySize);

  while (offset + 46 <= end && view.getUint32(offset, true) === 0x02014b50) {
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;

    if (nameEnd > view.byteLength) break;
    entries.push(decoder.decode(new Uint8Array(buffer, nameStart, fileNameLength)));
    offset = nameEnd + extraLength + commentLength;
  }

  return entries;
}

async function readZip(file) {
  const buffer = await file.arrayBuffer();
  const entries = readZipEntries(buffer);
  const htmlEntries = entries.filter((entry) => /\.html?$/i.test(entry));
  const detectedSizes = sortSizes(entries.flatMap(detectSizesFromText));

  return {
    type: 'html5',
    label: 'Programmatic',
    size: detectedSizes[0] || '',
    sizes: detectedSizes,
    entries,
    htmlEntries,
    note: detectedSizes.length
      ? `${detectedSizes.length} size${detectedSizes.length === 1 ? '' : 's'} detected from ZIP structure.`
      : 'No fixed size was detected from the ZIP structure.'
  };
}

export async function analyzeCreativeFile(file) {
  if (!file) throw new Error('Choose a creative asset first.');

  if (isZipFile(file)) {
    return {
      fileName: file.name,
      title: fileTitle(file.name),
      ...(await readZip(file))
    };
  }

  if (file.type.startsWith('image/')) {
    return {
      fileName: file.name,
      title: fileTitle(file.name),
      ...(await readImage(file))
    };
  }

  if (file.type.startsWith('video/')) {
    return {
      fileName: file.name,
      title: fileTitle(file.name),
      ...(await readVideo(file))
    };
  }

  throw new Error('Please choose an image, GIF, video, or programmatic ZIP file.');
}

export function getCreativeFileType(file) {
  if (!file) return '';
  if (isZipFile(file)) return 'html5';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type === 'image/gif') return 'gif';
  if (file.type.startsWith('image/')) return 'image';
  return '';
}
