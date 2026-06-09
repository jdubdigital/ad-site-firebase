<script>
  import { getAdTypeLabel, getCreativeFallback } from '$lib/utils/ad-utils';

  export let ad;
  export let large = false;

  $: src = ad.mediaUrl || getCreativeFallback(ad);
</script>

{#if ad.type === 'html5'}
  <div class:lightbox-creative={large} class="html5-preview">
    <div class="html5-box">
      <p class="eyebrow">{large ? 'HTML5 ZIP Package' : 'HTML5 ZIP'}</p>
      <h3>{ad.title}</h3>
      <p class="muted">{ad.mediaFileName || 'Packaged creative'} · {ad.size}</p>
      {#if large}
        <p class="muted">
          In production, Firebase Storage can hold the ZIP while a backend validation step extracts and serves it in a sandboxed preview.
        </p>
      {/if}
    </div>
  </div>
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
