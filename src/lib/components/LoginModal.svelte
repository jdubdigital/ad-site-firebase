<script>
  import { browser } from '$app/environment';
  import { onDestroy } from 'svelte';
  import X from '@lucide/svelte/icons/x';
  import { defaultDashboardProfile } from '$lib/data/catalog';
  import { createAccount, deleteCurrentAccount, signIn } from '$lib/stores/account';
  import { checkUserSlugAvailable, saveProfile } from '$lib/stores/profile';
  import { closeLogin, loginMode, loginOpen } from '$lib/stores/ui';
  import { createUsernameSlug } from '$lib/utils/slug';

  let email = '';
  let username = '';
  let usernameStatus = '';
  let usernameAvailable = false;
  let checkingUsername = false;
  let usernameCheckTimer;
  let usernameCheckRun = 0;
  let password = '';
  let accountType = 'Brand';
  let status = '';
  let submitting = false;

  $: isCreate = $loginMode === 'create';
  $: usernameSlug = createUsernameSlug(username, '');
  $: syncMobileScrollLock($loginOpen);

  function syncMobileScrollLock(open) {
    if (!browser) return;
    const shouldLock = open && window.matchMedia('(max-width: 767px)').matches;
    document.body.classList.toggle('mobile-auth-open', shouldLock);
  }

  async function checkUsernameNow() {
    const slug = createUsernameSlug(username, '');
    const run = ++usernameCheckRun;

    usernameAvailable = false;

    if (!isCreate || !slug) {
      usernameStatus = '';
      return false;
    }

    if (slug.length < 3) {
      usernameStatus = 'Use at least 3 characters.';
      return false;
    }

    checkingUsername = true;
    usernameStatus = 'Checking username...';

    try {
      const available = await checkUserSlugAvailable(slug);
      if (run !== usernameCheckRun) return false;

      usernameAvailable = available;
      usernameStatus = available ? `Available: /user/${slug}` : 'That username is already taken.';
      return available;
    } catch (error) {
      if (run === usernameCheckRun) usernameStatus = 'Unable to check that username right now.';
      return false;
    } finally {
      if (run === usernameCheckRun) checkingUsername = false;
    }
  }

  function scheduleUsernameCheck() {
    clearTimeout(usernameCheckTimer);
    username = createUsernameSlug(username, '');
    usernameStatus = username ? 'Checking username...' : '';
    usernameAvailable = false;

    if (username) {
      usernameCheckTimer = setTimeout(checkUsernameNow, 350);
    }
  }

  async function submitLogin() {
    if (submitting) return;
    const cleanedEmail = email.trim();
    if (!cleanedEmail) return;

    status = '';
    submitting = true;

    try {
      if (isCreate) {
        const requestedSlug = createUsernameSlug(usernameSlug, '');
        if (!requestedSlug || requestedSlug.length < 3) {
          throw new Error('Choose a username with at least 3 characters.');
        }

        const slugAvailable = await checkUsernameNow();
        if (!slugAvailable) throw new Error('That username is already taken.');

        let accountCreated = false;
        try {
          await createAccount(cleanedEmail, password);
          accountCreated = true;
          await saveProfile({
            ...defaultDashboardProfile,
            name: requestedSlug,
            type: accountType,
            username: requestedSlug,
            userSlug: requestedSlug
          });
        } catch (profileError) {
          if (accountCreated) await deleteCurrentAccount().catch(() => {});
          throw profileError;
        }
      } else {
        await signIn(cleanedEmail, password);
      }

      email = '';
      username = '';
      usernameStatus = '';
      usernameAvailable = false;
      password = '';
      closeLogin();
      status = '';
    } catch (error) {
      status = error?.message || 'Unable to authenticate.';
    } finally {
      submitting = false;
    }
  }

  onDestroy(() => {
    if (browser) document.body.classList.remove('mobile-auth-open');
  });
</script>

{#if $loginOpen}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="login-title">
    <button class="overlay modal-backdrop" type="button" aria-label="Close login" disabled={submitting} on:click={closeLogin}></button>
    <div class="modal-box small">
      <div class="modal-header">
        <div>
          <p class="eyebrow">Account</p>
          <h2 id="login-title" class="modal-title">{isCreate ? 'Create account' : 'Sign in'}</h2>
          <p class="muted">{isCreate ? 'Claim your username and start building your archive.' : 'Save favorites and build creative collections.'}</p>
        </div>
        <button class="icon-button" type="button" aria-label="Close account page" disabled={submitting} on:click={closeLogin}>
          <X size={21} strokeWidth={2.15} aria-hidden="true" />
        </button>
      </div>

      <form class="modal-content" on:submit|preventDefault={submitLogin}>
        <div class="field-grid">
          <label class="field-label">
            Email
            <input bind:value={email} class="field" type="email" required placeholder="you@example.com" disabled={submitting} />
          </label>

          {#if isCreate}
            <label class="field-label">
              Username
              <input
                class="field"
                type="text"
                required
                minlength="3"
                maxlength="48"
                autocomplete="username"
                placeholder="your-name"
                disabled={submitting}
                value={username}
                on:input={(event) => {
                  username = event.currentTarget.value;
                  scheduleUsernameCheck();
                }}
                on:blur={checkUsernameNow}
              />
              {#if usernameStatus}
                <span class:status-good={usernameAvailable} class="field-help">{usernameStatus}</span>
              {/if}
              <span class="field-help">Cannot be changed later.</span>
            </label>

            <div>
              <p class="section-label">Account type</p>
              <div class="account-type-group">
                {#each ['Brand', 'Agency', 'Individual'] as type}
                  <button
                    class="account-type-button chip"
                    type="button"
                    aria-pressed={accountType === type}
                    disabled={submitting}
                    on:click={() => (accountType = type)}
                  >
                    {type}
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <label class="field-label">
            Password
            <input bind:value={password} class="field" type="password" required placeholder="Password" disabled={submitting} />
          </label>

          <label class="check-label">
            <input type="checkbox" disabled={submitting} />
            <span>Remember me on this device.</span>
          </label>

          <button class="button button-primary" type="submit" disabled={submitting || (isCreate && checkingUsername)}>
            {#if submitting}
              <span class="loading-spinner button-spinner" aria-hidden="true"></span>
              {isCreate ? 'Creating...' : 'Signing in...'}
            {:else}
              {isCreate ? 'Create account' : 'Sign in'}
            {/if}
          </button>

          {#if status}
            <p class="status">{status}</p>
          {/if}

          <button
            class="button button-secondary"
            type="button"
            disabled={submitting}
            on:click={() => {
              $loginMode = isCreate ? 'signin' : 'create';
              status = '';
            }}
          >
            {isCreate ? 'Already have an account? Sign in' : 'Need an account? Create one'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
