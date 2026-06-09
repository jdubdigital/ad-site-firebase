<script>
  import { get } from 'svelte/store';
  import { defaultDashboardProfile } from '$lib/data/catalog';
  import { createAccount, signIn } from '$lib/stores/account';
  import { profile, saveProfile } from '$lib/stores/profile';
  import { closeLogin, loginMode, loginOpen } from '$lib/stores/ui';
  import { createNameFromEmail, createSlug } from '$lib/utils/slug';

  let email = '';
  let password = '';
  let accountType = 'Brand';
  let status = '';

  $: isCreate = $loginMode === 'create';

  async function submitLogin() {
    const cleanedEmail = email.trim();
    if (!cleanedEmail) return;

    status = '';

    try {
      if (isCreate) {
        await createAccount(cleanedEmail, password);
        await saveProfile({
          ...defaultDashboardProfile,
          email: cleanedEmail,
          name: createNameFromEmail(cleanedEmail),
          type: accountType,
          userSlug: createSlug(cleanedEmail.split('@')[0], get(profile).userSlug)
        });
      } else {
        await signIn(cleanedEmail, password);
      }

      status = isCreate ? `${accountType} account created.` : 'Signed in.';
      password = '';
    } catch (error) {
      status = error?.message || 'Unable to authenticate.';
    }
  }
</script>

{#if $loginOpen}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="login-title">
    <button class="overlay" type="button" aria-label="Close login" on:click={closeLogin}></button>
    <div class="modal-box small">
      <div class="modal-header">
        <div>
          <p class="eyebrow">Account</p>
          <h2 id="login-title" class="modal-title">{isCreate ? 'Create account' : 'Sign in'}</h2>
          <p class="muted">
            {isCreate ? 'Start saving favorites and organizing ad inspiration.' : 'Save favorites and build creative collections.'}
          </p>
        </div>
        <button class="icon-button" type="button" aria-label="Close login" on:click={closeLogin}>×</button>
      </div>

      <form class="modal-content" on:submit|preventDefault={submitLogin}>
        <div class="field-grid">
          <label class="field-label">
            Email
            <input bind:value={email} class="field" type="email" required placeholder="you@example.com" />
          </label>

          {#if isCreate}
            <div>
              <p class="section-label">Account type</p>
              <div class="account-type-group">
                {#each ['Brand', 'Agency', 'Individual'] as type}
                  <button
                    class="account-type-button chip"
                    type="button"
                    aria-pressed={accountType === type}
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
            <input bind:value={password} class="field" type="password" required placeholder="Password" />
          </label>

          <label class="check-label">
            <input type="checkbox" />
            <span>Remember me on this device.</span>
          </label>

          <button class="button button-primary" type="submit">{isCreate ? 'Create account' : 'Sign in'}</button>

          {#if status}
            <p class="status">{status}</p>
          {/if}

          <button
            class="button button-secondary"
            type="button"
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
