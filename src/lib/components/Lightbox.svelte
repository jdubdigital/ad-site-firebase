<script>
  import { goto } from '$app/navigation';
  import { closeLightbox, selectedAd, toggleAdLike } from '$lib/stores/archive';
  import { getAdUserName, getAdUserSlug, getAdUserType } from '$lib/utils/ad-utils';
  import CreativePreview from './CreativePreview.svelte';
</script>

{#if $selectedAd}
  <div class="lightbox-overlay" role="dialog" aria-modal="true" aria-label={`Preview ${$selectedAd.title}`}>
    <button class="overlay" type="button" aria-label="Close preview" on:click={closeLightbox}></button>
    <div class="lightbox-box">
      <button class="icon-button close-floating" type="button" aria-label="Close preview" on:click={closeLightbox}>×</button>
      <div class="lightbox-creative">
        <CreativePreview ad={$selectedAd} large />
      </div>
      <div class="lightbox-details">
        <h2 class="ad-title">{$selectedAd.title}</h2>
        <p class="posted-by">
          Posted by:
          <button
            class="user-link"
            type="button"
            on:click={() => {
              closeLightbox();
              goto(`/user/${getAdUserSlug($selectedAd)}`);
            }}
          >
            {getAdUserName($selectedAd)}
          </button>
          ({getAdUserType($selectedAd)}) · Category: {$selectedAd.category} · Medium: {$selectedAd.medium || 'Web'} · Size: {$selectedAd.size}
        </p>
        <p class="ad-meta">Tags: {$selectedAd.tags}</p>
        <button
          class:is-liked={$selectedAd.liked}
          class="like-button"
          type="button"
          on:click={() => toggleAdLike($selectedAd.id)}
        >
          <span aria-hidden="true">{$selectedAd.liked ? '♥' : '♡'}</span>
          <span>{$selectedAd.likes}</span>
        </button>
      </div>
    </div>
  </div>
{/if}
