import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { supabase } from "../lib/supabaseClient";

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPost();
  }, [slug]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from("posts")
        .select("*")
        .eq("slug", slug)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Post not found");
      
      setPost(data);
    } catch (err) {
      console.error("Error fetching blog post:", err);
      setError("This article could not be found or has been removed.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 py-12">
        <div className="max-w-3xl mx-auto px-4 animate-pulse">
          <div className="h-6 w-32 bg-slate-200 rounded-lg mb-8" />
          <div className="h-10 w-3/4 bg-slate-200 rounded-xl mb-4" />
          <div className="h-6 w-1/4 bg-slate-200 rounded-lg mb-12" />
          <div className="w-full h-64 md:h-96 bg-slate-200 rounded-3xl mb-8" />
          <div className="space-y-4">
            <div className="h-4 w-full bg-slate-200 rounded" />
            <div className="h-4 w-full bg-slate-200 rounded" />
            <div className="h-4 w-5/6 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
        <span className="material-symbols-outlined text-6xl text-error mb-4">error</span>
        <h1 className="text-2xl font-headline font-black text-slate-900 mb-2">Article Not Found</h1>
        <p className="text-slate-600 mb-6">{error}</p>
        <Link
          to="/blog"
          className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
        >
          Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <article className="animate-fade-in">
        
        {/* Top Navigation Bar */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-4">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Blog
          </Link>
        </div>

        {/* Article Header Zone */}
        <header className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-6">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 mb-4 tracking-wide uppercase">
            Student Guides
          </span>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight my-4 font-headline">
            {post.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px] text-slate-500">person</span>
              </div>
              <span className="font-semibold text-slate-800">{post.author_name || "Uni Deals Team"}</span>
            </div>
            <span className="text-slate-300">•</span>
            <span>{formatDate(post.created_at)}</span>
            <span className="text-slate-300">•</span>
            <span>3 min read</span>
          </div>
        </header>

        {/* Hero Image Display */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 my-6 md:my-8">
          {post.cover_image_url ? (
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full h-[280px] sm:h-[400px] md:h-[500px] object-cover rounded-2xl shadow-md border border-slate-100"
            />
          ) : (
            <div className="w-full h-[280px] sm:h-[400px] md:h-[500px] rounded-2xl shadow-md border border-slate-100 bg-slate-200 flex flex-col items-center justify-center text-slate-400">
              <span className="material-symbols-outlined text-6xl mb-2">image</span>
              <span className="text-sm font-medium">No cover image available</span>
            </div>
          )}
        </div>

        {/* Article Body (Typography Zone) */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 md:py-10">
          <ReactMarkdown 
            className="prose prose-lg md:prose-xl max-w-none text-slate-700" 
            components={{
              h1: ({ node, ...props }) => <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-8 mb-4 tracking-tight" {...props} />,
              h2: ({ node, ...props }) => <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-8 mb-4 border-b border-slate-200 pb-2" {...props} />,
              h3: ({ node, ...props }) => <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-6 mb-3" {...props} />,
              h4: ({ node, ...props }) => <h4 className="text-lg sm:text-xl font-semibold text-slate-800 mt-4 mb-2" {...props} />,
              p: ({ node, ...props }) => <p className="text-base sm:text-lg leading-relaxed text-slate-700 my-4" {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc list-outside pl-6 space-y-2 my-4 text-slate-700" {...props} />,
              ol: ({ node, ...props }) => <ol className="list-decimal list-outside pl-6 space-y-2 my-4 text-slate-700" {...props} />,
              li: ({ node, ...props }) => <li className="text-base sm:text-lg leading-relaxed pl-1" {...props} />,
              strong: ({ node, ...props }) => <strong className="font-semibold text-slate-900" {...props} />,
              a: ({ node, ...props }) => <a className="text-emerald-600 font-medium hover:underline transition-colors" {...props} />,
              blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-emerald-500 pl-4 py-1 my-6 italic bg-slate-50 text-slate-600 rounded-r" {...props} />,
            }}
          >
            {post.content}
          </ReactMarkdown>

          {/* Article Footer */}
          <footer className="mt-16">
            <hr className="my-10 border-slate-200" />
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <Link
                to="/blog"
                className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold transition-colors w-full sm:w-auto justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                Back to All Articles
              </Link>
              
              <Link
                to="/"
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg hover:opacity-95 transition-all w-full sm:w-auto justify-center"
              >
                Explore All Student Deals
                <span className="material-symbols-outlined text-[20px]">explore</span>
              </Link>
            </div>
          </footer>
        </div>

      </article>
    </div>
  );
}
