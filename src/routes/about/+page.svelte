<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Code2 from '@lucide/svelte/icons/code-2';
  import MonitorPlay from '@lucide/svelte/icons/monitor-play';
  import Search from '@lucide/svelte/icons/search';
  import UploadCloud from '@lucide/svelte/icons/upload-cloud';
  import { signedInEmail } from '$lib/stores/account';
  import { openLogin } from '$lib/stores/ui';

  let pageRoot;

  function handleSubmit() {
    if ($signedInEmail) {
      goto('/submit');
      return;
    }

    openLogin('signin');
  }

  onMount(async () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      gsap
        .timeline({ defaults: { duration: 0.75, ease: 'power3.out' } })
        .from('[data-about-kicker]', { y: 16, opacity: 0 })
        .from('[data-about-title]', { y: 24, opacity: 0 }, '-=0.52')
        .from('[data-about-lead]', { y: 20, opacity: 0 }, '-=0.48')
        .from('[data-about-actions]', { y: 16, opacity: 0 }, '-=0.42');

      gsap.utils.toArray('[data-about-reveal]').forEach((element) => {
        gsap.from(element, {
          scrollTrigger: {
            trigger: element,
            start: 'top 84%',
            once: true
          },
          y: 28,
          opacity: 0,
          duration: 0.7,
          ease: 'power3.out'
        });
      });
    }, pageRoot);

    return () => context.revert();
  });
</script>

<svelte:head>
  <title>About · Ad Archive</title>
  <meta
    name="description"
    content="Ad Archive is a searchable home for digital advertising creative, live programmatic previews, public profiles, and embeddable portfolios."
  />
</svelte:head>

<div bind:this={pageRoot} class="about-page">
  <div class="about-fold">
    <section class="about-hero">
      <div class="container about-hero-inner">
        <p class="eyebrow" data-about-kicker>Creative reference, live preview, portfolio</p>
        <h1 data-about-title><span>Ad</span>Archive</h1>
        <p class="about-lead" data-about-lead>
          A focused home for advertising creative that deserves a life beyond the campaign.
          Discover what works, preserve the work, and share it beautifully.
        </p>
        <div class="about-actions" data-about-actions>
          <a class="button button-primary" href="/#gallery">
            Explore the archive
            <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" />
          </a>
          <button class="button button-secondary" type="button" on:click={handleSubmit}>Add your work</button>
        </div>
      </div>
    </section>

    <section class="about-signal" aria-label="Platform capabilities">
      <div class="container about-signal-inner">
        <p><strong>Searchable</strong><span>by category, medium, format, and creator</span></p>
        <p><strong>Interactive</strong><span>with live programmatic creative previews</span></p>
        <p><strong>Shareable</strong><span>through public profiles and portfolio embeds</span></p>
      </div>
    </section>
  </div>

  <section class="about-section">
    <div class="container about-story">
      <div class="about-story-copy" data-about-reveal>
        <p class="eyebrow">Why it exists</p>
        <h2>Great creative should not disappear when the media buy ends.</h2>
      </div>
      <div class="about-story-body" data-about-reveal>
        <p>
          Advertising teams produce an enormous amount of work, yet the best examples are often scattered across
          folders, screenshots, old campaign links, and private decks.
        </p>
        <p>
          Ad Archive gives that work a useful home: a visual reference library for the industry, a record for the
          people who made it, and a faster way to find inspiration without digging through generic galleries.
        </p>
      </div>
    </div>
  </section>

  <section class="about-section about-section-muted">
    <div class="container">
      <div class="section-heading" data-about-reveal>
        <p class="eyebrow">One archive, four jobs</p>
        <h2>Built for the way creative actually gets used.</h2>
      </div>

      <div class="about-feature-list">
        <article data-about-reveal>
          <div class="feature-icon"><Search size={22} strokeWidth={2} aria-hidden="true" /></div>
          <div>
            <p class="feature-number">01</p>
            <h3>Find the right reference</h3>
            <p>Browse by industry, placement, medium, format, creator, or keyword instead of searching from scratch.</p>
          </div>
        </article>
        <article data-about-reveal>
          <div class="feature-icon feature-icon-pink"><UploadCloud size={22} strokeWidth={2} aria-hidden="true" /></div>
          <div>
            <p class="feature-number">02</p>
            <h3>Preserve the real creative</h3>
            <p>Keep images, GIFs, video, and programmatic work together with useful campaign context.</p>
          </div>
        </article>
        <article data-about-reveal>
          <div class="feature-icon feature-icon-cyan"><MonitorPlay size={22} strokeWidth={2} aria-hidden="true" /></div>
          <div>
            <p class="feature-number">03</p>
            <h3>Experience interactive ads</h3>
            <p>Open HTML programmatic creative in a dedicated live environment designed for motion and scroll behavior.</p>
          </div>
        </article>
        <article data-about-reveal>
          <div class="feature-icon feature-icon-yellow"><Code2 size={22} strokeWidth={2} aria-hidden="true" /></div>
          <div>
            <p class="feature-number">04</p>
            <h3>Turn a profile into a portfolio</h3>
            <p>Select published work and embed the resulting feed into an existing personal or agency website.</p>
          </div>
        </article>
      </div>
    </div>
  </section>

  <section class="about-section">
    <div class="container about-workflow">
      <div class="section-heading" data-about-reveal>
        <p class="eyebrow">Simple by design</p>
        <h2>From finished asset to useful reference.</h2>
      </div>
      <ol class="workflow-list">
        <li data-about-reveal>
          <span>1</span>
          <div><strong>Upload</strong><p>Add the creative asset and the details that make it findable.</p></div>
        </li>
        <li data-about-reveal>
          <span>2</span>
          <div><strong>Publish</strong><p>Give the work a permanent page connected to its creator profile.</p></div>
        </li>
        <li data-about-reveal>
          <span>3</span>
          <div><strong>Share</strong><p>Use the archive link, public profile, or embedded portfolio wherever it matters.</p></div>
        </li>
      </ol>
    </div>
  </section>

  <section class="about-audience">
    <div class="container about-audience-inner">
      <div data-about-reveal>
        <p class="eyebrow">Made for the whole creative chain</p>
        <h2>Useful to the people making the work and the people looking for it.</h2>
      </div>
      <div class="audience-grid" data-about-reveal>
        <p><strong>Designers & developers</strong><span>Show the finished work in context.</span></p>
        <p><strong>Agencies & studios</strong><span>Build a living record of client creative.</span></p>
        <p><strong>Brands & media teams</strong><span>Keep campaign knowledge visible and reusable.</span></p>
      </div>
    </div>
  </section>

  <section class="about-cta">
    <div class="container about-cta-inner" data-about-reveal>
      <div>
        <p class="eyebrow">The archive gets better with every contribution</p>
        <h2>Put great advertising where people can find it.</h2>
      </div>
      <div class="about-actions">
        <button class="button button-primary" type="button" on:click={handleSubmit}>Add to the archive</button>
        <a class="button button-secondary" href="/#gallery">Browse creative</a>
      </div>
    </div>
  </section>
</div>

<style>
  .about-page {
    overflow: hidden;
    background: var(--bg);
  }

  .about-fold {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-height: calc(100vh - 5.5rem);
    min-height: calc(100svh - 5.5rem);
  }

  .about-hero {
    display: grid;
    min-height: 0;
    background: var(--bg-soft);
  }

  .about-hero-inner {
    display: grid;
    align-content: center;
    justify-items: center;
    padding-block: clamp(2rem, 6vh, 4.5rem);
    text-align: center;
  }

  .about-hero h1 {
    margin: 0.55rem 0 0;
    font-size: clamp(4rem, 13vw, 9rem);
    line-height: 0.88;
    letter-spacing: 0;
  }

  .about-hero h1 span {
    color: var(--pink);
  }

  .about-lead {
    max-width: 47rem;
    margin: 1.5rem auto 0;
    color: var(--muted);
    font-size: clamp(1.08rem, 2.3vw, 1.35rem);
    line-height: 1.55;
  }

  .about-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.7rem;
    margin-top: 1.8rem;
  }

  .about-signal {
    border-block: 1px solid var(--border);
    background: var(--bg-muted);
    padding-block: clamp(1.3rem, 2.6vh, 2rem);
  }

  .about-signal-inner {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }

  .about-signal p {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    padding: 0.25rem 2rem;
  }

  .about-signal p + p {
    border-left: 1px solid var(--border);
  }

  .about-signal strong {
    font-size: 1rem;
  }

  .about-signal span {
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.45;
  }

  .about-section {
    padding-block: clamp(5rem, 10vw, 8.5rem);
  }

  .about-section-muted {
    border-block: 1px solid var(--border);
    background: var(--bg-soft);
  }

  .about-story {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(18rem, 0.95fr);
    gap: clamp(3rem, 8vw, 8rem);
    align-items: start;
  }

  .about-story h2,
  .section-heading h2,
  .about-audience h2,
  .about-cta h2 {
    margin: 0.55rem 0 0;
    font-size: clamp(2.15rem, 5vw, 4rem);
    line-height: 1.03;
    letter-spacing: 0;
  }

  .about-story-body {
    padding-top: 1.75rem;
  }

  .about-story-body p {
    margin: 0;
    color: var(--muted);
    font-size: 1.05rem;
    line-height: 1.75;
  }

  .about-story-body p + p {
    margin-top: 1.25rem;
  }

  .section-heading {
    max-width: 47rem;
  }

  .about-feature-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-top: 4rem;
    border-top: 1px solid var(--border);
  }

  .about-feature-list article {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 1.25rem;
    min-height: 15rem;
    border-bottom: 1px solid var(--border);
    padding: 2rem;
  }

  .about-feature-list article:nth-child(odd) {
    border-right: 1px solid var(--border);
  }

  .feature-icon {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 6px;
    background: color-mix(in srgb, var(--accent) 16%, var(--bg));
    color: var(--accent);
  }

  .feature-icon-pink {
    background: color-mix(in srgb, var(--pink) 14%, var(--bg));
    color: var(--pink);
  }

  .feature-icon-cyan {
    background: color-mix(in srgb, #0891b2 14%, var(--bg));
    color: #0891b2;
  }

  .feature-icon-yellow {
    background: color-mix(in srgb, #d69e00 14%, var(--bg));
    color: #b77900;
  }

  .feature-number {
    margin: 0 0 1.5rem;
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 800;
  }

  .about-feature-list h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  .about-feature-list article p:last-child {
    max-width: 28rem;
    margin: 0.65rem 0 0;
    color: var(--muted);
    line-height: 1.6;
  }

  .about-workflow {
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(22rem, 1.15fr);
    gap: clamp(3rem, 8vw, 8rem);
    align-items: start;
  }

  .workflow-list {
    margin: 0;
    padding: 0;
    list-style: none;
    counter-reset: none;
  }

  .workflow-list li {
    display: grid;
    grid-template-columns: 2.5rem 1fr;
    gap: 1rem;
    border-top: 1px solid var(--border);
    padding: 1.5rem 0;
  }

  .workflow-list li:last-child {
    border-bottom: 1px solid var(--border);
  }

  .workflow-list > li > span {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border: 1px solid var(--border);
    border-radius: 50%;
    color: var(--accent);
    font-size: 0.8rem;
    font-weight: 800;
  }

  .workflow-list strong {
    font-size: 1.1rem;
  }

  .workflow-list p {
    margin: 0.35rem 0 0;
    color: var(--muted);
    line-height: 1.55;
  }

  .about-audience {
    border-block: 1px solid var(--border);
    background: #19191c;
    color: #ffffff;
    padding-block: clamp(5rem, 10vw, 8rem);
  }

  .about-audience .eyebrow,
  .about-audience .audience-grid span {
    color: #b8b8c2;
  }

  .about-audience-inner {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(22rem, 0.9fr);
    gap: clamp(3rem, 8vw, 8rem);
    align-items: end;
  }

  .audience-grid {
    display: grid;
  }

  .audience-grid p {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    border-top: 1px solid #3b3b42;
    padding: 1.15rem 0;
  }

  .audience-grid p:last-child {
    border-bottom: 1px solid #3b3b42;
  }

  .audience-grid span {
    font-size: 0.9rem;
  }

  .about-cta {
    background: var(--bg-soft);
    padding-block: clamp(4.5rem, 9vw, 7rem);
  }

  .about-cta-inner {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 3rem;
  }

  .about-cta-inner > div:first-child {
    max-width: 48rem;
  }

  .about-cta .about-actions {
    flex: 0 0 auto;
    justify-content: flex-end;
    margin-top: 0;
  }

  @media (max-width: 900px) {
    .about-story,
    .about-workflow,
    .about-audience-inner {
      grid-template-columns: 1fr;
      gap: 2.5rem;
    }

    .about-story-body {
      padding-top: 0;
    }

    .about-cta-inner {
      align-items: flex-start;
      flex-direction: column;
    }

    .about-cta .about-actions {
      justify-content: flex-start;
    }
  }

  @media (max-width: 767px) {
    .about-fold {
      min-height: calc(100vh - 4.75rem);
      min-height: calc(100svh - 4.75rem);
    }
  }

  @media (max-width: 700px) {
    .about-hero-inner {
      padding-block: 1.5rem;
    }

    .about-hero h1 {
      font-size: clamp(2.9rem, 16vw, 4.15rem);
    }

    .about-lead {
      margin-top: 1rem;
      font-size: 1rem;
    }

    .about-signal {
      padding-block: 0.65rem;
    }

    .about-signal-inner {
      grid-template-columns: 1fr;
    }

    .about-signal p {
      padding: 0.7rem 0;
    }

    .about-signal p + p {
      border-top: 1px solid var(--border);
      border-left: 0;
    }

    .about-feature-list {
      grid-template-columns: 1fr;
      margin-top: 2.5rem;
    }

    .about-feature-list article {
      min-height: 0;
      border-right: 0 !important;
      padding: 1.5rem 0;
    }

    .about-actions {
      display: grid;
      grid-template-columns: 1fr;
    }

    .about-actions .button {
      width: 100%;
    }

    .about-cta .about-actions {
      width: 100%;
    }
  }

</style>
