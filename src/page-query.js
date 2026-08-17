// Read workbench routing keys from the URL.
// Search is the writer (`?preset=coral-reef&mode=watch`). Hash keys
// (`#preset=`) are a read-only fallback for old links and hosts that
// 301 `.html` to a clean path and drop the query. `#s=` is a share token,
// not a query string — never parse it as one.

export function pageQuery(loc = location) {
  const search = new URLSearchParams(loc.search || '');
  const raw = String(loc.hash || '').replace(/^#/, '');
  const fromHash = (raw && !raw.startsWith('s=') && raw.includes('='))
    ? new URLSearchParams(raw)
    : new URLSearchParams();
  return {
    get(key) {
      return search.get(key) || fromHash.get(key);
    },
  };
}
