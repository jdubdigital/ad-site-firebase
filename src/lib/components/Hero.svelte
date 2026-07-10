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
      <div class="hero-showcase-panel">
        <div class="hero-showcase-toolbar">
          <div class="hero-window-dots"><span></span><span></span><span></span></div>
          <div class="hero-browser-address"><span></span></div>
          <span class="hero-browser-menu"></span>
        </div>

        <div class="hero-ad-masonry">
          <article class="hero-mock-ad hero-mock-featured">
            <span class="hero-ad-logo"></span>
            <span class="hero-ad-orbit"></span>
            <div class="hero-ad-lines"><span></span><span></span></div>
            <span class="hero-ad-button"></span>
          </article>

          <article class="hero-mock-ad hero-mock-banner">
            <span class="hero-ad-logo"></span>
            <div class="hero-ad-lines"><span></span><span></span></div>
            <span class="hero-ad-button"></span>
          </article>

          <article class="hero-mock-ad hero-mock-portrait">
            <span class="hero-ad-logo"></span>
            <span class="hero-ad-figure"></span>
            <div class="hero-ad-lines"><span></span><span></span></div>
          </article>

          <article class="hero-mock-ad hero-mock-square">
            <span class="hero-ad-logo"></span>
            <span class="hero-ad-disc"></span>
            <span class="hero-ad-button"></span>
          </article>

          <article class="hero-mock-ad hero-mock-mini">
            <span></span><span></span><span></span>
          </article>
        </div>
      </div>
    </div>
  </div>
</section>
