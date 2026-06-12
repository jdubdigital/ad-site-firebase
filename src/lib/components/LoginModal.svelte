<script>
  import { defaultDashboardProfile } from '$lib/data/catalog';
  import { createAccount, deleteCurrentAccount, signIn } from '$lib/stores/account';
  import { checkDisplayNameAvailable, checkUserSlugAvailable, saveProfile } from '$lib/stores/profile';
  import { closeLogin, loginMode, loginOpen } from '$lib/stores/ui';
  import { cleanDisplayName, createUsernameSlug } from '$lib/utils/slug';

  let email = '';
  let displayName = '';
  let displayNameStatus = '';
  let displayNameAvailable = false;
  let checkingDisplayName = false;
  let displayNameCheckTimer;
  let displayNameCheckRun = 0;
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

  async function checkDisplayNameNow() {
    const name = cleanDisplayName(displayName, '');
    const run = ++displayNameCheckRun;

    displayNameAvailable = false;

    if (!isCreate || !name) {
      displayNameStatus = '';
      return false;
    }

    if (name.length < 2) {
      displayNameStatus = 'Use at least 2 characters.';
      return false;
    }

    checkingDisplayName = true;
    displayNameStatus = 'Checking display name...';

    try {
      const available = await checkDisplayNameAvailable(name);
      if (run !== displayNameCheckRun) return false;

      displayNameAvailable = available;
      displayNameStatus = available ? 'Display name is available.' : 'That display name is already taken.';
      return available;
    } catch (error) {
      if (run === displayNameCheckRun) displayNameStatus = 'Unable to check that display name right now.';
      return false;
    } finally {
      if (run === displayNameCheckRun) checkingDisplayName = false;
    }
  }

  function scheduleDisplayNameCheck() {
    clearTimeout(displayNameCheckTimer);
    displayName = cleanDisplayName(displayName, '');
    displayNameStatus = displayName ? 'Checking display name...' : '';
    displayNameAvailable = false;

    if (displayName) {
      displayNameCheckTimer = setTimeout(checkDisplayNameNow, 350);
    }
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
        const requestedDisplayName = cleanDisplayName(displayName, '');
        if (!requestedDisplayName || requestedDisplayName.length < 2) {
          throw new Error('Choose a display name with at least 2 characters.');
        }

        const requestedSlug = createUsernameSlug(usernameSlug, '');
        if (!requestedSlug || requestedSlug.length < 3) {
          throw new Error('Choose a username with at least 3 characters.');
        }

        const [nameAvailable, slugAvailable] = await Promise.all([checkDisplayNameNow(), checkUsernameNow()]);
        if (!nameAvailable) throw new Error('That display name is already taken.');
        if (!slugAvailable) throw new Error('That username is already taken.');

        let accountCreated = false;
        try {
          await createAccount(cleanedEmail, password);
          accountCreated = true;
          await saveProfile({
            ...defaultDashboardProfile,
            email: cleanedEmail,
            name: requestedDisplayName,
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
      displayName = '';
      displayNameStatus = '';
      displayNameAvailable = false;
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
</script>

{#if $loginOpen}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="login-title">
    <button class="overlay" type="button" aria-label="Close login" disabled={submitting} on:click={closeLogin}></button>
    <div class="modal-box small">
      <div class="modal-header">
        <div>
          <p class="eyebrow">Account</p>
          <h2 id="login-title" class="modal-title">{isCreate ? 'Create account' : 'Sign in'}</h2>
          <p class="muted">
            {isCreate ? 'Start saving favorites and organizing ad inspiration.' : 'Save favorites and build creative collections.'}
          </p>
        </div>
        <button class="icon-button" type="button" aria-label="Close login" disabled={submitting} on:click={closeLogin}>×</button>
      </div>

      <form class="modal-content" on:submit|preventDefault={submitLogin}>
        <div class="field-grid">
          <label class="field-label">
            Email
            <input bind:value={email} class="field" type="email" required placeholder="you@example.com" disabled={submitting} />
          </label>

          {#if isCreate}
            <label class="field-label">
              Display name
              <input
                class="field"
                type="text"
                required
                minlength="2"
                maxlength="64"
                autocomplete="name"
                placeholder="Your public name"
                disabled={submitting}
                value={displayName}
                on:input={(event) => {
                  displayName = event.currentTarget.value;
                  scheduleDisplayNameCheck();
                }}
                on:blur={checkDisplayNameNow}
              />
              {#if displayNameStatus}
                <span class:status-good={displayNameAvailable} class="field-help">{displayNameStatus}</span>
              {/if}
            </label>

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

          <button class="button button-primary" type="submit" disabled={submitting || (isCreate && (checkingDisplayName || checkingUsername))}>
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
