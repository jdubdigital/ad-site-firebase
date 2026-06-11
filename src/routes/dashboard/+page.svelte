<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import Dashboard from '$lib/components/Dashboard.svelte';
  import { authReady, signedInEmail } from '$lib/stores/account';

  $: canViewDashboard = $authReady && Boolean($signedInEmail);
  $: if (browser && $authReady && !$signedInEmail) {
    goto('/');
  }
</script>

<svelte:head>
  <title>Dashboard · Ad Archive</title>
</svelte:head>

{#if canViewDashboard}
  <Dashboard />
{:else}
  <section class="dashboard-page">
    <div class="container empty-state">
      <h1>Checking account</h1>
      <p class="muted">Confirming your session before opening the dashboard.</p>
    </div>
  </section>
{/if}
