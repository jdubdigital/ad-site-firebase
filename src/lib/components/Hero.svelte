<script>
  import { goto } from '$app/navigation';
</script>

<section class="hero">
  <div class="container hero-inner">
    <div>
      <h1>Discover the Web's Best Ads</h1>
      <p>
        A curated archive of advertisements. Browse banner ads, creative campaigns, GIFs, videos, and programmatic concepts for inspiration.
      </p>
      <div class="hero-actions">
        <a class="button button-primary" href="#gallery">Explore Ads</a>
        <button class="button button-secondary" type="button" on:click={() => goto('/submit')}>Submit Your Ad</button>
      </div>
    </div>
  </div>
</section>
