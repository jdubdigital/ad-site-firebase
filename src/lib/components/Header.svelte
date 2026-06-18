<script>
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import CircleUserRound from '@lucide/svelte/icons/circle-user-round';
  import House from '@lucide/svelte/icons/house';
  import Info from '@lucide/svelte/icons/info';
  import LogOut from '@lucide/svelte/icons/log-out';
  import Menu from '@lucide/svelte/icons/menu';
  import Monitor from '@lucide/svelte/icons/monitor';
  import Moon from '@lucide/svelte/icons/moon';
  import Search from '@lucide/svelte/icons/search';
  import Sun from '@lucide/svelte/icons/sun';
  import UploadCloud from '@lucide/svelte/icons/upload-cloud';
  import X from '@lucide/svelte/icons/x';
  import { signedInEmail, signOut } from '$lib/stores/account';
  import { profile } from '$lib/stores/profile';
  import { openFilters, openLogin } from '$lib/stores/ui';
  import { setThemeMode, themeMode } from '$lib/stores/theme';

  let mobileMenuOpen = false;

  $: accountLabel = $profile.username || $profile.userSlug || $signedInEmail.split('@')[0];

  function setMobileMenu(open) {
    mobileMenuOpen = open;
    if (typeof document !== 'undefined') {
      document.body.style.overflow = open ? 'hidden' : '';
    }
  }

  function closeMobileMenu() {
    setMobileMenu(false);
  }

  function handleSearchClick() {
    closeMobileMenu();
    openFilters();
  }

  function handleSubmitClick() {
    closeMobileMenu();
    if ($signedInEmail) {
      goto('/submit');
      return;
    }

    openLogin('signin');
  }

  function handleAccountClick(mode = 'signin') {
    closeMobileMenu();
    if ($signedInEmail) {
      goto('/dashboard');
      return;
    }

    openLogin(mode);
  }

  async function handleSignOut() {
    closeMobileMenu();
    await signOut();
    goto('/');
  }

  afterNavigate(closeMobileMenu);

  onMount(() => {
    function handleKeydown(event) {
      if (event.key === 'Escape') closeMobileMenu();
    }

    function handleResize() {
      if (window.innerWidth >= 768) closeMobileMenu();
    }

    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('resize', handleResize);
      document.body.style.overflow = '';
    };
  });
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
        <a href="/about">About</a>
        <button class="nav-link-button" type="button" on:click={handleSubmitClick}>Submit</button>
      </div>

      <div class="theme-group desktop-theme-group" role="group" aria-label="Theme mode">
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
        {#if $signedInEmail}
          <button class="icon-button" type="button" title="Sign out" aria-label="Sign out" on:click={handleSignOut}>
            <LogOut size={18} strokeWidth={2.15} aria-hidden="true" />
          </button>
        {:else}
          <button class="button button-primary" type="button" on:click={() => openLogin('create')}>Create account</button>
        {/if}
      </div>

      <button
        class="icon-button mobile-only header-account-trigger"
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

      <button
        class="icon-button mobile-menu-trigger"
        class:is-open={mobileMenuOpen}
        type="button"
        aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={mobileMenuOpen}
        aria-controls="mobile-navigation"
        on:click={() => setMobileMenu(!mobileMenuOpen)}
      >
        {#if mobileMenuOpen}
          <X size={22} strokeWidth={2.2} aria-hidden="true" />
        {:else}
          <Menu size={22} strokeWidth={2.2} aria-hidden="true" />
        {/if}
      </button>
    </nav>
  </div>
</header>

{#if mobileMenuOpen}
  <div id="mobile-navigation" class="mobile-menu-layer">
      <button
        class="mobile-menu-backdrop"
        type="button"
        aria-label="Close navigation menu"
        on:click={closeMobileMenu}
        transition:fade={{ duration: 160 }}
      ></button>

      <div class="mobile-menu-panel" role="dialog" aria-modal="true" aria-label="Navigation menu" transition:fly={{ y: -14, duration: 220 }}>
        <div class="container mobile-menu-inner">
          <button class="mobile-menu-search" type="button" on:click={handleSearchClick}>
            <Search size={20} strokeWidth={2.15} aria-hidden="true" />
            <span>
              <strong>Search the archive</strong>
              <small>Ads, brands, categories, formats</small>
            </span>
            <ArrowRight size={19} strokeWidth={2} aria-hidden="true" />
          </button>

          <nav class="mobile-menu-links" aria-label="Mobile navigation">
            <a class:active={$page.url.pathname === '/'} href="/">
              <span class="mobile-menu-link-icon"><House size={20} strokeWidth={2} aria-hidden="true" /></span>
              <span><strong>Home</strong><small>Browse the creative archive</small></span>
              <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
            </a>
            <a class:active={$page.url.pathname === '/about'} href="/about">
              <span class="mobile-menu-link-icon mobile-menu-link-icon-cyan"><Info size={20} strokeWidth={2} aria-hidden="true" /></span>
              <span><strong>About</strong><small>Why Ad Archive exists</small></span>
              <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
            </a>
            <button type="button" on:click={handleSubmitClick}>
              <span class="mobile-menu-link-icon mobile-menu-link-icon-pink">
                <UploadCloud size={20} strokeWidth={2} aria-hidden="true" />
              </span>
              <span><strong>Submit</strong><small>Add your creative work</small></span>
              <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </nav>

          <div class="mobile-menu-footer">
            {#if $signedInEmail}
              <div class="mobile-menu-account-actions">
                <button class="mobile-menu-account button button-primary" type="button" on:click={() => handleAccountClick()}>
                  <CircleUserRound size={18} strokeWidth={2.1} aria-hidden="true" />
                  <span>Profile</span>
                </button>
                <button class="button button-secondary" type="button" on:click={handleSignOut}>
                  <LogOut size={18} strokeWidth={2.1} aria-hidden="true" />
                  Sign out
                </button>
              </div>
            {:else}
              <div class="mobile-menu-account-actions">
                <button class="button button-secondary" type="button" on:click={() => handleAccountClick('signin')}>
                  <CircleUserRound size={18} strokeWidth={2.1} aria-hidden="true" />
                  Sign in
                </button>
                <button class="button button-primary" type="button" on:click={() => handleAccountClick('create')}>Create account</button>
              </div>
            {/if}

            <div class="mobile-menu-appearance">
              <span>Appearance</span>
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
            </div>
          </div>
        </div>
      </div>
  </div>
{/if}
