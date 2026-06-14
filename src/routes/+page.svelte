<script>
  import { onMount, tick } from 'svelte';
  import AdGallery from '$lib/components/AdGallery.svelte';
  import GalleryToolbar from '$lib/components/GalleryToolbar.svelte';
  import Hero from '$lib/components/Hero.svelte';
  import { restoreArchiveScroll } from '$lib/utils/archive-scroll';

  onMount(() => {
    tick().then(restoreArchiveScroll);
  });
</script>

<svelte:head>
  <title>Ad Archive</title>
</svelte:head>

<Hero />
<GalleryToolbar />
<AdGallery />
