<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onDestroy, tick } from 'svelte';
  import { loadAdById } from '$lib/repositories/ads';
  import { ads, adsReady } from '$lib/stores/archive';
  import { createAdRuntime } from '$lib/ad-runtime';
  import { getAdTypeLabel, getAdUserName, getMediumLabel } from '$lib/utils/ad-utils';

  let liveFrame;
  let adSlot;
  let runtime;
  let runtimeKey = '';
  let slotAvailableWidth = 0;
  let resizeObserver;
  let routeAd = null;
  let routeAdReady = false;
  let fetchedAdId = '';
  let routeFetchRun = 0;

  $: adId = decodeURIComponent($page.params.id || '');
  $: storeAd = $ads.find((item) => String(item.id) === adId);
  $: ad = storeAd || (String(routeAd?.id || '') === adId ? routeAd : null);
  $: isHtmlProgrammatic = ad?.type === 'html5';
  $: hasHtmlProgrammaticPreview = isHtmlProgrammatic && Boolean(ad?.htmlPreviewUrl);
  $: [creativeWidth, creativeHeight] = String(ad?.size || '300x250')
    .split('x')
    .map((value) => Number(value) || 0);
  $: frameWidth = creativeWidth || 300;
  $: frameHeight = creativeHeight || 250;
  $: frameScale = frameWidth > 0 && slotAvailableWidth > 0 ? Math.min(1, slotAvailableWidth / frameWidth) : 1;
  $: scaledFrameWidth = Math.ceil(frameWidth * frameScale);
  $: scaledFrameHeight = Math.ceil(frameHeight * frameScale);
  $: frameStyle = `width: ${frameWidth}px; height: ${frameHeight}px; transform: scale(${frameScale});`;
  $: frameShellStyle = `width: ${scaledFrameWidth}px; height: ${scaledFrameHeight}px;`;
  $: slotStyle = `--creative-width: ${frameWidth}px;`;
  $: loadRouteAd(adId, storeAd);
  $: watchSlot(adSlot);
  $: attachRuntime(ad?.id, hasHtmlProgrammaticPreview ? ad?.htmlPreviewUrl : '', liveFrame, adSlot, frameScale);

  async function loadRouteAd(id, knownAd) {
    if (!browser || !id || knownAd || fetchedAdId === id) return;

    const run = ++routeFetchRun;
    fetchedAdId = id;
    routeAdReady = false;
    routeAd = null;

    try {
      const loadedAd = await loadAdById(id);
      if (run !== routeFetchRun) return;
      routeAd = loadedAd;
    } catch (error) {
      if (run !== routeFetchRun) return;
      routeAd = null;
    } finally {
      if (run === routeFetchRun) routeAdReady = true;
    }
  }

  function watchSlot(slot) {
    if (!browser || !slot || resizeObserver) return;
    resizeObserver = new ResizeObserver(([entry]) => {
      slotAvailableWidth = entry?.contentRect?.width || slot.clientWidth || 0;
      runtime?.update();
    });
    resizeObserver.observe(slot);
    slotAvailableWidth = slot.clientWidth || 0;
  }

  function attachRuntime(id, previewUrl, frame, slot, scale) {
    const nextKey = browser && id && previewUrl && frame && slot ? `${id}-${previewUrl}-${scale}` : '';
    if (nextKey === runtimeKey) return;

    runtime?.destroy();
    runtime = null;
    runtimeKey = nextKey;

    if (!nextKey) return;

    tick().then(() => {
      if (runtimeKey !== nextKey || !liveFrame || !adSlot) return;
      runtime = createAdRuntime({
        iframe: liveFrame,
        slot: adSlot,
        creativeWidth: frameWidth,
        creativeHeight: frameHeight,
        creativeScale: scale
      });
    });
  }

  function handleFrameLoad() {
    runtime?.update();
  }

  onDestroy(() => {
    runtime?.destroy();
    resizeObserver?.disconnect();
  });
</script>

<svelte:head>
  <title>{ad ? `${ad.title} Live Preview · Ad Archive` : 'Live Preview · Ad Archive'}</title>
</svelte:head>

<section class="live-preview-page">
  <div class="container">
    <div class="live-preview-header">
      <div>
        <p class="eyebrow">Live Preview</p>
        <h1>{ad ? ad.title : 'Programmatic preview'}</h1>
        {#if ad}
          <p class="muted">{getAdTypeLabel(ad.type)} · {getMediumLabel(ad.medium)} · Posted by {getAdUserName(ad)}</p>
        {/if}
      </div>
      <button class="button button-secondary" type="button" on:click={() => goto(ad ? `/ad/${encodeURIComponent(String(ad.id))}` : '/')}>
        Back to ad detail
      </button>
    </div>

    {#if ad && hasHtmlProgrammaticPreview}
      <main class="live-ad-stage" aria-label={`${ad.title} live preview`}>
        <div class="live-placement-intro">
          <p class="eyebrow">Simulated Page Placement</p>
          <p>Scroll down to bring the ad into view, then keep scrolling to test scroll-reactive creative behavior.</p>
        </div>

        <div class="live-placement-content" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>

        <div class="live-placement-ad">
          <span class="live-placement-label">Ad placement</span>
          <div bind:this={adSlot} class="live-ad-slot" style={slotStyle}>
            <div class="live-ad-frame-shell" style={frameShellStyle}>
              <iframe
                bind:this={liveFrame}
                src={ad.htmlPreviewUrl}
                title={`${ad.title} live programmatic preview`}
                sandbox="allow-scripts"
                referrerpolicy="no-referrer"
                style={frameStyle}
                on:load={handleFrameLoad}
              ></iframe>
            </div>
          </div>
        </div>

        <div class="live-placement-content live-placement-content-after" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </main>
    {:else if ad && !isHtmlProgrammatic}
      <div class="empty-state">
        <h1>Live preview is only for HTML programmatic ads</h1>
        <p class="muted">This creative is a {getAdTypeLabel(ad.type)} file, so the normal ad detail preview is the right view.</p>
        <button class="button button-primary" type="button" on:click={() => goto(`/ad/${encodeURIComponent(String(ad.id))}`)}>
          Back to ad detail
        </button>
      </div>
    {:else if ad && !ad.htmlPreviewUrl}
      <div class="empty-state">
        <h1>Preview is not ready</h1>
        <p class="muted">{ad.htmlPreviewError || 'This programmatic package has not produced a live HTML preview yet.'}</p>
        <button class="button button-primary" type="button" on:click={() => goto(`/ad/${encodeURIComponent(String(ad.id))}`)}>
          Back to ad detail
        </button>
      </div>
    {:else if !$adsReady && !routeAdReady}
      <div class="empty-state">
        <h1>Loading live preview</h1>
        <p class="muted">Checking the archive for this creative.</p>
      </div>
    {:else}
      <div class="empty-state">
        <h1>Ad not found</h1>
        <p class="muted">This creative does not exist in the archive.</p>
        <button class="button button-primary" type="button" on:click={() => goto('/')}>Back to archive</button>
      </div>
    {/if}
  </div>
</section>
