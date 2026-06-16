<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onDestroy, tick } from 'svelte';
  import LivePreviewDebugPanel from '$lib/components/LivePreviewDebugPanel.svelte';
  import { ads, adsReady } from '$lib/stores/archive';
  import { createAdRuntime } from '$lib/ad-runtime';
  import { getAdTypeLabel, getAdUserName, getMediumLabel } from '$lib/utils/ad-utils';

  let liveFrame;
  let adSlot;
  let runtime;
  let runtimeKey = '';
  let runtimeState = null;
  let runtimeLogs = [];
  let impressionFired = false;
  let bridgeReady = false;
  let bridgeInfo = null;
  let slotAvailableWidth = 0;
  let resizeObserver;

  $: adId = decodeURIComponent($page.params.id || '');
  $: ad = $ads.find((item) => String(item.id) === adId);
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
  $: watchSlot(adSlot);
  $: attachRuntime(ad?.id, hasHtmlProgrammaticPreview ? ad?.htmlPreviewUrl : '', liveFrame, adSlot, frameScale);

  function addLog(log) {
    runtimeLogs = [
      {
        timestamp: Date.now(),
        ...log
      },
      ...runtimeLogs
    ].slice(0, 60);
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
    runtimeState = null;
    runtimeLogs = [];
    impressionFired = false;
    bridgeReady = false;
    bridgeInfo = null;

    if (!nextKey) return;

    tick().then(() => {
      if (runtimeKey !== nextKey || !liveFrame || !adSlot) return;
      runtime = createAdRuntime({
        iframe: liveFrame,
        slot: adSlot,
        creativeWidth: frameWidth,
        creativeHeight: frameHeight,
        creativeScale: scale,
        onUpdate: (update) => (runtimeState = update),
        onLog: addLog,
        onImpression: () => (impressionFired = true),
        onBridgeReady: (event) => {
          bridgeReady = true;
          bridgeInfo = event;
        }
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
          <p class="muted">{getAdTypeLabel(ad.type)} · {getMediumLabel(ad.medium)} · {ad.size} · Posted by {getAdUserName(ad)}</p>
        {/if}
      </div>
      <button class="button button-secondary" type="button" on:click={() => goto(ad ? `/ad/${encodeURIComponent(String(ad.id))}` : '/')}>
        Back to ad detail
      </button>
    </div>

    {#if ad && hasHtmlProgrammaticPreview}
      <article class="publisher-sim">
        <section class="publisher-band">
          <p class="eyebrow">Publisher Feature</p>
          <h2>How brands are adapting creative for attention-light environments</h2>
          <p>
            This simulated article gives the uploaded creative real page context: scrolling, viewport changes, and a normal content rhythm
            around the ad slot.
          </p>
        </section>

        <div class="publisher-layout">
          <main class="publisher-story">
            <p>
              Performance creative has moved beyond flat uploads. Rich display, mobile placements, and dynamic programmatic units often depend on
              runtime signals from the page around them.
            </p>
            <p>
              The ad below runs in an isolated iframe. The preview page sends viewport and viewability state to the creative while preserving the
              regular archive experience everywhere else.
            </p>

            <aside class="publisher-ad-callout">
              <span>Advertisement</span>
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
            </aside>

            <p>
              Keep scrolling to test how the ad behaves as it moves in and out of view. The debug panel tracks visible percentage, total visible
              time, and simulated impression state.
            </p>
            <p>
              This is intentionally separate from the main archive feed so that live rich-media behavior does not slow down browsing or loosen the
              safer default preview mode.
            </p>
            <p>
              Resize the browser to test responsive behavior. Runtime updates are throttled with requestAnimationFrame and cleaned up when you leave
              this route.
            </p>
          </main>

          <aside class="publisher-sidebar">
            <h2>Preview Notes</h2>
            <p class="muted">Scripts are allowed only inside this live preview iframe. Popups and top-window navigation are not allowed.</p>
            <dl class="detail-list">
              <div>
                <dt>Format</dt>
                <dd>{getAdTypeLabel(ad.type)}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{ad.size}</dd>
              </div>
              <div>
                <dt>Preview</dt>
                <dd>{bridgeReady ? 'Runtime bridge ready' : 'Waiting for bridge'}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </article>

      <LivePreviewDebugPanel {runtimeState} logs={runtimeLogs} {impressionFired} {bridgeReady} {bridgeInfo} />
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
    {:else if !$adsReady}
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
