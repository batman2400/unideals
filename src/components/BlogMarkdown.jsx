import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import DealCard from "./DealCard";
import { extractDealEmbedIds, splitBlogContent } from "../lib/blogContent";
import { usePublicDealsByIds } from "../lib/useDeals";

const markdownComponents = {
  h1: ({ node: _node, ...props }) => (
    <h1
      className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-8 mb-4 tracking-tight"
      {...props}
    />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2
      className="text-2xl sm:text-3xl font-bold text-slate-900 mt-8 mb-4 border-b border-slate-200 pb-2"
      {...props}
    />
  ),
  h3: ({ node: _node, ...props }) => (
    <h3
      className="text-xl sm:text-2xl font-bold text-slate-900 mt-6 mb-3"
      {...props}
    />
  ),
  h4: ({ node: _node, ...props }) => (
    <h4
      className="text-lg sm:text-xl font-semibold text-slate-800 mt-4 mb-2"
      {...props}
    />
  ),
  p: ({ node: _node, ...props }) => (
    <p className="text-base sm:text-lg leading-relaxed text-slate-700 my-4" {...props} />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul className="list-disc list-outside pl-6 space-y-2 my-4 text-slate-700" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="list-decimal list-outside pl-6 space-y-2 my-4 text-slate-700" {...props} />
  ),
  li: ({ node: _node, ...props }) => (
    <li className="text-base sm:text-lg leading-relaxed pl-1" {...props} />
  ),
  strong: ({ node: _node, ...props }) => (
    <strong className="font-semibold text-slate-900" {...props} />
  ),
  a: ({ node: _node, ...props }) => (
    <a className="text-emerald-600 font-medium hover:underline transition-colors" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="border-l-4 border-emerald-500 pl-4 py-1 my-6 italic bg-slate-50 text-slate-600 rounded-r"
      {...props}
    />
  ),
};

function MarkdownChunk({ text }) {
  if (!text?.trim()) return null;
  return (
    <div className="prose prose-lg md:prose-xl max-w-none text-slate-700">
      <ReactMarkdown components={markdownComponents}>{text}</ReactMarkdown>
    </div>
  );
}

function DealEmbed({ deal, loading }) {
  if (loading && !deal) {
    return (
      <div className="not-prose my-8 max-w-xs animate-pulse sm:max-w-sm">
        <div className="aspect-square rounded-2xl bg-slate-200" />
        <div className="mt-2.5 h-3 w-1/3 rounded bg-slate-200" />
        <div className="mt-2 h-4 w-2/3 rounded bg-slate-200" />
      </div>
    );
  }
  if (!deal) return null;
  return (
    <div className="not-prose my-8 max-w-xs sm:max-w-sm">
      <DealCard deal={deal} />
    </div>
  );
}

export default function BlogMarkdown({ content }) {
  const parts = useMemo(() => splitBlogContent(content), [content]);
  const embedIds = useMemo(() => extractDealEmbedIds(content), [content]);
  const { dealsById, loading } = usePublicDealsByIds(embedIds);

  return (
    <>
      {parts.map((part, index) =>
        part.type === "deal" ? (
          <DealEmbed
            key={`deal-${part.id}-${index}`}
            deal={dealsById[part.id]}
            loading={loading}
          />
        ) : (
          <MarkdownChunk key={`md-${index}`} text={part.text} />
        ),
      )}
    </>
  );
}
