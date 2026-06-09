<script>
  import { onMount } from 'svelte';
  import '$lib/styles/app.css';
  import FilterPanel from '$lib/components/FilterPanel.svelte';
  import Header from '$lib/components/Header.svelte';
  import Lightbox from '$lib/components/Lightbox.svelte';
  import LoginModal from '$lib/components/LoginModal.svelte';
  import SubmitModal from '$lib/components/SubmitModal.svelte';
  import { initializeAccount } from '$lib/stores/account';
  import { hydrateAds } from '$lib/stores/archive';
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
</script>

<div class="app-shell">
  <Header />
  <FilterPanel />
  <slot />
  <footer class="footer">
    <p>© 2025 Ad Archive · SvelteKit prototype with optional Firebase persistence</p>
  </footer>
  <LoginModal />
  <SubmitModal />
  <Lightbox />
</div>
