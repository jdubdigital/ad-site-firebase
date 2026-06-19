<script>
  import { goto } from '$app/navigation';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import UploadCloud from '@lucide/svelte/icons/upload-cloud';
  import { signedInEmail } from '$lib/stores/account';
  import { openLogin } from '$lib/stores/ui';

  function handleSubmitClick() {
    if ($signedInEmail) {
      goto('/submit');
      return;
    }

    openLogin('signin');
  }
</script>

<section class="hero">
  <div class="hero-glow hero-glow-pink" aria-hidden="true"></div>
  <div class="hero-glow hero-glow-purple" aria-hidden="true"></div>

  <div class="container hero-inner">
    <div class="hero-copy">
      <h1>Discover the Web's Best <span>Ad Creatives.</span></h1>
      <p class="hero-lead">
        A curated archive of advertisements. Browse banner ads, creative campaigns, GIFs, videos, and programmatic
        concepts for inspiration. Upload your own and create a portfolio.
      </p>
      <div class="hero-actions">
        <a class="button button-primary hero-primary-action" href="#gallery">
          Explore Ads
          <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" />
        </a>
        <button class="button button-secondary" type="button" on:click={handleSubmitClick}>
          <UploadCloud size={17} strokeWidth={2.15} aria-hidden="true" />
          Submit Your Own
        </button>
      </div>

      <div class="hero-format-list" aria-label="Supported creative formats">
        <span>HTML5</span>
        <span>GIF</span>
        <span>IMAGE</span>
        <span>VIDEO</span>
      </div>
    </div>

    <div class="hero-showcase" aria-hidden="true">
      <div class="hero-showcase-grid"></div>

      <article class="hero-creative hero-creative-main">
        <div class="hero-creative-meta">
          <span>300 × 250</span>
          <span>Display</span>
        </div>
        <div class="hero-creative-main-copy">
          <span class="hero-mini-kicker">GOOD ADS</span>
          <strong>Move<br />people.</strong>
          <span class="hero-faux-cta">See the work →</span>
        </div>
        <div class="hero-creative-shape"></div>
      </article>

      <article class="hero-creative hero-creative-tall">
        <div class="hero-creative-meta">
          <span>160 × 600</span>
          <span>GIF</span>
        </div>
        <strong>A tall<br />story.</strong>
        <div class="hero-tall-dots"><span></span><span></span><span></span></div>
      </article>

      <article class="hero-creative hero-creative-banner">
        <div>
          <span>728 × 90 · VIDEO</span>
          <strong>Make it impossible to ignore.</strong>
        </div>
        <span class="hero-banner-play">▶</span>
      </article>

      <div class="hero-live-badge">
        <span></span>
        Live creative
      </div>
    </div>
  </div>
</section>
