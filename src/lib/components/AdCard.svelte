<script>
  import { goto } from '$app/navigation';
  import CreativePreview from './CreativePreview.svelte';

  export let ad;
  export let externalLinks = false;

  $: adPath = `/ad/${encodeURIComponent(String(ad.id))}`;

  function openAdPage() {
    goto(adPath);
  }
</script>

<article class="ad-card">
  {#if externalLinks}
    <a class="creative-button" href={adPath} target="_blank" rel="noreferrer" aria-label={`Open ${ad.title}`}>
      <div class="creative-preview">
        <CreativePreview {ad} on:mediaready />
      </div>
    </a>
  {:else}
    <button class="creative-button" type="button" aria-label={`Open ${ad.title}`} on:click={openAdPage}>
      <div class="creative-preview">
        <CreativePreview {ad} on:mediaready />
      </div>
    </button>
  {/if}
</article>
