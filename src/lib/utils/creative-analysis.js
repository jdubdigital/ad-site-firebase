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

export async function analyzeCreativeFile(file) {
  if (!file) throw new Error('Choose a creative asset first.');

  if (isZipFile(file)) {
    return {
      type: 'html5',
      label: 'Programmatic',
      fileName: file.name,
      title: fileTitle(file.name),
      note: 'Programmatic ZIP selected. Choose the display sizes you want to showcase.'
    };
  }

  if (file.type.startsWith('video/')) {
    return {
      type: 'video',
      label: 'Video',
      fileName: file.name,
      title: fileTitle(file.name)
    };
  }

  if (file.type.startsWith('image/')) {
    return {
      type: file.type === 'image/gif' ? 'gif' : 'image',
      label: file.type === 'image/gif' ? 'GIF' : 'Image',
      fileName: file.name,
      title: fileTitle(file.name)
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
