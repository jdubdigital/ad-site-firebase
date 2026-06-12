<script>
  import { onMount } from 'svelte';
  import { openSubmit } from '$lib/stores/ui';

  onMount(() => {
    openSubmit();
  });
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
