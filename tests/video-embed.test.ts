import { describe, expect, it } from "vitest";
import { videoEmbedUrl } from "@/lib/markdown/video-embed";

describe("video embed allow-list", () => {
  it("embeds YouTube and Google Drive links", () => {
    expect(videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(videoEmbedUrl("https://drive.google.com/file/d/abcDEF_123/view")).toBe(
      "https://drive.google.com/file/d/abcDEF_123/preview",
    );
  });

  it("leaves other links as plain links", () => {
    expect(videoEmbedUrl("https://vimeo.com/123456")).toBeNull();
    expect(videoEmbedUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(videoEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(videoEmbedUrl("not a url")).toBeNull();
  });
});
