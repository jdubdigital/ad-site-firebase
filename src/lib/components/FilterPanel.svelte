<script>
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import Search from '@lucide/svelte/icons/search';
  import { extraCategories, mediums, primaryCategories } from '$lib/data/catalog';
  import FormatChips from './FormatChips.svelte';
  import { activeFilters, clearFilters, setFilter, setSearchQuery } from '$lib/stores/archive';
  import { closeFilters, filtersOpen } from '$lib/stores/ui';
  import { getMediumLabel } from '$lib/utils/ad-utils';

  let showAllCategories = false;
  let searchInput;

  $: visibleCategories = showAllCategories ? [...primaryCategories, ...extraCategories] : primaryCategories;

  function onKeydown(event) {
    if (event.key === 'Escape') closeFilters();
  }

  onMount(() => {
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  });

  $: if (browser && $filtersOpen && searchInput) {
    setTimeout(() => searchInput?.focus(), 50);
  }
</script>

{#if $filtersOpen}
  <button class="overlay" type="button" aria-label="Close search filters" on:click={closeFilters}></button>
  <div class="filter-panel">
    <div class="filter-box">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Search archive</p>
          <h2 class="panel-title">Find creative inspiration fast</h2>
          <p class="muted">Search by title, category, tag, format, ad size, user, or location.</p>
        </div>
        <button class="icon-button" type="button" aria-label="Close search menu" on:click={closeFilters}>×</button>
      </div>

      <div class="filter-search">
        <div class="search-wrap">
          <Search class="search-icon" size={19} strokeWidth={2.25} aria-hidden="true" />
          <input
            bind:this={searchInput}
            class="search-input"
            type="search"
            placeholder="Search ads, brands, categories..."
            value={$activeFilters.query}
            on:input={(event) => setSearchQuery(event.currentTarget.value)}
          />
        </div>
      </div>

      <div class="filter-grid">
        <section>
          <p class="section-label">Categories</p>
          <div class="chip-list">
            <button
              class="chip"
              type="button"
              aria-pressed={$activeFilters.category === 'all'}
              on:click={() => setFilter('category', 'all')}
            >
              All
            </button>
            {#each visibleCategories as category}
              <button
                class="chip"
                type="button"
                aria-pressed={$activeFilters.category === category}
                on:click={() => setFilter('category', category)}
              >
                {category}
              </button>
            {/each}
          </div>
          <button class="button button-secondary" style="margin-top: 0.8rem;" type="button" on:click={() => (showAllCategories = !showAllCategories)}>
            {showAllCategories ? 'Show fewer categories' : 'View all categories'}
          </button>
        </section>

        <section>
          <p class="section-label">Medium</p>
          <div class="chip-list">
            <button class="chip" type="button" aria-pressed={$activeFilters.medium === 'all'} on:click={() => setFilter('medium', 'all')}>All</button>
            {#each mediums as medium}
              <button class="chip" type="button" aria-pressed={$activeFilters.medium === medium} on:click={() => setFilter('medium', medium)}>
                {getMediumLabel(medium)}
              </button>
            {/each}
          </div>
        </section>

        <section>
          <p class="section-label">Format</p>
          <FormatChips />
        </section>
      </div>

      <div class="filter-footer">
        {#if $activeFilters.query || $activeFilters.category !== 'all' || $activeFilters.medium !== 'all' || $activeFilters.type !== 'all'}
          <p class="muted">Filters are active.</p>
        {/if}
        <button class="button button-secondary" type="button" on:click={clearFilters}>Clear search</button>
      </div>
    </div>
  </div>
{/if}
