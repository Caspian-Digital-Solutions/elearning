const allowedHosts = new Set([
  "drive.google.com",
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
]);

const youtubeId = /^[\w-]{11}$/;

function youtubeEmbed(id: string): string | null {
  if (!youtubeId.test(id)) {
    return null;
  }
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

/**
 * Returns an embed URL for an allowed video host, or null.
 * Anything else should stay a plain link.
 */
export function videoEmbedUrl(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") {
    return null;
  }
  if (!allowedHosts.has(url.hostname)) {
    return null;
  }

  if (url.hostname === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return youtubeEmbed(id);
  }

  if (url.hostname === "youtube.com" || url.hostname === "www.youtube.com") {
    if (url.pathname === "/watch") {
      return youtubeEmbed(url.searchParams.get("v") ?? "");
    }
    if (url.pathname.startsWith("/embed/")) {
      return youtubeEmbed(url.pathname.split("/")[2] ?? "");
    }
    return null;
  }

  const drive = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
  if (!drive) {
    return null;
  }
  return `https://drive.google.com/file/d/${drive[1]}/preview`;
}
