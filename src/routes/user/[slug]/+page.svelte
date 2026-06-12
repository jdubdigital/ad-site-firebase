<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import MasonryGrid from '$lib/components/MasonryGrid.svelte';
  import { getPublicProfileBySlug } from '$lib/repositories/profile';
  import { signedInEmail } from '$lib/stores/account';
  import { ads } from '$lib/stores/archive';
  import { favoriteUsers, toggleFavoriteUser } from '$lib/stores/favorites';
  import { profile } from '$lib/stores/profile';
  import { getAdChronology, getAdUserName, getAdUserSlug, getAdUserType, getUserBySlug, getUserInitials } from '$lib/utils/ad-utils';

  export let data = {
    publicUser: null,
    userAds: []
  };

  let publicUser = null;
  let publicUserSlug = '';
  let publicUserLoading = false;
  let publicUserRequest = 0;

  async function loadPublicUser(slugValue) {
    if (!slugValue || slugValue === publicUserSlug) return;

    const request = ++publicUserRequest;
    publicUserSlug = slugValue;
    publicUser = null;
    publicUserLoading = true;

    try {
      const foundUser = await getPublicProfileBySlug(slugValue);
      if (request === publicUserRequest) publicUser = foundUser;
    } finally {
      if (request === publicUserRequest) publicUserLoading = false;
    }
  }

  $: slug = $page.params.slug;
  $: if (browser && slug) loadPublicUser(slug);
  $: baseUser = getUserBySlug(slug);
  $: isCurrentProfile = slug === $profile.userSlug;
  $: currentUser = isCurrentProfile
    ? {
        slug,
        name: $profile.name,
        type: $profile.type,
        description: $profile.description,
        avatarUrl: $profile.avatarUrl
      }
    : null;
  $: sourceAds = $ads.length ? $ads : data.userAds || [];
  $: userAds = sourceAds.filter((ad) => getAdUserSlug(ad) === slug).sort((a, b) => getAdChronology(b) - getAdChronology(a));
  $: adUser = userAds[0]
    ? {
        slug,
        name: getAdUserName(userAds[0]),
        type: getAdUserType(userAds[0]),
        description: 'Public profile for ads and creative references shared by this user.',
        avatarUrl: ''
      }
    : null;
  $: user = currentUser || publicUser || data.publicUser || adUser || baseUser;
  $: metaItems = user ? [user.location, user.specialty, `${userAds.length} posts`].filter(Boolean) : [];
  $: isFavorited = $favoriteUsers.includes(slug);
</script>

<svelte:head>
  <title>{user ? `${user.name} · Ad Archive` : 'User Not Found · Ad Archive'}</title>
</svelte:head>

{#if user}
  <section class="user-hero">
    <div class="container">
      <button class="button button-secondary" type="button" on:click={() => goto('/')}>← Back to archive</button>

      <div class="user-profile">
        <div class="profile-row">
          <div class="avatar">
            {#if user.avatarUrl}
              <img src={user.avatarUrl} alt={`${user.name} profile picture`} />
            {:else}
              {getUserInitials(user.name)}
            {/if}
          </div>
          <div>
            <div class="user-name">
              <h1>{user.name}</h1>
              <span class="badge">{user.type}</span>
            </div>
            <p>{user.description}</p>
            <div class="meta-line">
              {#each metaItems as item}
                <span>{item}</span>
              {/each}
            </div>
          </div>
        </div>

        <button
          class="button"
          class:button-primary={isFavorited}
          class:button-secondary={!isFavorited}
          type="button"
          aria-pressed={$signedInEmail ? isFavorited : false}
          on:click={() => toggleFavoriteUser(slug)}
        >
          {$signedInEmail ? (isFavorited ? '♥ Favorited' : '♡ Favorite') : 'Sign in to favorite'}
        </button>
      </div>
    </div>
  </section>

  <section class="gallery-section" style="padding-top: 2rem;">
    <div class="container">
      <div class="toolbar-inner" style="margin-bottom: 1rem;">
        <h2>Posts</h2>
        <p class="muted">{userAds.length} posts by {user.name}</p>
      </div>

      {#if userAds.length}
        <MasonryGrid ads={userAds} />
      {:else}
        <div class="empty-state">This user has not published any ads yet.</div>
      {/if}
    </div>
  </section>
{:else if publicUserLoading}
  <section class="dashboard-page">
    <div class="container empty-state">
      <h1>Loading user</h1>
      <p class="muted">Checking the public profile for this user.</p>
    </div>
  </section>
{:else}
  <section class="dashboard-page">
    <div class="container empty-state">
      <h1>User not found</h1>
      <p class="muted">The public profile you opened does not exist yet.</p>
      <button class="button button-primary" type="button" on:click={() => goto('/')}>Back to archive</button>
    </div>
  </section>
{/if}
