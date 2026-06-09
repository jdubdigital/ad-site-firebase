<script>
  import { onMount } from 'svelte';
  import { activeFilters, ads, filteredAds, loadMoreAds, visibleAds, visibleCount } from '$lib/stores/archive';
  import MasonryGrid from './MasonryGrid.svelte';

  function handleScroll() {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 220) {
      loadMoreAds();
    }
  }

  onMount(() => {
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  });

  $: hasFilters =
    $activeFilters.query ||
    $activeFilters.category !== 'all' ||
    $activeFilters.medium !== 'all' ||
    $activeFilters.type !== 'all';
</script>

<section class="gallery-section">
  <div class="container">
    {#if $filteredAds.length}
      <MasonryGrid ads={$visibleAds} id="gallery" />

      {#if $visibleCount < $filteredAds.length}
        <div class="loading-row">
          <button class="button button-secondary" type="button" on:click={loadMoreAds}>Load more ads</button>
        </div>
      {/if}
    {:else}
      <div class="empty-state">
        {$ads.length ? 'No ads match your search.' : hasFilters ? 'No ads match your search.' : 'No ads have been published yet.'}
      </div>
    {/if}
  </div>
</section>
