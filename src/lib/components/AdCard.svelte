<script>
  import { goto } from '$app/navigation';
  import { rememberArchiveScroll } from '$lib/utils/archive-scroll';
  import CreativePreview from './CreativePreview.svelte';

  export let ad;
  export let externalLinks = false;

  let mobilePreviewActive = false;
  let previewAdId = ad.id;

  $: adPath = `/ad/${encodeURIComponent(String(ad.id))}`;
  $: if (ad.id !== previewAdId) {
    previewAdId = ad.id;
    mobilePreviewActive = false;
  }

  function openAdPage() {
    rememberArchiveScroll();
    goto(adPath);
  }

  function usesTapPreview() {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none), (pointer: coarse)').matches
    );
  }

  function handleCardClick(event) {
    if (ad.type === 'video' && usesTapPreview() && !mobilePreviewActive) {
      event.preventDefault();
      mobilePreviewActive = true;
      return;
    }

    if (externalLinks) rememberArchiveScroll();
    else openAdPage();
  }
</script>

<article class="ad-card" class:is-preview-active={mobilePreviewActive}>
  {#if externalLinks}
    <a
      class="creative-button"
      href={adPath}
      target="_blank"
      rel="noreferrer"
      aria-label={ad.type === 'video' && !mobilePreviewActive ? `Preview ${ad.title}` : `Open ${ad.title}`}
      on:click={handleCardClick}
    >
      <div class="creative-preview">
        <CreativePreview {ad} previewActive={mobilePreviewActive} on:mediaready />
      </div>
    </a>
  {:else}
    <button
      class="creative-button"
      type="button"
      aria-label={ad.type === 'video' && !mobilePreviewActive ? `Preview ${ad.title}` : `Open ${ad.title}`}
      on:click={handleCardClick}
    >
      <div class="creative-preview">
        <CreativePreview {ad} previewActive={mobilePreviewActive} on:mediaready />
      </div>
    </button>
  {/if}
</article>
