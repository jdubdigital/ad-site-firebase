<script>
  import { goto } from '$app/navigation';
  import Edit3 from '@lucide/svelte/icons/edit-3';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { signedInEmail } from '$lib/stores/account';
  import { ads, deleteAd } from '$lib/stores/archive';
  import { favoriteUsers } from '$lib/stores/favorites';
  import { profile, saveProfile } from '$lib/stores/profile';
  import { openSubmit } from '$lib/stores/ui';
  import {
    getAdChronology,
    getAdTypeLabel,
    getAdUserName,
    getAdUserSlug,
    getUserBySlug,
    getUserInitials
  } from '$lib/utils/ad-utils';

  let displayName = '';
  let accountType = 'Brand';
  let description = '';
  let saveStatus = '';
  let deleteStatus = '';
  let deletingAdIds = new Set();

  $: currentProfile = $profile;
  $: myAds = $ads.filter((ad) => getAdUserSlug(ad) === currentProfile.userSlug);
  $: likedAds = $ads.filter((ad) => ad.liked).sort((a, b) => getAdChronology(b) - getAdChronology(a));
  $: favoriteUserDetails = $favoriteUsers.map((slug) => getUserBySlug(slug)).filter(Boolean);
  $: if (currentProfile) {
    displayName = displayName || currentProfile.name;
    accountType = accountType || currentProfile.type;
    description = description || currentProfile.description;
  }

  function syncFields() {
    displayName = currentProfile.name;
    accountType = currentProfile.type;
    description = currentProfile.description;
  }

  function saveDashboardProfile() {
    saveProfile({
      name: displayName.trim() || currentProfile.name,
      type: accountType,
      description: description.trim() || currentProfile.description
    });
    syncFields();
    saveStatus = 'Profile saved for this demo.';
    setTimeout(() => (saveStatus = ''), 1800);
  }

  function handleAvatarUpload(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      saveStatus = 'Please choose an image file.';
      event.currentTarget.value = '';
      return;
    }

    if (file.size > 1500000) {
      saveStatus = 'Choose an image under 1.5 MB for this static demo.';
      event.currentTarget.value = '';
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      saveProfile({ avatarUrl: String(reader.result || '') });
      saveStatus = 'Profile picture uploaded for this demo.';
      event.currentTarget.value = '';
      setTimeout(() => (saveStatus = ''), 1800);
    });
    reader.readAsDataURL(file);
  }

  function removeAvatar() {
    saveProfile({ avatarUrl: '' });
    saveStatus = 'Profile picture removed.';
    setTimeout(() => (saveStatus = ''), 1800);
  }

  async function handleDeleteAd(ad) {
    const confirmed = window.confirm(`Delete "${ad.title}"? This will remove it from the archive.`);
    if (!confirmed) return;

    deleteStatus = '';
    deletingAdIds = new Set([...deletingAdIds, ad.id]);

    try {
      await deleteAd(ad.id);
      deleteStatus = 'Post deleted.';
    } catch (error) {
      deleteStatus = error?.message || 'Unable to delete this post.';
    } finally {
      deletingAdIds = new Set([...deletingAdIds].filter((id) => id !== ad.id));
      setTimeout(() => (deleteStatus = ''), 2200);
    }
  }

  function openAdPage(ad) {
    goto(`/ad/${encodeURIComponent(String(ad.id))}`);
  }

  $: if (currentProfile && !displayName) syncFields();
</script>

<section class="dashboard-hero">
  <div class="container dashboard-heading">
    <div>
      <p class="eyebrow">Account</p>
      <h1 class="dashboard-title">Dashboard</h1>
      <p class="muted">Manage your public profile, posts, liked ads, and favorite users.</p>
    </div>
    <div class="hero-actions">
      <a class="button button-secondary" href="/">View archive</a>
      <button class="button button-primary" type="button" on:click={() => goto('/submit')}>Submit ad</button>
    </div>
  </div>
</section>

<section class="dashboard-page">
  <div class="container">
    <div class="dashboard-grid dashboard-grid-single">
      <section class="dashboard-card profile-card">
        <div class="avatar">
          {#if currentProfile.avatarUrl}
            <img src={currentProfile.avatarUrl} alt={`${currentProfile.name} profile picture`} />
          {:else}
            {getUserInitials(currentProfile.name)}
          {/if}
        </div>
        <div>
          <div class="user-name">
            <h2>{currentProfile.name}</h2>
            <span class="badge">{currentProfile.type}</span>
          </div>
          <p class="muted">{$signedInEmail || currentProfile.email}</p>
          <p>{currentProfile.description}</p>
        </div>
      </section>
    </div>

    <div class="dashboard-main">
      <div class="field-grid">
        <section class="dashboard-panel">
          <h3>Public profile</h3>
          <div class="field-grid">
            <div>
              <p class="section-label">Profile picture</p>
              <div class="profile-picture-row">
                <div class="avatar small">
                  {#if currentProfile.avatarUrl}
                    <img src={currentProfile.avatarUrl} alt={`${currentProfile.name} profile picture`} />
                  {:else}
                    {getUserInitials(displayName || currentProfile.name)}
                  {/if}
                </div>
                <label class="button button-secondary">
                  Upload image
                  <input class="hidden-input" type="file" accept="image/*" on:change={handleAvatarUpload} />
                </label>
                {#if currentProfile.avatarUrl}
                  <button class="button button-secondary" type="button" on:click={removeAvatar}>Remove</button>
                {/if}
              </div>
            </div>

            <label class="field-label">
              Display name
              <input bind:value={displayName} class="field" type="text" />
            </label>

            <label class="field-label">
              Account type
              <select bind:value={accountType} class="select">
                <option>Brand</option>
                <option>Agency</option>
                <option>Individual</option>
              </select>
            </label>

            <label class="field-label">
              Description
              <textarea bind:value={description} class="textarea"></textarea>
            </label>

            <button class="button button-primary" type="button" on:click={saveDashboardProfile}>Save profile</button>
            {#if saveStatus}
              <p class="status">{saveStatus}</p>
            {/if}
          </div>
        </section>

        <section class="dashboard-panel">
          <div class="panel-header">
            <h3>Favorite users</h3>
            <span class="muted">{favoriteUserDetails.length} saved</span>
          </div>
          {#if favoriteUserDetails.length}
            {#each favoriteUserDetails as user}
              <div class="dashboard-row">
                <div class="profile-row">
                  <div class="avatar small">{getUserInitials(user.name)}</div>
                  <div>
                    <strong>{user.name}</strong>
                    <p class="muted">{user.type}</p>
                  </div>
                </div>
                <button class="button button-secondary" type="button" on:click={() => goto(`/user/${user.slug}`)}>View</button>
              </div>
            {/each}
          {:else}
            <p class="muted">No favorite users yet.</p>
          {/if}
        </section>

        <section class="dashboard-panel">
          <div class="panel-header">
            <h3>Liked ads</h3>
            <span class="muted">{likedAds.length} saved</span>
          </div>
          {#if likedAds.length}
            {#each likedAds as ad}
              <div class="dashboard-row">
                <div>
                  <strong>{ad.title}</strong>
                  <p class="muted">{ad.category} · {ad.medium || 'Web'} · {ad.size} · Posted by {getAdUserName(ad)}</p>
                </div>
                <div class="row-actions">
                  <button class="button button-secondary" type="button" on:click={() => goto(`/user/${getAdUserSlug(ad)}`)}>User</button>
                  <button class="button button-secondary" type="button" on:click={() => openAdPage(ad)}>View</button>
                </div>
              </div>
            {/each}
          {:else}
            <p class="muted">No liked ads yet.</p>
          {/if}
        </section>
      </div>

      <section class="dashboard-panel">
        <div class="panel-header">
          <h3>Your posts</h3>
          <span class="muted">{myAds.length} published</span>
        </div>
        {#if deleteStatus}
          <p class="status">{deleteStatus}</p>
        {/if}
        {#if myAds.length}
          {#each myAds as ad}
            <div class="dashboard-row">
              <div>
                <strong>{ad.title}</strong>
                <p class="muted">{ad.category} · {ad.medium || 'Web'} · {ad.tags} · {ad.size} · {getAdTypeLabel(ad.type)}</p>
              </div>
              <div class="row-actions post-actions">
                <span class="muted">{ad.likes} likes</span>
                <button class="button button-secondary" type="button" on:click={() => openSubmit(ad.id)}>
                  <Edit3 size={17} strokeWidth={2.25} aria-hidden="true" />
                  Edit
                </button>
                <button
                  class="button button-danger"
                  type="button"
                  disabled={deletingAdIds.has(ad.id)}
                  on:click={() => handleDeleteAd(ad)}
                >
                  <Trash2 size={17} strokeWidth={2.25} aria-hidden="true" />
                  {deletingAdIds.has(ad.id) ? 'Deleting' : 'Delete'}
                </button>
                <button class="button button-secondary" type="button" on:click={() => openAdPage(ad)}>View</button>
              </div>
            </div>
          {/each}
        {:else}
          <p class="muted">No posts yet.</p>
        {/if}
      </section>
    </div>
  </div>
</section>
