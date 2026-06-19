<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { createEventDispatcher } from 'svelte';
  import { rememberArchiveScroll } from '$lib/utils/archive-scroll';
  import CreativePreview from './CreativePreview.svelte';

  export let ad;
  export let externalLinks = false;
  export let previewActive = false;

  const dispatch = createEventDispatcher();

  $: adPath = `/ad/${encodeURIComponent(String(ad.id))}`;
  $: requiresPreviewIntent =
    ad.type === 'video' || ad.type === 'gif' || (ad.type === 'html5' && Boolean(ad.htmlPreviewUrl));

  function openAdPage() {
    rememberArchiveScroll();
    goto(adPath);
  }

  function usesTapToPreview() {
    return browser && window.matchMedia('(hover: none)').matches;
  }

  function handleCardClick(event) {
    if (requiresPreviewIntent && usesTapToPreview() && !previewActive) {
      event.preventDefault();
      dispatch('previewactivate');
      return;
    }

    if (externalLinks) {
      rememberArchiveScroll();
    } else {
      openAdPage();
    }
  }

  function handleMouseEnter() {
    if (requiresPreviewIntent && !usesTapToPreview()) dispatch('previewactivate');
  }

  function handleMouseLeave() {
    if (requiresPreviewIntent && !usesTapToPreview()) dispatch('previewdeactivate');
  }

  function handleFocus() {
    if (requiresPreviewIntent && !usesTapToPreview()) dispatch('previewactivate');
  }

  function handleBlur() {
    if (requiresPreviewIntent && !usesTapToPreview()) dispatch('previewdeactivate');
  }
</script>

<article
  class="ad-card"
  class:is-preview-active={previewActive}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  on:focusin={handleFocus}
  on:focusout={handleBlur}
>
  {#if externalLinks}
    <a
      class="creative-button"
      href={adPath}
      target="_blank"
      rel="noreferrer"
      aria-label={requiresPreviewIntent && !previewActive ? `Preview or open ${ad.title}` : `Open ${ad.title}`}
      on:click={handleCardClick}
    >
      <div class="creative-preview">
        <CreativePreview {ad} active={previewActive} on:mediaready />
      </div>
    </a>
  {:else}
    <button
      class="creative-button"
      type="button"
      aria-label={requiresPreviewIntent && !previewActive ? `Preview or open ${ad.title}` : `Open ${ad.title}`}
      on:click={handleCardClick}
    >
      <div class="creative-preview">
        <CreativePreview {ad} active={previewActive} on:mediaready />
      </div>
    </button>
  {/if}
</article>
