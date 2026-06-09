<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { adTypes, categories, mediums, sizes } from '$lib/data/catalog';
  import { isFirebaseConfigured } from '$lib/firebase/client';
  import { ads, submitAd, updateAd } from '$lib/stores/archive';
  import { profile } from '$lib/stores/profile';
  import { closeSubmit, submitEditingAdId, submitOpen } from '$lib/stores/ui';
  import { cleanSubmittedValue, getAdTypeLabel } from '$lib/utils/ad-utils';

  const localMaxFileSize = 2500000;
  const firebaseMaxFileSize = 10 * 1024 * 1024;

  let title = '';
  let category = 'Retail';
  let medium = 'Web';
  let type = 'image';
  let size = '300x250';
  let customWidth = '';
  let customHeight = '';
  let tags = '';
  let landingUrl = '';
  let mediaUrl = '';
  let notes = '';
  let rights = false;
  let transparency = false;
  let pendingFile = null;
  let pendingMediaData = '';
  let pendingFileName = '';
  let status = '';
  let submitting = false;

  $: editingAd = $submitEditingAdId ? $ads.find((ad) => ad.id === $submitEditingAdId) : null;
  $: isEditing = Boolean(editingAd);
  $: submitSize = size === 'custom' && customWidth && customHeight ? `${customWidth}x${customHeight}` : size;
  $: assetSummary = pendingFileName || mediaUrl.trim() || 'Demo placeholder until media is provided';
  $: fileLimitLabel = isFirebaseConfigured ? 'Max 10 MB' : 'Max 2.5 MB for local browser storage';

  function setSizeValue(nextSize) {
    if (sizes.includes(nextSize)) {
      size = nextSize;
      customWidth = '';
      customHeight = '';
      return;
    }

    const [width, height] = String(nextSize || '').split('x');
    size = 'custom';
    customWidth = width || '';
    customHeight = height || '';
  }

  function populateFromAd(ad) {
    title = ad.title || '';
    category = ad.category || 'Other';
    medium = ad.medium || 'Web';
    type = ad.type || 'image';
    setSizeValue(ad.size || '300x250');
    tags = ad.tags || '';
    landingUrl = ad.landingUrl || '';
    mediaUrl = ad.mediaUrl && !ad.mediaUrl.startsWith('data:') ? ad.mediaUrl : '';
    notes = ad.notes || '';
    pendingMediaData = ad.mediaUrl && ad.mediaUrl.startsWith('data:') ? ad.mediaUrl : '';
    pendingFile = null;
    pendingFileName = ad.mediaFileName || '';
    rights = true;
    transparency = true;
    status = '';
  }

  function resetForm() {
    if (editingAd) {
      populateFromAd(editingAd);
      return;
    }

    title = '';
    category = 'Retail';
    medium = 'Web';
    type = 'image';
    size = '300x250';
    customWidth = '';
    customHeight = '';
    tags = '';
    landingUrl = '';
    mediaUrl = '';
    notes = '';
    rights = false;
    transparency = false;
    pendingMediaData = '';
    pendingFile = null;
    pendingFileName = '';
    status = '';
  }

  function handleClose() {
    closeSubmit();
    if ($page.url.pathname === '/submit') goto('/');
  }

  function handleFile(event) {
    const file = event.currentTarget.files?.[0];
    pendingMediaData = '';
    pendingFile = null;
    pendingFileName = '';

    if (!file) return;

    const isZip =
      file.name.toLowerCase().endsWith('.zip') ||
      file.type === 'application/zip' ||
      file.type === 'application/x-zip-compressed';

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !isZip) {
      status = 'Please choose an image, GIF, video, or HTML5 ZIP file.';
      event.currentTarget.value = '';
      return;
    }

    const maxFileSize = isFirebaseConfigured ? firebaseMaxFileSize : localMaxFileSize;
    if (file.size > maxFileSize) {
      status = isFirebaseConfigured ? 'Choose a file under 10 MB.' : 'Choose a file under 2.5 MB for local browser storage.';
      event.currentTarget.value = '';
      return;
    }

    if (isZip) type = 'html5';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type === 'image/gif') type = 'gif';
    else type = 'image';

    pendingFile = file;
    pendingFileName = file.name;

    if (isZip) {
      status = 'HTML5 ZIP selected. It will be extracted into a sandboxed preview after submit.';
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      pendingMediaData = String(reader.result || '');
      pendingFileName = file.name;
      status = '';
    });
    reader.readAsDataURL(file);
  }

  async function submitForm() {
    if (submitting) return;
    status = '';

    if (size === 'custom' && (!Number(customWidth) || !Number(customHeight))) {
      status = 'Enter a custom width and height.';
      return;
    }

    const cleanedTitle = cleanSubmittedValue(title);
    if (!cleanedTitle) {
      status = 'Enter a valid ad title.';
      return;
    }

    const cleanedMediaUrl = cleanSubmittedValue(mediaUrl);
    const hasUploadedZip = pendingFileName.toLowerCase().endsWith('.zip');
    const hasZipAsset = hasUploadedZip || cleanedMediaUrl.toLowerCase().endsWith('.zip');
    if (type === 'html5' && !hasZipAsset) {
      status = 'HTML5 submissions need a .zip upload or .zip media URL.';
      return;
    }

    if (type === 'html5' && isFirebaseConfigured && !pendingFile && !editingAd?.mediaStoragePath) {
      status = 'Upload the HTML5 ZIP file so the backend can extract it.';
      return;
    }

    const currentProfile = get(profile);
    const adValues = {
      title: cleanedTitle,
      category,
      medium,
      tags: cleanSubmittedValue(tags) || 'Submitted',
      size: submitSize,
      userSlug: currentProfile.userSlug,
      userName: cleanSubmittedValue(currentProfile.name),
      userType: cleanSubmittedValue(currentProfile.type),
      mediaUrl: pendingMediaData || cleanedMediaUrl,
      mediaFileName: cleanSubmittedValue(pendingFileName),
      landingUrl: cleanSubmittedValue(landingUrl),
      notes: cleanSubmittedValue(notes),
      type
    };

    try {
      submitting = true;
      if (type === 'html5' && pendingFile) {
        status = 'Uploading and extracting the HTML5 ZIP...';
      }

      if (editingAd) {
        await updateAd(editingAd.id, adValues, pendingFile);
        status = 'Changes saved.';
        setTimeout(handleClose, 700);
        return;
      }

      await submitAd(adValues, pendingFile);
      status = 'Submitted. The ad is now in the archive and your dashboard.';
      setTimeout(() => {
        closeSubmit();
        resetForm();
        goto('/dashboard');
      }, 900);
    } catch (error) {
      status = error?.message || 'The creative file is too large for browser storage. Try a smaller file or use a media URL.';
    } finally {
      submitting = false;
    }
  }

  let lastEditingAdId = undefined;
  let wasSubmitOpen = false;
  $: {
    if ($submitOpen && (!wasSubmitOpen || $submitEditingAdId !== lastEditingAdId)) {
      lastEditingAdId = $submitEditingAdId;
      if (editingAd) populateFromAd(editingAd);
      else resetForm();
    }
    wasSubmitOpen = $submitOpen;
  }
</script>

{#if $submitOpen}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="submit-title">
    <button class="overlay" type="button" aria-label="Close submit form" on:click={handleClose}></button>
    <div class="modal-box">
      <div class="modal-header">
        <div>
          <p class="eyebrow">Submit creative</p>
          <h2 id="submit-title" class="modal-title">{isEditing ? 'Edit ad' : 'Add an ad to the archive'}</h2>
          <p class="muted">
            {isEditing
              ? 'Update the creative details, metadata, or media for this post.'
              : 'Provide enough context for people to understand the creative, source, and format.'}
          </p>
        </div>
        <button class="icon-button" type="button" aria-label="Close submit form" on:click={handleClose}>×</button>
      </div>

      <form class="modal-content form-grid" on:submit|preventDefault={submitForm}>
        <div class="field-grid">
          <section class="form-section">
            <h3>Creative details</h3>
            <div class="field-grid two">
              <label class="field-label" style="grid-column: 1 / -1;">
                Title
                <input bind:value={title} class="field" type="text" required maxlength="80" placeholder="Summer hotel offer" />
              </label>

              <label class="field-label">
                Category
                <select bind:value={category} class="select">
                  {#each categories as item}
                    <option>{item}</option>
                  {/each}
                </select>
              </label>

              <label class="field-label">
                Medium
                <select bind:value={medium} class="select">
                  {#each mediums as item}
                    <option>{item}</option>
                  {/each}
                </select>
              </label>

              <label class="field-label">
                Format
                <select bind:value={type} class="select">
                  {#each adTypes as item}
                    <option value={item.value}>{item.label}</option>
                  {/each}
                </select>
              </label>

              <label class="field-label">
                Size
                <select bind:value={size} class="select">
                  {#each sizes as item}
                    <option>{item}</option>
                  {/each}
                  <option value="custom">Custom</option>
                </select>
              </label>

              {#if size === 'custom'}
                <label class="field-label">
                  Width
                  <input bind:value={customWidth} class="field" type="number" min="1" max="2000" placeholder="300" />
                </label>
                <label class="field-label">
                  Height
                  <input bind:value={customHeight} class="field" type="number" min="1" max="2000" placeholder="250" />
                </label>
              {/if}

              <label class="field-label" style="grid-column: 1 / -1;">
                Tags
                <input bind:value={tags} class="field" type="text" placeholder="Animated, summer, casino" />
              </label>

              <label class="field-label" style="grid-column: 1 / -1;">
                Landing URL
                <input bind:value={landingUrl} class="field" type="url" placeholder="https://example.com/campaign" />
              </label>
            </div>
          </section>

          <section class="form-section">
            <h3>Creative asset</h3>
            <div class="field-grid">
              <label class="field-label">
                Media URL
                <input bind:value={mediaUrl} class="field" type="url" placeholder="https://example.com/ad.jpg" />
              </label>

              <label class="dropzone">
                <span class="dropzone-icon">+</span>
                <strong>Upload image, GIF, video, or HTML5 ZIP</strong>
                <span class="muted">{pendingFileName || fileLimitLabel}</span>
                <input class="hidden-input" type="file" accept="image/*,video/*,.zip,application/zip,application/x-zip-compressed" on:change={handleFile} />
              </label>

              <label class="field-label">
                Notes
                <textarea bind:value={notes} class="textarea" maxlength="280" placeholder="Optional context about the campaign, audience, or creative strategy."></textarea>
              </label>
            </div>
          </section>
        </div>

        <aside class="field-grid">
          <section class="summary-card">
            <h3>Submission summary</h3>
            <dl class="summary-list">
              <div>
                <dt>Posted by</dt>
                <dd>{$profile.name} · {$profile.type}</dd>
              </div>
              <div>
                <dt>Creative</dt>
                <dd>{title.trim() || 'Untitled'} · {medium} · {getAdTypeLabel(type)} · {submitSize}</dd>
              </div>
              <div>
                <dt>Asset</dt>
                <dd>{assetSummary}</dd>
              </div>
            </dl>
          </section>

          <section class="summary-card">
            <h3>Review checklist</h3>
            <div class="field-grid">
              <label class="check-label">
                <input bind:checked={rights} type="checkbox" required />
                <span>I have the right to share this creative in the archive.</span>
              </label>
              <label class="check-label">
                <input bind:checked={transparency} type="checkbox" required />
                <span>The metadata accurately describes the ad format and source.</span>
              </label>
            </div>
          </section>

          {#if status}
            <p class="status">{status}</p>
          {/if}

          <button class="button button-primary" type="submit" disabled={submitting}>
            {submitting ? 'Working...' : isEditing ? 'Save changes' : 'Submit ad'}
          </button>
          <button class="button button-secondary" type="button" disabled={submitting} on:click={resetForm}>
            {isEditing ? 'Reset changes' : 'Reset form'}
          </button>
        </aside>
      </form>
    </div>
  </div>
{/if}
