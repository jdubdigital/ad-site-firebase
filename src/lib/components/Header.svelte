<script>
  import { goto } from '$app/navigation';
  import CircleUserRound from '@lucide/svelte/icons/circle-user-round';
  import Monitor from '@lucide/svelte/icons/monitor';
  import Moon from '@lucide/svelte/icons/moon';
  import Search from '@lucide/svelte/icons/search';
  import Sun from '@lucide/svelte/icons/sun';
  import { signedInEmail } from '$lib/stores/account';
  import { profile } from '$lib/stores/profile';
  import { openFilters, openLogin } from '$lib/stores/ui';
  import { setThemeMode, themeMode } from '$lib/stores/theme';

  $: accountLabel = $profile.username || $profile.userSlug || $signedInEmail.split('@')[0];

  function handleSubmitClick() {
    if ($signedInEmail) {
      goto('/submit');
      return;
    }

    openLogin('signin');
  }
</script>

<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="/" aria-label="Ad Archive home">
      <span class="brand-gradient">Ad</span><span class="brand-dark">Archive</span>
    </a>

    <button class="desktop-search search-wrap" type="button" aria-label="Open search" on:click={openFilters}>
      <Search class="search-icon" size={19} strokeWidth={2.25} aria-hidden="true" />
      <span class="search-input search-input-faux">Search ads, brands, categories...</span>
    </button>

    <nav class="nav" aria-label="Main navigation">
      <div class="nav-links">
        <a href="/">Home</a>
        <button class="nav-link-button" type="button" on:click={handleSubmitClick}>Submit</button>
        <a href="/#gallery">About</a>
      </div>

      <div class="theme-group" role="group" aria-label="Theme mode">
        <button
          class="theme-button"
          type="button"
          title="System"
          aria-label="Use system theme"
          aria-pressed={$themeMode === 'system'}
          on:click={() => setThemeMode('system')}
        >
          <Monitor size={18} strokeWidth={2.25} aria-hidden="true" />
        </button>
        <button
          class="theme-button"
          type="button"
          title="Light"
          aria-label="Use light theme"
          aria-pressed={$themeMode === 'light'}
          on:click={() => setThemeMode('light')}
        >
          <Sun size={18} strokeWidth={2.25} aria-hidden="true" />
        </button>
        <button
          class="theme-button"
          type="button"
          title="Dark"
          aria-label="Use dark theme"
          aria-pressed={$themeMode === 'dark'}
          on:click={() => setThemeMode('dark')}
        >
          <Moon size={18} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>

      <div class="account-actions">
        <button
          class="button button-secondary"
          type="button"
          on:click={() => ($signedInEmail ? goto('/dashboard') : openLogin('signin'))}
        >
          {$signedInEmail ? accountLabel : 'Sign in'}
        </button>
        {#if !$signedInEmail}
          <button class="button button-primary" type="button" on:click={() => openLogin('create')}>Create account</button>
        {/if}
      </div>

      <button
        class="icon-button mobile-only"
        type="button"
        aria-label={$signedInEmail ? 'Open dashboard' : 'Open account login'}
        on:click={() => ($signedInEmail ? goto('/dashboard') : openLogin('signin'))}
      >
        <CircleUserRound size={21} strokeWidth={2.15} aria-hidden="true" />
      </button>

      <button class="button button-secondary search-trigger" type="button" aria-label="Open search" on:click={openFilters}>
        <Search size={18} strokeWidth={2.25} aria-hidden="true" />
        <span>Search</span>
      </button>
    </nav>
  </div>
</header>
