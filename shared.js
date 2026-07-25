/**
 * Shared utilities — used by popup.js, options.js, and background.js
 * Keep this file in sync across all three environments.
 */

function normalizeTagList(value) {
  const rawTags = Array.isArray(value)
    ? value
    : String(value || '').split(/[\s,，]+/);

  const seen = new Set();
  return rawTags
    .map(tag => String(tag).trim())
    .filter(Boolean)
    .filter(tag => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeServers(list) {
  return (Array.isArray(list) ? list : []).map(server => ({
    id: server.id || 'server_' + Math.random().toString(36).substr(2, 9),
    name: server.name || 'Default Server',
    apiUrl: (server.apiUrl || '').trim(),
    apiKey: (server.apiKey || '').trim(),
    apiHash: (server.apiHash || '').trim(),
    panel_type: server.panel_type || 'solusvm',
    tags: normalizeTagList(server.tags)
  }));
}

function getAllTagsFromServers(list) {
  const seen = new Map();
  list.forEach(server => {
    normalizeTagList(server.tags).forEach(tag => {
      const key = tag.toLowerCase();
      if (!seen.has(key)) seen.set(key, tag);
    });
  });
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}
