<script>
  import { onMount, tick } from 'svelte';
  import { getAdTypeLabel, getCreativeFallback } from '$lib/utils/ad-utils';

  export let ad;
  export let large = false;

  let frameShell;
  let frameScale = 1;

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

  function resizeFrame() {
    if (!frameShell) return;
    const availableWidth = large
      ? frameShell.parentElement?.clientWidth || frameShell.clientWidth || intrinsicWidth
      : frameShell.clientWidth || intrinsicWidth;
    frameScale = Math.min(1, availableWidth / intrinsicWidth);
  }

  $: if (ad?.htmlPreviewUrl) {
    tick().then(resizeFrame);
  }

  onMount(() => {
    resizeFrame();
    if (!frameShell || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(resizeFrame);
    observer.observe(frameShell);
    return () => observer.disconnect();
  });
</script>

{#if ad.type === 'html5'}
  {#if ad.htmlPreviewUrl}
    <div bind:this={frameShell} class:html5-frame-large={large} class="html5-frame-shell" style={shellStyle}>
      <iframe
        src={ad.htmlPreviewUrl}
        title={`${ad.title} HTML5 preview`}
        sandbox="allow-scripts"
        loading={large ? 'eager' : 'lazy'}
        referrerpolicy="no-referrer"
        tabindex="-1"
        style={frameStyle}
      ></iframe>
    </div>
  {:else}
    <div class:large-creative-preview={large} class="html5-preview">
      <div class="html5-box">
        <p class="eyebrow">{large ? 'HTML5 ZIP Package' : 'HTML5 ZIP'}</p>
        <h3>{ad.title}</h3>
        <p class="muted">{ad.mediaFileName || 'Packaged creative'} · {ad.size}</p>
        {#if ad.htmlPreviewStatus === 'failed'}
          <p class="muted">{ad.htmlPreviewError || 'The ZIP preview could not be extracted.'}</p>
        {:else if large}
          <p class="muted">Upload a new ZIP to extract and preview this package.</p>
        {/if}
      </div>
    </div>
  {/if}
{:else if ad.type === 'video'}
  <video
    autoplay
    loop
    muted
    playsinline
    disablepictureinpicture
    controlslist="nodownload nofullscreen noremoteplayback"
    aria-label={`${ad.title} ${getAdTypeLabel(ad.type)} preview`}
  >
    <source src={src} type="video/mp4" />
  </video>
{:else}
  <img src={src} alt={ad.title} loading={large ? 'eager' : 'lazy'} />
{/if}
