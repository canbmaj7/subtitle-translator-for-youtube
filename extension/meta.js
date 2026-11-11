// Videonun başlığı, kanalı ve kısa açıklaması: yapay zekâ motorlarına çeviri bağlamı olarak gider.
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});

  function getVideoTitle(videoId) {
    const docTitle = (document.title || '').replace(/^\(\d+\)\s*/, '').replace(/\s*-\s*YouTube\s*$/i, '').trim();
    const n = document.querySelector('#movie_player .ytp-title-link, h1.ytd-watch-metadata yt-formatted-string');
    const domTitle = (n && n.textContent && n.textContent.trim()) || '';
    if (domTitle && docTitle) {
      const d1 = domTitle.toLowerCase();
      const d2 = docTitle.toLowerCase();
      // YouTube SPA gezinmesinden sonra DOM bayat kalabilir: belge başlığına güven
      if (d1 !== d2 && !d2.includes(d1) && !d1.includes(d2)) return docTitle;
      return domTitle;
    }
    return domTitle || docTitle || videoId || 'video';
  }

  function getVideoMeta(videoId) {
    let title = getVideoTitle(videoId);
    if (title === videoId || title === 'video') title = '';
    const text = (n) => (n && n.textContent && n.textContent.trim()) || '';
    let channel = '';
    try {
      channel = text(document.querySelector('ytd-video-owner-renderer #channel-name a, #owner #channel-name a'));
      if (!channel) {
        const link = document.querySelector('link[itemprop="name"]');
        channel = ((link && (link.getAttribute('content') || link.textContent)) || '').trim();
      }
    } catch (_) {}
    let description = '';
    try {
      const meta = document.querySelector('meta[property="og:description"]');
      description = ((meta && meta.getAttribute('content')) || '').trim();
      if (!description) description = text(document.querySelector('#description-inner'));
      description = description.slice(0, 400);
    } catch (_) {}
    return { title, channel, description };
  }

  ns.getVideoTitle = getVideoTitle;
  ns.getVideoMeta = getVideoMeta;
})();
