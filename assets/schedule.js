<script defer src="assets/schedule.js?v=6"></script>
<script>
  // Render after DOM is parsed
  window.addEventListener('DOMContentLoaded', () => {
    // Try root first, then /assets as fallback (handles either placement)
    const tryPaths = async () => {
      const paths = ['schedule.json', 'assets/schedule.json'];
      for (const p of paths) {
        try { await renderScheduleSummary('schedule-today', p); return; }
        catch(e){ console.warn('[schedule] failed path', p, e); }
      }
      const el = document.getElementById('schedule-today');
      if (el) el.innerHTML = '<div class="muted">Could not load schedule.json. See console.</div>';
    };
    tryPaths();
  });
</script>
