<script>
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { onMount, tick } from 'svelte';
  import MasonryGrid from '$lib/components/MasonryGrid.svelte';
  import { getPublicProfileBySlug } from '$lib/repositories/profile';
  import { ads, adsReady } from '$lib/stores/archive';
  import { getAdChronology, getAdUserName, getAdUserSlug, getAdUserType, getUserBySlug } from '$lib/utils/ad-utils';

  let embedRoot;
  let publicUser = null;
  let publicUserSlug = '';
  let publicUserLoading = false;
  let publicUserRequest = 0;
  let resizeObserver;

  async function loadPublicUser(slugValue) {
    if (!slugValue || slugValue === publicUserSlug) return;

    const request = ++publicUserRequest;
    publicUserSlug = slugValue;
    publicUser = null;
    publicUserLoading = true;

    try {
      const foundUser = await getPublicProfileBySlug(slugValue);
      if (request === publicUserRequest) publicUser = foundUser;
    } finally {
      if (request === publicUserRequest) publicUserLoading = false;
    }
  }

  function postEmbedHeight() {
    if (!browser || !embedRoot || window.parent === window) return;

    const height = Math.ceil(
      Math.max(
        embedRoot.getBoundingClientRect().height,
        embedRoot.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      )
    );

    window.parent.postMessage(
      {
        type: 'adarchive:portfolio-height',
        slug,
        height
      },
      '*'
    );
  }

  onMount(() => {
    if (!embedRoot) return undefined;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(postEmbedHeight);
      resizeObserver.observe(embedRoot);
    }

    window.addEventListener('resize', postEmbedHeight);
    window.addEventListener('load', postEmbedHeight);

    tick().then(postEmbedHeight);
    const timers = [100, 500, 1200].map((delay) => setTimeout(postEmbedHeight, delay));

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', postEmbedHeight);
      window.removeEventListener('load', postEmbedHeight);
      timers.forEach(clearTimeout);
    };
  });

  $: slug = $page.params.slug;
  $: if (browser && slug) loadPublicUser(slug);
  $: portfolioAds = $ads
    .filter((ad) => getAdUserSlug(ad) === slug)
    .sort((a, b) => getAdChronology(b) - getAdChronology(a));
  $: adUser = portfolioAds[0]
    ? {
        slug,
        name: getAdUserName(portfolioAds[0]),
        type: getAdUserType(portfolioAds[0])
      }
    : null;
  $: user = publicUser || getUserBySlug(slug) || adUser;
  $: if (browser && embedRoot && slug && $adsReady) tick().then(postEmbedHeight);
</script>

<svelte:head>
  <title>{user ? `${user.name} Portfolio · Ad Archive` : 'Portfolio · Ad Archive'}</title>
</svelte:head>

<main class="embed-page" bind:this={embedRoot}>
  {#if user}
    {#if portfolioAds.length}
      <MasonryGrid ads={portfolioAds} externalLinks />
    {:else if $adsReady}
      <div class="empty-state">No ads have been added to this portfolio yet.</div>
    {/if}
  {:else if publicUserLoading || !$adsReady}
    <div class="embed-loading" aria-label="Loading portfolio">
      <span class="loading-spinner" aria-hidden="true"></span>
    </div>
  {:else}
    <div class="empty-state">Portfolio not found.</div>
  {/if}
</main>
