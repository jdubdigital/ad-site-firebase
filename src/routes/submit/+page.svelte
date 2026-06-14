<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { authReady, signedInEmail } from '$lib/stores/account';
  import { openLogin, openSubmit } from '$lib/stores/ui';

  $: if (browser && $authReady && $signedInEmail) {
    openSubmit();
  }

  $: if (browser && $authReady && !$signedInEmail) {
    openLogin('signin');
    goto('/');
  }
</script>

<svelte:head>
  <title>Submit · Ad Archive</title>
</svelte:head>

<section class="dashboard-page">
  <div class="container empty-state">
    <h1>Add to the archive</h1>
    <p class="muted">The submission form is open. Closing it returns you to the archive.</p>
  </div>
</section>
