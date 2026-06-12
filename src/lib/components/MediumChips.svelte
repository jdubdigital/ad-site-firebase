<script>
  import { mediums } from '$lib/data/catalog';
  import { activeFilters, setFilter } from '$lib/stores/archive';
  import { getMediumLabel } from '$lib/utils/ad-utils';
</script>

<div class="chip-list feed-chip-list">
  <button class="chip" type="button" aria-pressed={$activeFilters.medium === 'all'} on:click={() => setFilter('medium', 'all')}>All</button>
  {#each mediums as medium}
    <button class="chip" type="button" aria-pressed={$activeFilters.medium === medium} on:click={() => setFilter('medium', medium)}>
      {getMediumLabel(medium)}
    </button>
  {/each}
</div>
