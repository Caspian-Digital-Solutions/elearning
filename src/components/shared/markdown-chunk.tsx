import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { videoEmbedUrl } from "@/lib/markdown/video-embed";

const components: Components = {
  a: ({ href, children }) => {
    const embed = href ? videoEmbedUrl(href) : null;
    if (embed) {
      return (
        <span className="my-3 block max-w-full">
          <iframe
            src={embed}
            title="Video"
            className="aspect-video w-full max-w-full rounded-lg border border-border"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </span>
      );
    }
    return (
      <a
        href={href}
        className="text-accent-strong underline underline-offset-2"
        rel="noreferrer"
      >
        {children}
      </a>
    );
  },
  p: ({ children }) => <p className="mb-3 leading-6">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal pl-5">{children}</ol>,
  h1: ({ children }) => <h2 className="mt-4 mb-2 text-2xl">{children}</h2>,
  h2: ({ children }) => <h2 className="mt-4 mb-2 text-xl">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-3 mb-2 text-lg">{children}</h3>,
  table: ({ children }) => (
    <div className="my-3 max-w-full overflow-x-auto">
      <table className="w-full min-w-[20rem] border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border bg-surface px-2 py-1 font-medium">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
  img: ({ src, alt }) => {
    const href = typeof src === "string" ? src : undefined;
    if (!href || (!href.startsWith("/content-image/") && !href.startsWith("http"))) {
      return null;
    }
    return (
      <img
        src={href}
        alt={alt ?? ""}
        loading="lazy"
        className="my-3 h-auto max-w-full rounded-lg border border-border"
      />
    );
  },
};

export function MarkdownChunk({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div className={className ?? "max-w-3xl text-sm text-foreground"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
