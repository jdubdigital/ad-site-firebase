<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import FileArchive from '@lucide/svelte/icons/file-archive';
  import UploadCloud from '@lucide/svelte/icons/upload-cloud';
  import { get } from 'svelte/store';
  import { categories, mediums, sizes } from '$lib/data/catalog';
  import { isFirebaseConfigured } from '$lib/firebase/client';
  import { authReady, signedInEmail } from '$lib/stores/account';
  import { ads, submitAd, updateAd } from '$lib/stores/archive';
  import { profile } from '$lib/stores/profile';
  import { openLogin } from '$lib/stores/ui';
  import { cleanSubmittedValue, getAdTypeLabel, getMediumLabel } from '$lib/utils/ad-utils';
  import { analyzeCreativeFile } from '$lib/utils/creative-analysis';

  const localMaxFileSize = 2500000;
  const firebaseMaxFileSize = 10 * 1024 * 1024;

  let pendingFile = null;
  let pendingMediaData = '';
  let analysis = null;
  let analyzing = false;
  let title = '';
  let category = 'Retail';
  let medium = 'Web';
  let tags = '';
  let notes = '';
  let rights = false;
  let transparency = false;
  let zipMode = 'all';
  let selectedZipSize = '300x250';
  let manualSize = '300x250';
  let customWidth = '';
  let customHeight = '';
  let status = '';
  let submitting = false;
  let submitProgress = 0;
  let submitPhase = '';
  let lastEditId = undefined;

  $: editId = $page.url.searchParams.get('edit');
  $: editingAd = editId ? $ads.find((ad) => String(ad.id) === String(editId)) : null;
  $: isEditing = Boolean(editingAd);
  $: detectedSizes = analysis?.sizes || [];
  $: isProgrammatic = analysis?.type === 'html5';
  $: resolvedManualSize =
    manualSize === 'custom' ? (customWidth && customHeight ? `${Number(customWidth)}x${Number(customHeight)}` : '') : manualSize;
  $: selectedSizes = resolveSelectedSizes();
  $: activeSizeLabel = selectedSizes.length > 1 ? `${selectedSizes.length} sizes` : selectedSizes[0] || 'Unknown size';
  $: fileLimitLabel = isFirebaseConfigured ? 'Max 10 MB' : 'Max 2.5 MB for local browser storage';

  $: if (browser && $authReady && !$signedInEmail) {
    openLogin('signin');
    goto('/');
  }

  $: if (browser && $authReady && $signedInEmail && editId !== lastEditId) {
    lastEditId = editId;
    if (editingAd) populateFromAd(editingAd);
    else if (editId) status = 'This post could not be found.';
    else resetForm();
  }

  function resolveSelectedSizes() {
    if (!analysis) return [];
    if (!isProgrammatic) return [analysis.size].filter(Boolean);
    if (!detectedSizes.length) return [resolvedManualSize].filter(Boolean);
    if (detectedSizes.length > 1 && zipMode === 'all') return detectedSizes;
    return [selectedZipSize || resolvedManualSize].filter(Boolean);
  }

  function populateFromAd(ad) {
    pendingFile = null;
    pendingMediaData = ad.mediaUrl || '';
    analysis = {
      type: ad.type || 'image',
      label: getAdTypeLabel(ad.type),
      size: ad.size || '300x250',
      sizes: [ad.size || '300x250'],
      fileName: ad.mediaFileName || 'Current uploaded asset',
      title: ad.title || ''
    };
    title = ad.title || '';
    category = ad.category || 'Retail';
    medium = ad.medium || 'Web';
    tags = ad.tags || '';
    notes = ad.notes || '';
    rights = true;
    transparency = true;
    selectedZipSize = ad.size || '300x250';
    manualSize = sizes.includes(ad.size) ? ad.size : 'custom';
    if (!sizes.includes(ad.size || '')) {
      const [width, height] = String(ad.size || '').split('x');
      customWidth = width || '';
      customHeight = height || '';
    }
    status = '';
  }

  function resetForm() {
    pendingFile = null;
    pendingMediaData = '';
    analysis = null;
    analyzing = false;
    title = '';
    category = 'Retail';
    medium = 'Web';
    tags = '';
    notes = '';
    rights = false;
    transparency = false;
    zipMode = 'all';
    selectedZipSize = '300x250';
    manualSize = '300x250';
    customWidth = '';
    customHeight = '';
    status = '';
    submitProgress = 0;
    submitPhase = '';
  }

  function readDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(String(reader.result || '')));
      reader.addEventListener('error', () => reject(new Error('Unable to read the creative asset.')));
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    const maxFileSize = isFirebaseConfigured ? firebaseMaxFileSize : localMaxFileSize;
    status = '';
    pendingFile = null;
    pendingMediaData = '';
    analysis = null;

    if (file.size > maxFileSize) {
      status = isFirebaseConfigured ? 'Choose a file under 10 MB.' : 'Choose a file under 2.5 MB for local browser storage.';
      event.currentTarget.value = '';
      return;
    }

    try {
      analyzing = true;
      const nextAnalysis = await analyzeCreativeFile(file);
      pendingFile = file;
      analysis = nextAnalysis;
      title = title || nextAnalysis.title || '';

      if (nextAnalysis.type !== 'html5') {
        pendingMediaData = await readDataUrl(file);
      }

      if (nextAnalysis.type === 'html5') {
        if (!isFirebaseConfigured) {
          status = 'Programmatic ZIP extraction needs Firebase persistence.';
        }
        zipMode = nextAnalysis.sizes.length > 1 ? 'all' : 'single';
        selectedZipSize = nextAnalysis.sizes[0] || selectedZipSize;
      }
    } catch (error) {
      status = error?.message || 'Unable to inspect this creative asset.';
      event.currentTarget.value = '';
    } finally {
      analyzing = false;
    }
  }

  function progressForItem(itemIndex, totalItems, event) {
    const progress = Math.max(0, Math.min(1, Number(event?.progress) || 0));
    const ranges = {
      prepare: [0.06, 0.16],
      upload: [0.16, 0.68],
      save: [0.68, 0.84],
      extract: [0.84, 0.96],
      done: [1, 1]
    };
    const labels = {
      prepare: 'Preparing creative',
      upload: 'Uploading asset',
      save: 'Saving ad details',
      extract: 'Extracting programmatic preview',
      done: 'Done'
    };
    const [start, end] = ranges[event?.stage || 'prepare'] || ranges.prepare;
    const itemProgress = start + (end - start) * progress;
    const overall = (itemIndex + itemProgress) / Math.max(1, totalItems);

    submitProgress = Math.round(overall * 100);
    submitPhase =
      totalItems > 1
        ? `${labels[event?.stage] || 'Working'} (${itemIndex + 1} of ${totalItems})`
        : event?.message || labels[event?.stage] || 'Working';
  }

  function createAdValues(sizeValue, sharedAsset = {}) {
    const currentProfile = get(profile);
    const existingAsset = editingAd || {};

    return {
      title: cleanSubmittedValue(title),
      category,
      medium,
      tags: cleanSubmittedValue(tags) || 'Submitted',
      size: sizeValue,
      userSlug: currentProfile.userSlug,
      userName: cleanSubmittedValue(currentProfile.name),
      userType: cleanSubmittedValue(currentProfile.type),
      mediaUrl: isProgrammatic ? '' : pendingMediaData || existingAsset.mediaUrl || '',
      mediaStoragePath: sharedAsset.mediaStoragePath || existingAsset.mediaStoragePath || '',
      mediaContentType: sharedAsset.mediaContentType || existingAsset.mediaContentType || '',
      mediaFileName: cleanSubmittedValue(
        analysis?.fileName || pendingFile?.name || sharedAsset.mediaFileName || existingAsset.mediaFileName || ''
      ),
      notes: cleanSubmittedValue(notes),
      type: analysis.type
    };
  }

  async function submitForm() {
    if (submitting) return;
    status = '';
    submitProgress = 0;
    submitPhase = '';

    if (!analysis) {
      status = 'Upload a creative asset first.';
      return;
    }

    if (!cleanSubmittedValue(title)) {
      status = 'Enter a valid title.';
      return;
    }

    if (!selectedSizes.length) {
      status = 'Choose a size for this creative.';
      return;
    }

    if (isProgrammatic && !isFirebaseConfigured) {
      status = 'Programmatic ZIP extraction needs Firebase persistence.';
      return;
    }

    if (!rights || !transparency) {
      status = 'Confirm the review checklist before submitting.';
      return;
    }

    try {
      submitting = true;

      if (isEditing) {
        progressForItem(0, 1, { stage: 'prepare', progress: 0.2 });
        await updateAd(editingAd.id, createAdValues(selectedSizes[0]), pendingFile, {
          onProgress: (event) => progressForItem(0, 1, event)
        });
        progressForItem(0, 1, { stage: 'done', progress: 1 });
        status = 'Changes saved.';
        setTimeout(() => goto('/dashboard'), 700);
        return;
      }

      const totalItems = selectedSizes.length;
      const createdAds = [];
      let sharedAsset = {};

      for (let index = 0; index < selectedSizes.length; index += 1) {
        const fileForRecord = index === 0 ? pendingFile : null;
        const ad = await submitAd(createAdValues(selectedSizes[index], sharedAsset), fileForRecord, {
          onProgress: (event) => progressForItem(index, totalItems, event)
        });

        createdAds.push(ad);
        if (index === 0) {
          sharedAsset = {
            mediaStoragePath: ad.mediaStoragePath || '',
            mediaContentType: ad.mediaContentType || '',
            mediaFileName: ad.mediaFileName || analysis?.fileName || ''
          };
        }
      }

      progressForItem(totalItems - 1, totalItems, { stage: 'done', progress: 1 });
      status =
        createdAds.length > 1
          ? `Submitted ${createdAds.length} creative sizes to the archive.`
          : 'Submitted. The creative is now in the archive and your dashboard.';
      setTimeout(() => goto('/dashboard'), 900);
    } catch (error) {
      submitProgress = 0;
      submitPhase = '';
      status = error?.message || 'Unable to submit this creative.';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>{isEditing ? 'Edit Creative' : 'Submit'} · Ad Archive</title>
</svelte:head>

<section class="submit-page">
  <div class="container">
    <div class="submit-heading">
      <div>
        <p class="eyebrow">Creative intake</p>
        <h1>{isEditing ? 'Edit creative' : 'Add to the archive'}</h1>
        <p class="muted">Start with the asset. Ad Archive detects the format and size, then asks for the metadata people actually need.</p>
      </div>
      <a class="button button-secondary" href="/dashboard">Back to dashboard</a>
    </div>

    <form class="submit-wizard" on:submit|preventDefault={submitForm}>
      <section class="submit-step" class:is-complete={analysis}>
        <div class="step-marker">
          {#if analysis}
            <CheckCircle2 size={20} strokeWidth={2.3} aria-hidden="true" />
          {:else}
            1
          {/if}
        </div>
        <div class="submit-step-body">
          <p class="section-label">Step 1</p>
          <h2>Upload creative asset</h2>
          <label class="dropzone upload-first-zone">
            <UploadCloud size={28} strokeWidth={2.15} aria-hidden="true" />
            <strong>{analysis ? analysis.fileName : 'Upload image, GIF, video, or programmatic ZIP'}</strong>
            <span class="muted">{analyzing ? 'Inspecting asset...' : fileLimitLabel}</span>
            <input
              class="hidden-input"
              type="file"
              accept="image/*,video/*,.zip,application/zip,application/x-zip-compressed"
              disabled={submitting}
              on:change={handleFile}
            />
          </label>
        </div>
      </section>

      {#if analysis}
        <section class="submit-step is-complete">
          <div class="step-marker">
            <CheckCircle2 size={20} strokeWidth={2.3} aria-hidden="true" />
          </div>
          <div class="submit-step-body">
            <p class="section-label">Step 2</p>
            <h2>Review detected details</h2>
            <div class="detected-panel">
              <div>
                <span class="detected-label">Format</span>
                <strong>{analysis.label}</strong>
              </div>
              <div>
                <span class="detected-label">Size</span>
                <strong>{activeSizeLabel}</strong>
              </div>
              <div>
                <span class="detected-label">Asset</span>
                <strong>{analysis.fileName}</strong>
              </div>
            </div>

            {#if isProgrammatic}
              <div class="programmatic-options">
                <div>
                  <FileArchive size={21} strokeWidth={2.2} aria-hidden="true" />
                  <p>{analysis.note}</p>
                </div>

                {#if detectedSizes.length > 1}
                  <div class="segmented-control">
                    <button class:active={zipMode === 'all'} type="button" on:click={() => (zipMode = 'all')}>Upload all sizes</button>
                    <button class:active={zipMode === 'single'} type="button" on:click={() => (zipMode = 'single')}>One size</button>
                  </div>
                {/if}

                {#if zipMode === 'single' || detectedSizes.length <= 1}
                  {#if detectedSizes.length}
                    <label class="field-label">
                      Size to submit
                      <select bind:value={selectedZipSize} class="select">
                        {#each detectedSizes as item}
                          <option>{item}</option>
                        {/each}
                      </select>
                    </label>
                  {:else}
                    <div class="field-grid two">
                      <label class="field-label">
                        Size
                        <select bind:value={manualSize} class="select">
                          {#each sizes as item}
                            <option>{item}</option>
                          {/each}
                          <option value="custom">Custom</option>
                        </select>
                      </label>
                      {#if manualSize === 'custom'}
                        <label class="field-label">
                          Width
                          <input bind:value={customWidth} class="field" type="number" min="1" max="4000" placeholder="300" />
                        </label>
                        <label class="field-label">
                          Height
                          <input bind:value={customHeight} class="field" type="number" min="1" max="4000" placeholder="250" />
                        </label>
                      {/if}
                    </div>
                  {/if}
                {/if}
              </div>
            {/if}
          </div>
        </section>

        <section class="submit-step">
          <div class="step-marker">3</div>
          <div class="submit-step-body">
            <p class="section-label">Step 3</p>
            <h2>Add archive metadata</h2>
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
                    <option value={item}>{getMediumLabel(item)}</option>
                  {/each}
                </select>
              </label>

              <label class="field-label" style="grid-column: 1 / -1;">
                Tags
                <input bind:value={tags} class="field" type="text" placeholder="Animated, summer, casino" />
              </label>

              <label class="field-label" style="grid-column: 1 / -1;">
                Notes
                <textarea bind:value={notes} class="textarea" maxlength="280" placeholder="Optional context about the campaign, audience, or creative strategy."></textarea>
              </label>
            </div>

            <div class="review-strip">
              <label class="check-label">
                <input bind:checked={rights} type="checkbox" required />
                <span>I have the right to share this creative in the archive.</span>
              </label>
              <label class="check-label">
                <input bind:checked={transparency} type="checkbox" required />
                <span>The metadata accurately describes the ad format and source.</span>
              </label>
            </div>
          </div>
        </section>
      {/if}

      <aside class="submit-sidebar">
        <section class="summary-card">
          <h3>Submission summary</h3>
          <dl class="summary-list">
            <div>
              <dt>Posted by</dt>
              <dd>{$profile.username || $profile.userSlug} · {$profile.type}</dd>
            </div>
            <div>
              <dt>Creative</dt>
              <dd>{title.trim() || 'Untitled'} · {analysis ? analysis.label : 'No asset'} · {activeSizeLabel}</dd>
            </div>
            <div>
              <dt>Records</dt>
              <dd>{selectedSizes.length || 0} {selectedSizes.length === 1 ? 'record' : 'records'}</dd>
            </div>
          </dl>
        </section>

        {#if status}
          <p class="status">{status}</p>
        {/if}

        {#if submitting}
          <div class="submit-progress" role="status" aria-live="polite">
            <div class="submit-progress-header">
              <span>{submitPhase || 'Submitting creative'}</span>
              <span>{submitProgress}%</span>
            </div>
            <div class="progress-track" aria-hidden="true">
              <span class="progress-fill" style={`width: ${submitProgress}%;`}></span>
            </div>
          </div>
        {/if}

        <button class="button button-primary" type="submit" disabled={!analysis || submitting || analyzing}>
          {submitting ? 'Submitting...' : isEditing ? 'Save changes' : selectedSizes.length > 1 ? 'Submit records' : 'Submit'}
        </button>
        <button class="button button-secondary" type="button" disabled={submitting} on:click={isEditing && editingAd ? () => populateFromAd(editingAd) : resetForm}>
          {isEditing ? 'Reset changes' : 'Reset'}
        </button>
      </aside>
    </form>
  </div>
</section>
