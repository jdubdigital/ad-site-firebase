import { browser } from '$app/environment';
import { goto } from '$app/navigation';

const archiveScrollKey = 'adArchiveScrollY';
const archiveReturnKey = 'adArchiveReturnPending';

export function rememberArchiveScroll() {
  if (!browser || window.location.pathname !== '/') return;

  sessionStorage.setItem(archiveScrollKey, String(window.scrollY || 0));
}

export async function returnToArchive() {
  if (!browser) {
    await goto('/');
    return;
  }

  sessionStorage.setItem(archiveReturnKey, '1');
  await goto('/', { noScroll: true });
  restoreArchiveScroll();
}

export function restoreArchiveScroll() {
  if (!browser || window.location.pathname !== '/') return;
  if (sessionStorage.getItem(archiveReturnKey) !== '1') return;

  const savedY = Number(sessionStorage.getItem(archiveScrollKey) || 0);
  if (!Number.isFinite(savedY) || savedY <= 0) {
    sessionStorage.removeItem(archiveReturnKey);
    return;
  }

  sessionStorage.removeItem(archiveReturnKey);

  let attempts = 0;
  const scrollToSavedPosition = () => {
    attempts += 1;
    window.scrollTo({ top: savedY, left: 0, behavior: 'auto' });

    if (attempts < 8 && Math.abs(window.scrollY - savedY) > 2) {
      requestAnimationFrame(scrollToSavedPosition);
    }
  };

  requestAnimationFrame(scrollToSavedPosition);
}
