<script>
  import { goto } from '$app/navigation';
  import { openLightbox, toggleAdLike } from '$lib/stores/archive';
  import { getAdUserName, getAdUserSlug, getAdUserType } from '$lib/utils/ad-utils';
  import CreativePreview from './CreativePreview.svelte';

  export let ad;
</script>

<article class="ad-card">
  <button class="creative-button" type="button" aria-label={`Preview ${ad.title}`} on:click={() => openLightbox(ad.id)}>
    <div class="creative-preview">
      <CreativePreview {ad} />
    </div>
  </button>

  <div class="ad-card-body">
    <h2 class="ad-title">{ad.title}</h2>
    <p class="posted-by">
      Posted by:
      <button class="user-link" type="button" on:click={() => goto(`/user/${getAdUserSlug(ad)}`)}>
        {getAdUserName(ad)}
      </button>
      · {getAdUserType(ad)}
    </p>

    <div class="ad-card-footer">
      <p class="ad-meta">{ad.category} · {ad.medium || 'Web'} · {ad.tags} · {ad.size}</p>
      <button
        class:is-liked={ad.liked}
        class="like-button"
        type="button"
        aria-label={ad.liked ? `Unlike ${ad.title}` : `Like ${ad.title}`}
        on:click={() => toggleAdLike(ad.id)}
      >
        <span aria-hidden="true">{ad.liked ? '♥' : '♡'}</span>
        <span>{ad.likes}</span>
      </button>
    </div>
  </div>
</article>
