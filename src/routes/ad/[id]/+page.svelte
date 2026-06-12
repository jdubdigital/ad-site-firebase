<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import CreativePreview from '$lib/components/CreativePreview.svelte';
  import { signedInEmail } from '$lib/stores/account';
  import { ads, adsReady, toggleAdLike } from '$lib/stores/archive';
  import { getAdTypeLabel, getAdUserName, getAdUserSlug, getAdUserType, getMediumLabel } from '$lib/utils/ad-utils';

  $: adId = decodeURIComponent($page.params.id || '');
  $: ad = $ads.find((item) => String(item.id) === adId);
  $: userSlug = ad ? getAdUserSlug(ad) : '';
  $: detailRows = ad
    ? [
        ['User', `${getAdUserName(ad)} · ${getAdUserType(ad)}`],
        ['Category', ad.category],
        ['Medium', getMediumLabel(ad.medium)],
        ['Format', getAdTypeLabel(ad.type)],
        ['Size', ad.size],
        ['Tags', ad.tags]
      ].filter(([, value]) => value)
    : [];
</script>

<svelte:head>
  <title>{ad ? `${ad.title} · Ad Archive` : 'Ad · Ad Archive'}</title>
</svelte:head>

<section class="ad-detail-page">
  <div class="container">
    <button class="button button-secondary ad-detail-back" type="button" on:click={() => goto('/')}>Back to archive</button>

    {#if ad}
      <div class="ad-detail-layout">
        <div class="ad-detail-preview">
          <CreativePreview {ad} large />
        </div>

        <aside class="ad-detail-panel">
          <div class="ad-detail-header">
            <p class="eyebrow">{getAdTypeLabel(ad.type)}</p>
            <h1>{ad.title}</h1>
            <button class="user-link" type="button" on:click={() => goto(`/user/${userSlug}`)}>
              Posted by {getAdUserName(ad)}
            </button>
          </div>

          <dl class="detail-list">
            {#each detailRows as [label, value]}
              <div>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            {/each}
          </dl>

          {#if ad.notes}
            <div class="ad-notes">
              <h2>Notes</h2>
              <p>{ad.notes}</p>
            </div>
          {/if}

          <div class="ad-detail-actions">
            <button
              class:is-liked={ad.liked}
              class="button button-secondary like-detail-button"
              type="button"
              aria-label={$signedInEmail ? (ad.liked ? `Unlike ${ad.title}` : `Like ${ad.title}`) : 'Sign in to like ads'}
              on:click={() => toggleAdLike(ad.id)}
            >
              <span aria-hidden="true">{ad.liked ? '♥' : '♡'}</span>
              <span>{$signedInEmail ? `${ad.likes} likes` : 'Sign in to like'}</span>
            </button>

          </div>
        </aside>
      </div>
    {:else if !$adsReady}
      <div class="empty-state">
        <h1>Loading ad</h1>
        <p class="muted">Checking the archive for this creative.</p>
      </div>
    {:else}
      <div class="empty-state">
        <h1>Ad not found</h1>
        <p class="muted">This creative does not exist in the archive.</p>
        <button class="button button-primary" type="button" on:click={() => goto('/')}>Back to archive</button>
      </div>
    {/if}
  </div>
</section>
