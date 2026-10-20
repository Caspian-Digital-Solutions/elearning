import { CalloutBox } from "@/components/content/callout-box";
import { MarkdownChunk } from "@/components/shared/markdown-chunk";
import { splitCallouts } from "@/lib/content/callouts";

export function MarkdownView({ markdown, nested }: { markdown: string; nested?: boolean }) {
  const segments = splitCallouts(markdown);
  if (segments.length === 1 && segments[0].type === "md") {
    return <MarkdownChunk markdown={markdown} className={nested ? "text-sm" : undefined} />;
  }
  return (
    <div className={nested ? undefined : "max-w-3xl text-sm text-foreground"}>
      {segments.map((segment, index) =>
        segment.type === "callout" ? (
          <CalloutBox key={index} kind={segment.callout.kind} body={segment.callout.body} />
        ) : (
          <MarkdownChunk key={index} markdown={segment.text} className={nested ? "text-sm" : undefined} />
        ),
      )}
    </div>
  );
}
