<script>
  import { onMount } from 'svelte';
  import { navigating } from '$app/stores';
  import '$lib/styles/app.css';
  import FilterPanel from '$lib/components/FilterPanel.svelte';
  import Header from '$lib/components/Header.svelte';
  import LoginModal from '$lib/components/LoginModal.svelte';
  import SubmitModal from '$lib/components/SubmitModal.svelte';
  import { initializeAccount } from '$lib/stores/account';
  import { adsReady, hydrateAds } from '$lib/stores/archive';
  import { hydrateFavorites } from '$lib/stores/favorites';
  import { hydrateProfile } from '$lib/stores/profile';
  import { initializeTheme } from '$lib/stores/theme';

  onMount(() => {
    initializeTheme();
    hydrateProfile();
    hydrateFavorites();
    hydrateAds();

    const unsubscribe = initializeAccount(() => {
      hydrateProfile();
      hydrateFavorites();
      hydrateAds();
    });

    return unsubscribe;
  });

  $: appLoading = Boolean($navigating) || !$adsReady;
  $: loadingLabel = !$adsReady ? 'Loading ads' : 'Loading page';
</script>

<div class="app-shell">
  {#if appLoading}
    <div class="page-progress" aria-hidden="true"></div>
    <div class="page-loader" role="status" aria-live="polite">
      <span class="loading-spinner"></span>
      <span>{loadingLabel}</span>
    </div>
  {/if}

  <Header />
  <FilterPanel />
  <slot />
  <footer class="footer">
    <p>© 2025 Ad Archive · SvelteKit prototype with optional Firebase persistence</p>
  </footer>
  <LoginModal />
  <SubmitModal />
</div>
