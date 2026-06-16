<script>
  export let runtimeState = null;
  export let logs = [];
  export let impressionFired = false;
  export let bridgeReady = false;
  export let bridgeInfo = null;

  let open = true;

  $: bridgeApis = Object.entries(bridgeInfo?.apis || {}).filter(([, enabled]) => enabled).map(([name]) => name);
  $: visiblePercent = runtimeState ? `${Math.round(runtimeState.visiblePercent)}%` : '0%';
  $: frameSize = runtimeState ? `${Math.round(runtimeState.adWidth)}x${Math.round(runtimeState.adHeight)}` : '0x0';
  $: viewportSize = runtimeState ? `${runtimeState.viewportWidth}x${runtimeState.viewportHeight}` : '0x0';
  $: visibleSeconds = runtimeState ? `${(runtimeState.visibleTimeMs / 1000).toFixed(1)}s` : '0.0s';
  $: lastUpdate = runtimeState ? new Date(runtimeState.timestamp).toLocaleTimeString() : 'Waiting';
</script>

<aside class="live-debug-panel" class:is-collapsed={!open}>
  <button class="live-debug-toggle" type="button" on:click={() => (open = !open)}>
    <span>Live Preview Debug</span>
    <span>{open ? 'Hide' : 'Show'}</span>
  </button>

  {#if open}
    <div class="live-debug-content">
      <div class="live-debug-grid">
        <div>
          <span>Visible</span>
          <strong>{visiblePercent}</strong>
        </div>
        <div>
          <span>Ad size</span>
          <strong>{frameSize}</strong>
        </div>
        <div>
          <span>Viewport</span>
          <strong>{viewportSize}</strong>
        </div>
        <div>
          <span>Visible time</span>
          <strong>{visibleSeconds}</strong>
        </div>
        <div>
          <span>Impression</span>
          <strong>{impressionFired ? 'Fired' : 'Waiting'}</strong>
        </div>
        <div>
          <span>Bridge</span>
          <strong>{bridgeReady ? 'Ready' : 'Pending'}</strong>
        </div>
      </div>

      <p class="muted">Last update: {lastUpdate}</p>

      {#if !bridgeReady}
        <p class="status">Waiting for the creative runtime bridge. If this stays pending, the preview HTML may not be ready.</p>
      {:else if bridgeApis.length}
        <p class="muted">Bridge APIs: {bridgeApis.join(', ')}</p>
      {/if}

      <div class="live-debug-log">
        <h2>Runtime events</h2>
        {#if logs.length}
          <ul>
            {#each logs as log}
              <li>
                <span>{new Date(log.timestamp || Date.now()).toLocaleTimeString()}</span>
                <strong>{log.api || 'runtime'}{log.method ? `.${log.method}` : ''}</strong>
                <em>{log.message || (log.args ? log.args.join(', ') : 'Event captured')}</em>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="muted">No runtime calls captured yet.</p>
        {/if}
      </div>
    </div>
  {/if}
</aside>
