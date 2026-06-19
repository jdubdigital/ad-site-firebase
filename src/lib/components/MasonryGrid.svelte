<script>
  import { afterUpdate, onMount, tick } from 'svelte';
  import AdCard from './AdCard.svelte';

  export let ads = [];
  export let id = undefined;
  export let externalLinks = false;

  let grid;
  let itemRefs = [];
  let activePreviewId = '';
  let layoutFrame = 0;
  let resizeObserver;

  function activatePreview(adId) {
    activePreviewId = String(adId);
  }

  function deactivatePreview(adId) {
    if (activePreviewId === String(adId)) activePreviewId = '';
  }

  function layoutMasonry() {
    if (!grid) return;

    const styles = getComputedStyle(grid);
    const rowHeight = parseFloat(styles.getPropertyValue('grid-auto-rows')) || 8;
    const rowGap = parseFloat(styles.getPropertyValue('row-gap')) || 20;
    const items = itemRefs.slice(0, ads.length).filter(Boolean);

    items.forEach((item) => {
      item.style.gridRowEnd = 'auto';
      const height = item.getBoundingClientRect().height;
      const span = Math.max(1, Math.ceil((height + rowGap) / (rowHeight + rowGap)));
      item.style.gridRowEnd = `span ${span}`;
    });
  }

  function queueLayout() {
    if (!grid) return;
    if (layoutFrame) cancelAnimationFrame(layoutFrame);

    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      layoutMasonry();
    });
  }

  function observeItems() {
    if (!resizeObserver) return;

    resizeObserver.disconnect();
    if (grid) resizeObserver.observe(grid);
    itemRefs
      .slice(0, ads.length)
      .filter(Boolean)
      .forEach((item) => resizeObserver.observe(item));
  }

  onMount(() => {
    resizeObserver = new ResizeObserver(queueLayout);
    window.addEventListener('resize', queueLayout);

    tick().then(() => {
      observeItems();
      queueLayout();
    });

    return () => {
      window.removeEventListener('resize', queueLayout);
      resizeObserver?.disconnect();
      if (layoutFrame) cancelAnimationFrame(layoutFrame);
    };
  });

  afterUpdate(() => {
    if (!resizeObserver) return;

    tick().then(() => {
      observeItems();
      queueLayout();
    });
  });
</script>

<div class="masonry" {id} bind:this={grid}>
  {#each ads as ad, index (ad.id)}
    <div class="masonry-item" bind:this={itemRefs[index]}>
      <AdCard
        {ad}
        {externalLinks}
        previewActive={activePreviewId === String(ad.id)}
        on:previewactivate={() => activatePreview(ad.id)}
        on:previewdeactivate={() => deactivatePreview(ad.id)}
        on:mediaready={queueLayout}
      />
    </div>
  {/each}
</div>
