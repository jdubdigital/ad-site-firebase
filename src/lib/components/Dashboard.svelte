<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import Copy from '@lucide/svelte/icons/copy';
  import Edit3 from '@lucide/svelte/icons/edit-3';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { getPublicProfileBySlug } from '$lib/repositories/profile';
  import { signedInEmail, signOut } from '$lib/stores/account';
  import { ads, deleteAd, hydrateAds } from '$lib/stores/archive';
  import { favoriteUsers } from '$lib/stores/favorites';
  import { checkDisplayNameAvailable, checkUserSlugAvailable, profile, saveProfile } from '$lib/stores/profile';
  import { openSubmit } from '$lib/stores/ui';
  import {
    getAdChronology,
    getAdTypeLabel,
    getAdUserName,
    getAdUserSlug,
    getMediumLabel,
    getUserBySlug,
    getUserInitials
  } from '$lib/utils/ad-utils';
  import { cleanDisplayName, createDisplayNameKey, createUsernameSlug } from '$lib/utils/slug';

  let displayName = '';
  let displayNameStatus = '';
  let displayNameAvailable = true;
  let checkingDisplayName = false;
  let displayNameCheckTimer;
  let displayNameCheckRun = 0;
  let username = '';
  let accountType = 'Brand';
  let description = '';
  let saveStatus = '';
  let usernameStatus = '';
  let usernameAvailable = true;
  let checkingUsername = false;
  let savingProfile = false;
  let usernameCheckTimer;
  let usernameCheckRun = 0;
  let copyStatus = '';
  let deleteStatus = '';
  let deletingAdIds = new Set();
  let favoriteUserDetails = [];
  let favoriteUserDetailsRequest = 0;

  const embedScriptOpen = '<script>';
  const embedScriptClose = '</scr' + 'ipt>';

  function escapeAttribute(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function createPortfolioEmbedCode({ frameId, origin, slug, title, url }) {
    return [
      '<iframe',
      `  id="${escapeAttribute(frameId)}"`,
      `  title="${escapeAttribute(title)}"`,
      `  src="${escapeAttribute(url)}"`,
      '  width="100%"',
      '  height="800"',
      '  loading="lazy"',
      '  scrolling="no"',
      '  allowtransparency="true"',
      '  style="border:0;display:block;width:100%;height:800px;overflow:hidden;background:transparent;"',
      '></iframe>',
      embedScriptOpen,
      '(function () {',
      `  var frame = document.getElementById(${JSON.stringify(frameId)});`,
      '  var resized = false;',
      '  function enableFallbackScroll() {',
      '    if (resized || !frame) return;',
      "    frame.setAttribute('scrolling', 'auto');",
      "    frame.scrolling = 'auto';",
      "    frame.style.overflow = 'auto';",
      "    frame.style.webkitOverflowScrolling = 'touch';",
      '  }',
      "  window.addEventListener('message', function (event) {",
      `    if (event.origin !== ${JSON.stringify(origin)}) return;`,
      '    var data = event.data || {};',
      `    if (data.type !== 'adarchive:portfolio-height' || data.slug !== ${JSON.stringify(slug)} || !frame) return;`,
      '    var nextHeight = Math.max(1, Number(data.height) || 1);',
      '    if (nextHeight < 40) return;',
      '    resized = true;',
      "    frame.setAttribute('scrolling', 'no');",
      "    frame.scrolling = 'no';",
      "    frame.style.overflow = 'hidden';",
      "    frame.height = String(nextHeight);",
      "    frame.style.height = nextHeight + 'px';",
      '  });',
      '  setTimeout(enableFallbackScroll, 1800);',
      '  setTimeout(enableFallbackScroll, 4000);',
      '}());',
      embedScriptClose
    ].join('\n');
  }

  $: currentProfile = $profile;
  $: siteOrigin = browser ? window.location.origin : 'https://ad-archive-34f6c.web.app';
  $: portfolioUrl = currentProfile?.userSlug ? `${siteOrigin}/embed/user/${encodeURIComponent(currentProfile.userSlug)}` : '';
  $: portfolioTitle = `${currentProfile?.name || 'Ad Archive'} portfolio`;
  $: portfolioFrameId = currentProfile?.userSlug
    ? `adarchive-portfolio-${String(currentProfile.userSlug).replace(/[^a-z0-9_-]/gi, '-')}`
    : 'adarchive-portfolio-feed';
  $: portfolioEmbedCode = portfolioUrl
    ? createPortfolioEmbedCode({
        frameId: portfolioFrameId,
        origin: siteOrigin,
        slug: currentProfile.userSlug,
        title: portfolioTitle,
        url: portfolioUrl
      })
    : '';
  $: myAds = $ads.filter((ad) => getAdUserSlug(ad) === currentProfile.userSlug);
  $: likedAds = $ads.filter((ad) => ad.liked).sort((a, b) => getAdChronology(b) - getAdChronology(a));
  async function loadFavoriteUserDetails(slugs) {
    const request = ++favoriteUserDetailsRequest;
    const uniqueSlugs = [...new Set(slugs)].filter(Boolean);

    const users = await Promise.all(
      uniqueSlugs.map(async (slug) => {
        const staticUser = getUserBySlug(slug);
        if (staticUser) return staticUser;

        const publicProfile = await getPublicProfileBySlug(slug);
        return publicProfile
          ? {
              ...publicProfile,
              slug: publicProfile.userSlug || slug
            }
          : null;
      })
    );

    if (request === favoriteUserDetailsRequest) {
      favoriteUserDetails = users.filter(Boolean);
    }
  }

  $: loadFavoriteUserDetails($favoriteUsers);
  $: if (currentProfile) {
    displayName = displayName || currentProfile.name;
    username = username || currentProfile.username || currentProfile.userSlug;
    accountType = accountType || currentProfile.type;
    description = description || currentProfile.description;
  }

  function syncFields() {
    displayName = currentProfile.name;
    username = currentProfile.username || currentProfile.userSlug;
    accountType = currentProfile.type;
    description = currentProfile.description;
  }

  async function checkDisplayNameNow() {
    const requestedName = cleanDisplayName(displayName, '');
    const requestedKey = createDisplayNameKey(requestedName, '');
    const currentKey = currentProfile.displayNameKey || createDisplayNameKey(currentProfile.name, '');
    const run = ++displayNameCheckRun;

    displayNameAvailable = false;

    if (!requestedName || requestedName.length < 2) {
      displayNameStatus = 'Use at least 2 characters.';
      return false;
    }

    if (requestedKey === currentKey) {
      displayNameAvailable = true;
      displayNameStatus = 'Current display name.';
      return true;
    }

    checkingDisplayName = true;
    displayNameStatus = 'Checking display name...';

    try {
      const available = await checkDisplayNameAvailable(requestedName, currentKey);
      if (run !== displayNameCheckRun) return false;

      displayNameAvailable = available;
      displayNameStatus = available ? 'Display name is available.' : 'That display name is already taken.';
      return available;
    } catch (error) {
      if (run === displayNameCheckRun) displayNameStatus = 'Unable to check that display name right now.';
      return false;
    } finally {
      if (run === displayNameCheckRun) checkingDisplayName = false;
    }
  }

  function scheduleDisplayNameCheck() {
    clearTimeout(displayNameCheckTimer);
    displayName = cleanDisplayName(displayName, '');
    displayNameAvailable = createDisplayNameKey(displayName, '') === (currentProfile.displayNameKey || createDisplayNameKey(currentProfile.name, ''));
    displayNameStatus = displayName ? 'Checking display name...' : '';

    if (displayName) {
      displayNameCheckTimer = setTimeout(checkDisplayNameNow, 350);
    }
  }

  async function checkUsernameNow() {
    const requestedSlug = createUsernameSlug(username, '');
    const currentSlug = currentProfile.userSlug;
    const run = ++usernameCheckRun;

    usernameAvailable = false;

    if (!requestedSlug || requestedSlug.length < 3) {
      usernameStatus = 'Use at least 3 characters.';
      return false;
    }

    if (requestedSlug === currentSlug) {
      usernameAvailable = true;
      usernameStatus = `Current username: /user/${requestedSlug}`;
      return true;
    }

    checkingUsername = true;
    usernameStatus = 'Checking username...';

    try {
      const available = await checkUserSlugAvailable(requestedSlug, currentSlug);
      if (run !== usernameCheckRun) return false;

      usernameAvailable = available;
      usernameStatus = available ? `Available: /user/${requestedSlug}` : 'That username is already taken.';
      return available;
    } catch (error) {
      if (run === usernameCheckRun) usernameStatus = 'Unable to check that username right now.';
      return false;
    } finally {
      if (run === usernameCheckRun) checkingUsername = false;
    }
  }

  function scheduleUsernameCheck() {
    clearTimeout(usernameCheckTimer);
    username = createUsernameSlug(username, '');
    usernameAvailable = username === currentProfile.userSlug;
    usernameStatus = username ? 'Checking username...' : '';

    if (username) {
      usernameCheckTimer = setTimeout(checkUsernameNow, 350);
    }
  }

  async function saveDashboardProfile() {
    if (savingProfile) return;
    saveStatus = '';
    savingProfile = true;

    try {
      const requestedName = cleanDisplayName(displayName, '');
      const requestedSlug = createUsernameSlug(username, '');
      const [nameAvailable, slugAvailable] = await Promise.all([checkDisplayNameNow(), checkUsernameNow()]);
      if (!nameAvailable) throw new Error('Choose an available display name before saving.');
      if (!slugAvailable) throw new Error('Choose an available username before saving.');

      await saveProfile({
        name: requestedName,
        username: requestedSlug,
        userSlug: requestedSlug,
        type: accountType,
        description: description.trim() || currentProfile.description
      });
      syncFields();
      await hydrateAds();
      saveStatus = 'Profile saved.';
      setTimeout(() => (saveStatus = ''), 1800);
    } catch (error) {
      saveStatus = error?.message || 'Unable to save profile.';
    } finally {
      savingProfile = false;
    }
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
      saveProfile({ avatarUrl: String(reader.result || '') })
        .then(() => {
          saveStatus = 'Profile picture uploaded.';
          setTimeout(() => (saveStatus = ''), 1800);
        })
        .catch((error) => {
          saveStatus = error?.message || 'Unable to upload profile picture.';
        })
        .finally(() => {
          event.currentTarget.value = '';
        });
    });
    reader.readAsDataURL(file);
  }

  function removeAvatar() {
    saveProfile({ avatarUrl: '' })
      .then(() => {
        saveStatus = 'Profile picture removed.';
        setTimeout(() => (saveStatus = ''), 1800);
      })
      .catch((error) => {
        saveStatus = error?.message || 'Unable to remove profile picture.';
      });
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

  async function copyPortfolioEmbed() {
    if (!portfolioEmbedCode) return;

    try {
      await navigator.clipboard.writeText(portfolioEmbedCode);
      copyStatus = 'Embed code copied.';
    } catch (error) {
      copyStatus = 'Select the code and copy it manually.';
    }

    setTimeout(() => (copyStatus = ''), 2000);
  }

  function openAdPage(ad) {
    goto(`/ad/${encodeURIComponent(String(ad.id))}`);
  }

  async function handleSignOut() {
    await signOut();
    goto('/');
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
      <button class="button button-primary" type="button" on:click={() => goto('/submit')}>Submit</button>
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
              <input
                class="field"
                type="text"
                minlength="2"
                maxlength="64"
                autocomplete="name"
                value={displayName}
                on:input={(event) => {
                  displayName = event.currentTarget.value;
                  scheduleDisplayNameCheck();
                }}
                on:blur={checkDisplayNameNow}
              />
              {#if displayNameStatus}
                <span class:status-good={displayNameAvailable} class="field-help">{displayNameStatus}</span>
              {/if}
            </label>

            <label class="field-label">
              Username
              <input
                class="field"
                type="text"
                minlength="3"
                maxlength="48"
                autocomplete="username"
                value={username}
                on:input={(event) => {
                  username = event.currentTarget.value;
                  scheduleUsernameCheck();
                }}
                on:blur={checkUsernameNow}
              />
              {#if usernameStatus}
                <span class:status-good={usernameAvailable} class="field-help">{usernameStatus}</span>
              {/if}
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

            <button
              class="button button-primary"
              type="button"
              disabled={savingProfile || checkingDisplayName || checkingUsername}
              on:click={saveDashboardProfile}
            >
              {savingProfile ? 'Saving...' : 'Save profile'}
            </button>
            {#if saveStatus}
              <p class="status">{saveStatus}</p>
            {/if}
          </div>
        </section>

        <section class="dashboard-panel">
          <div class="panel-header">
            <h3>Portfolio feed</h3>
            <span class="muted">{myAds.length} ads</span>
          </div>
          <div class="field-grid">
            <label class="field-label">
              Embed link
              <input class="field" type="text" readonly value={portfolioUrl} />
            </label>

            <label class="field-label">
              Embed code
              <textarea class="textarea embed-code-field" readonly value={portfolioEmbedCode}></textarea>
            </label>

            <div class="row-actions portfolio-actions">
              <button class="button button-secondary" type="button" on:click={copyPortfolioEmbed}>
                <Copy size={17} strokeWidth={2.25} aria-hidden="true" />
                Copy code
              </button>
              <a class="button button-secondary" href={portfolioUrl} target="_blank" rel="noreferrer">Preview feed</a>
            </div>

            {#if copyStatus}
              <p class="status">{copyStatus}</p>
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
                  <p class="muted">{ad.category} · {getMediumLabel(ad.medium)} · {ad.size} · Posted by {getAdUserName(ad)}</p>
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
                <p class="muted">{ad.category} · {getMediumLabel(ad.medium)} · {ad.tags} · {ad.size} · {getAdTypeLabel(ad.type)}</p>
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

    <div class="dashboard-footer-actions">
      <button class="button button-secondary" type="button" on:click={handleSignOut}>Sign out</button>
    </div>
  </div>
</section>
