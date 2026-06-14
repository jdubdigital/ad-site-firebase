<script>
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { getAdTypeLabel, getCreativeFallback } from '$lib/utils/ad-utils';

  export let ad;
  export let large = false;

  const dispatch = createEventDispatcher();

  let frameShell;
  let videoElement;
  let frameScale = 1;
  let mediaActive = large;
  let mediaInViewport = large;
  let mediaReady = false;
  let mediaKey = '';
  let viewportHeight = 0;

  $: src = ad.mediaUrl || getCreativeFallback(ad);
  $: [creativeWidth, creativeHeight] = String(ad.size || '300x250')
    .split('x')
    .map((value) => Number(value) || 0);
  $: intrinsicWidth = creativeWidth || 300;
  $: intrinsicHeight = creativeHeight || 250;
  $: shellHeight = Math.max(1, Math.round(intrinsicHeight * frameScale));
  $: frameStyle = `width: ${intrinsicWidth}px; height: ${intrinsicHeight}px; transform: scale(${frameScale});`;
  $: shellWidth = Math.max(1, Math.round(intrinsicWidth * frameScale));
  $: shellStyle = large
    ? `width: ${shellWidth}px; height: ${shellHeight}px;`
    : `height: ${shellHeight}px;`;
  $: mediaShellStyle = !large && !mediaActive ? `aspect-ratio: ${intrinsicWidth} / ${intrinsicHeight};` : '';
  $: nextMediaKey = `${ad.id}-${ad.type}-${src}-${ad.htmlPreviewUrl || ''}-${large}`;
  $: if (nextMediaKey !== mediaKey) {
    mediaKey = nextMediaKey;
    mediaActive = large;
    mediaInViewport = large;
    mediaReady = ad.type === 'html5' && !ad.htmlPreviewUrl;
  }

  function resizeFrame() {
    if (!frameShell) return;
    const parent = frameShell.parentElement;
    let availableWidth = frameShell.clientWidth || intrinsicWidth;

    if (large && parent) {
      const parentStyle = window.getComputedStyle(parent);
      const parentPadding =
        Number.parseFloat(parentStyle.paddingLeft || '0') + Number.parseFloat(parentStyle.paddingRight || '0');
      availableWidth = Math.max(1, parent.clientWidth - parentPadding);
    }

    const availableHeight = large && viewportHeight ? Math.max(1, Math.round(viewportHeight * 0.72)) : intrinsicHeight;
    const widthScale = availableWidth / intrinsicWidth;
    const heightScale = large ? availableHeight / intrinsicHeight : 1;
    frameScale = Math.min(1, widthScale, heightScale);
  }

  function handleViewportResize() {
    viewportHeight = window.innerHeight || 0;
    resizeFrame();
  }

  $: if (ad?.htmlPreviewUrl) {
    tick().then(resizeFrame);
  }

  $: if (!mediaActive && !large && mediaReady) {
    mediaReady = ad.type === 'html5' && !ad.htmlPreviewUrl;
  }

  $: if (videoElement) {
    if (mediaInViewport) {
      videoElement.play().catch(() => {});
    } else {
      videoElement.pause();
    }
  }

  function markMediaReady() {
    if (mediaReady) return;
    mediaReady = true;
    tick().then(() => dispatch('mediaready'));
  }

  function observeMediaWindow(node) {
    if (large || typeof IntersectionObserver === 'undefined') {
      mediaActive = true;
      return {};
    }

    const nearObserver = new IntersectionObserver(
      ([entry]) => {
        mediaActive = entry.isIntersecting;
      },
      {
        rootMargin: '900px 0px',
        threshold: 0
      }
    );
    const viewportObserver = new IntersectionObserver(
      ([entry]) => {
        mediaInViewport = entry.isIntersecting;
      },
      {
        threshold: 0.05
      }
    );

    nearObserver.observe(node);
    viewportObserver.observe(node);

    return {
      destroy() {
        nearObserver.disconnect();
        viewportObserver.disconnect();
      }
    };
  }

  onMount(() => {
    handleViewportResize();
    window.addEventListener('resize', handleViewportResize);

    if (!frameShell || typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', handleViewportResize);
    }

    const observer = new ResizeObserver(resizeFrame);
    observer.observe(frameShell);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleViewportResize);
    };
  });
</script>

{#if ad.type === 'html5'}
  {#if ad.htmlPreviewUrl}
    <div
      bind:this={frameShell}
      class:html5-frame-large={large}
      class="html5-frame-shell creative-media-shell"
      class:is-dormant={!mediaActive && !large}
      class:is-ready={mediaReady}
      use:observeMediaWindow
      style={shellStyle}
      aria-busy={!mediaReady}
    >
      {#if mediaActive}
        <iframe
          src={ad.htmlPreviewUrl}
          title={`${ad.title} programmatic preview`}
          sandbox="allow-scripts"
          loading={large ? 'eager' : 'lazy'}
          referrerpolicy="no-referrer"
          tabindex="-1"
          style={frameStyle}
          on:load={markMediaReady}
        ></iframe>
      {/if}
      {#if mediaActive && !mediaReady}
        <div class="creative-loading-layer" aria-hidden="true">
          <span class="loading-spinner small"></span>
        </div>
      {/if}
    </div>
  {:else}
    <div class:large-creative-preview={large} class="html5-preview">
      <div class="html5-box">
        <p class="eyebrow">{large ? 'Programmatic Package' : 'Programmatic'}</p>
        <h3>{ad.title}</h3>
        <p class="muted">Packaged creative · {ad.size}</p>
        {#if ad.htmlPreviewStatus === 'failed'}
          <p class="muted">{ad.htmlPreviewError || 'The ZIP preview could not be extracted.'}</p>
        {:else if large}
          <p class="muted">Upload a new ZIP to extract and preview this package.</p>
        {/if}
      </div>
    </div>
  {/if}
{:else if ad.type === 'video'}
  <div
    class="creative-media-shell"
    class:is-dormant={!mediaActive && !large}
    class:is-large={large}
    class:is-ready={mediaReady}
    use:observeMediaWindow
    style={mediaShellStyle}
    aria-busy={!mediaReady}
  >
    {#if mediaActive}
      <video
        bind:this={videoElement}
        autoplay={mediaInViewport}
        loop
        muted
        playsinline
        disablepictureinpicture
        controlslist="nodownload nofullscreen noremoteplayback"
        aria-label={`${ad.title} ${getAdTypeLabel(ad.type)} preview`}
        on:loadeddata={markMediaReady}
        on:canplay={markMediaReady}
      >
        <source src={src} type="video/mp4" />
      </video>
    {/if}
    {#if mediaActive && !mediaReady}
      <div class="creative-loading-layer" aria-hidden="true">
        <span class="loading-spinner small"></span>
      </div>
    {/if}
  </div>
{:else}
  <div
    class="creative-media-shell"
    class:is-dormant={!mediaActive && !large}
    class:is-large={large}
    class:is-ready={mediaReady}
    use:observeMediaWindow
    style={mediaShellStyle}
    aria-busy={!mediaReady}
  >
    {#if mediaActive}
      <img src={src} alt={ad.title} loading={large ? 'eager' : 'lazy'} on:load={markMediaReady} on:error={markMediaReady} />
    {/if}
    {#if mediaActive && !mediaReady}
      <div class="creative-loading-layer" aria-hidden="true">
        <span class="loading-spinner small"></span>
      </div>
    {/if}
  </div>
{/if}
