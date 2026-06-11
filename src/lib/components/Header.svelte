<script>
  import { goto } from '$app/navigation';
  import CircleUserRound from '@lucide/svelte/icons/circle-user-round';
  import Monitor from '@lucide/svelte/icons/monitor';
  import Moon from '@lucide/svelte/icons/moon';
  import Search from '@lucide/svelte/icons/search';
  import Sun from '@lucide/svelte/icons/sun';
  import { signedInEmail } from '$lib/stores/account';
  import { activeFilters, setSearchQuery } from '$lib/stores/archive';
  import { openFilters, openLogin } from '$lib/stores/ui';
  import { setThemeMode, themeMode } from '$lib/stores/theme';
</script>

<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="/" aria-label="Ad Archive home">
      <span class="brand-gradient">Ad</span><span class="brand-dark">Archive</span>
    </a>

    <div class="desktop-search">
      <div class="search-wrap">
        <Search class="search-icon" size={19} strokeWidth={2.25} aria-hidden="true" />
        <input
          class="search-input"
          type="search"
          placeholder="Search ads, brands, categories..."
          value={$activeFilters.query}
          on:focus={openFilters}
          on:input={(event) => setSearchQuery(event.currentTarget.value)}
        />
      </div>
    </div>

    <nav class="nav" aria-label="Main navigation">
      <div class="nav-links">
        <a href="/">Home</a>
        <a href="/submit">Submit</a>
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
          {$signedInEmail ? $signedInEmail.split('@')[0] : 'Sign in'}
        </button>
        {#if !$signedInEmail}
          <button class="button button-primary" type="button" on:click={() => openLogin('create')}>Create account</button>
        {/if}
      </div>

      <button
        class="icon-button mobile-only"
        type="button"
        aria-label={$signedInEmail ? 'Open dashboard' : 'Open account login'}
        on:click={() => ($signedInEmail ? goto('/dashboard') : openLogin('create'))}
      >
        <CircleUserRound size={21} strokeWidth={2.15} aria-hidden="true" />
      </button>

      <button class="icon-button mobile-only" type="button" aria-label="Open search" on:click={openFilters}>
        <Search size={21} strokeWidth={2.15} aria-hidden="true" />
      </button>
    </nav>
  </div>
</header>
