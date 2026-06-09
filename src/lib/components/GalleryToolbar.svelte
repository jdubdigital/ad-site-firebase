<script>
  import { filteredAds, setSortMode, sortMode, visibleAds } from '$lib/stores/archive';
</script>

<section class="toolbar">
  <div class="container toolbar-inner">
    <div>
      <p class="muted">
        Showing {Math.min($visibleAds.length, $filteredAds.length)} of {$filteredAds.length} ads
      </p>
    </div>

    <label class="sort-control" aria-label="Sort ads">
      <select class="select" value={$sortMode} on:change={(event) => setSortMode(event.currentTarget.value)}>
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="popular">Most Popular</option>
        <option value="size">Size</option>
      </select>
    </label>
  </div>
</section>
