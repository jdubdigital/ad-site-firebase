<script>
  import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { filteredAds, setSortMode, sortMode, visibleAds } from '$lib/stores/archive';
  import MediumChips from './MediumChips.svelte';
</script>

<section id="gallery" class="toolbar">
  <div class="container toolbar-inner">
    <div>
      <p class="muted">
        Showing {Math.min($visibleAds.length, $filteredAds.length)} of {$filteredAds.length} ads
      </p>
    </div>

    <div class="toolbar-formats" aria-label="Filter by medium">
      <MediumChips />
    </div>

    <label class="sort-control" aria-label="Sort ads">
      <span class="sort-control-label">Sort by</span>
      <span class="sort-select-shell">
        <ArrowUpDown class="sort-leading-icon" size={16} strokeWidth={2.2} aria-hidden="true" />
        <select class="select" value={$sortMode} on:change={(event) => setSortMode(event.currentTarget.value)}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="popular">Most Popular</option>
          <option value="size">Largest Size</option>
        </select>
        <ChevronDown class="sort-chevron" size={17} strokeWidth={2.3} aria-hidden="true" />
      </span>
    </label>
  </div>
</section>
