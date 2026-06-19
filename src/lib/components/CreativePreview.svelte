<script>
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { getAdTypeLabel, getCreativeFallback } from '$lib/utils/ad-utils';

  export let ad;
  export let large = false;
  export let active = false;

  const dispatch = createEventDispatcher();

  let frameShell;
  let htmlFrame;
  let videoElement;
  let gifSourceElement;
  let gifCanvas;
  let frameScale = 1;
  let mediaNearViewport = large;
  let mediaInViewport = large;
  let mediaReady = false;
  let mediaKey = '';
  let viewportHeight = 0;

  $: src = ad.mediaUrl || getCreativeFallback(ad);
  $: htmlPreviewSrc =
    !large && ad.htmlPreviewUrl
      ? `${ad.htmlPreviewUrl}${ad.htmlPreviewUrl.includes('?') ? '&' : '?'}adArchiveFeedPreview=1`
      : ad.htmlPreviewUrl;
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
  $: requiresPreviewIntent =
    !large && (ad.type === 'video' || ad.type === 'gif' || (ad.type === 'html5' && Boolean(ad.htmlPreviewUrl)));
  $: mediaActive = large || (requiresPreviewIntent ? active : mediaNearViewport);
  $: mediaShellStyle = !large && !mediaActive ? `aspect-ratio: ${intrinsicWidth} / ${intrinsicHeight};` : '';
  $: nextMediaKey = `${ad.id}-${ad.type}-${src}-${ad.htmlPreviewUrl || ''}-${large}`;
  $: if (nextMediaKey !== mediaKey) {
    mediaKey = nextMediaKey;
    mediaNearViewport = large;
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

  $: if (videoElement) {
    if ((large || active) && mediaInViewport) {
      videoElement.play().catch(() => {});
    } else {
      videoElement.pause();
      if (!large && videoElement.readyState >= 1 && videoElement.currentTime > 0) {
        videoElement.currentTime = 0;
      }
    }
  }

  $: if (htmlFrame) {
    htmlFrame.contentWindow?.postMessage(
      {
        type: 'AD_ARCHIVE_PREVIEW_ACTIVITY',
        active: Boolean(large || active)
      },
      '*'
    );
  }

  $: if (gifCanvas && gifSourceElement?.complete) {
    tick().then(captureGifThumbnail);
  }

  function markMediaReady() {
    if (mediaReady) return;
    mediaReady = true;
    tick().then(() => dispatch('mediaready'));
  }

  function captureGifThumbnail() {
    if (!gifSourceElement || !gifCanvas) return;

    const context = gifCanvas.getContext('2d');
    if (!context) return;

    try {
      context.clearRect(0, 0, intrinsicWidth, intrinsicHeight);
      context.drawImage(gifSourceElement, 0, 0, intrinsicWidth, intrinsicHeight);
    } catch (error) {}

    markMediaReady();
  }

  function handleHtmlFrameLoad() {
    markMediaReady();
    htmlFrame?.contentWindow?.postMessage(
      {
        type: 'AD_ARCHIVE_PREVIEW_ACTIVITY',
        active: Boolean(large || active)
      },
      '*'
    );
  }

  function observeMediaWindow(node) {
    if (large || typeof IntersectionObserver === 'undefined') {
      mediaNearViewport = true;
      mediaInViewport = true;
      return {};
    }

    const nearObserver = new IntersectionObserver(
      ([entry]) => {
        mediaNearViewport = entry.isIntersecting;
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
      <iframe
        bind:this={htmlFrame}
        src={htmlPreviewSrc}
        title={`${ad.title} programmatic preview`}
        sandbox="allow-scripts"
        loading={large ? 'eager' : 'lazy'}
        referrerpolicy="no-referrer"
        tabindex="-1"
        style={frameStyle}
        on:load={handleHtmlFrameLoad}
      ></iframe>
      {#if !mediaReady}
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
        <p class="muted">Packaged creative</p>
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
    <video
      bind:this={videoElement}
      autoplay={large}
      preload={large ? 'auto' : 'metadata'}
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
    {#if !mediaReady}
      <div class="creative-loading-layer" aria-hidden="true">
        <span class="loading-spinner small"></span>
      </div>
    {/if}
  </div>
{:else if ad.type === 'gif'}
  <div
    class="creative-media-shell"
    class:is-dormant={!mediaActive && !large}
    class:is-large={large}
    class:is-ready={mediaReady}
    use:observeMediaWindow
    style={mediaShellStyle}
    aria-busy={!mediaReady}
  >
    <img
      bind:this={gifSourceElement}
      class="gif-thumbnail-source"
      src={src}
      alt=""
      aria-hidden="true"
      on:load={captureGifThumbnail}
      on:error={markMediaReady}
    />
    {#if large || active}
      <img src={src} alt={ad.title} loading={large ? 'eager' : 'lazy'} on:load={markMediaReady} on:error={markMediaReady} />
    {:else}
      <canvas
        bind:this={gifCanvas}
        class="gif-thumbnail-canvas"
        width={intrinsicWidth}
        height={intrinsicHeight}
        aria-label={`${ad.title} GIF preview`}
      ></canvas>
    {/if}
    {#if !mediaReady}
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
