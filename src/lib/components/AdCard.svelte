<script>
  import { goto } from '$app/navigation';
  import CreativePreview from './CreativePreview.svelte';

  export let ad;

  function openAdPage() {
    goto(`/ad/${encodeURIComponent(String(ad.id))}`);
  }
</script>

<article class="ad-card">
  <button class="creative-button" type="button" aria-label={`Open ${ad.title}`} on:click={openAdPage}>
    <div class="creative-preview">
      <CreativePreview {ad} />
    </div>
  </button>
</article>
