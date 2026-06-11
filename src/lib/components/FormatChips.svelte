<script>
  import { adTypes } from '$lib/data/catalog';
  import { activeFilters, setFilter } from '$lib/stores/archive';
</script>

<div class="chip-list format-chip-list">
  <button class="chip" type="button" aria-pressed={$activeFilters.type === 'all'} on:click={() => setFilter('type', 'all')}>All</button>
  {#each adTypes as type}
    <button class="chip" type="button" aria-pressed={$activeFilters.type === type.value} on:click={() => setFilter('type', type.value)}>
      {type.label}
    </button>
  {/each}
</div>
