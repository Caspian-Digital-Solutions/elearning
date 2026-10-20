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
};

export function MarkdownView({ markdown }: { markdown: string }) {
  return (
    <div className="max-w-3xl text-sm text-foreground">
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
