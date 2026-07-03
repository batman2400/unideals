import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
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
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-3xl mx-auto px-4 animate-pulse">
          <div className="h-6 w-32 bg-surface-container-low rounded-lg mb-8" />
          <div className="w-full h-64 md:h-96 bg-surface-container-low rounded-3xl mb-8" />
          <div className="h-10 w-3/4 bg-surface-container-low rounded-xl mb-4" />
          <div className="h-6 w-1/4 bg-surface-container-low rounded-lg mb-12" />
          <div className="space-y-4">
            <div className="h-4 w-full bg-surface-container-low rounded" />
            <div className="h-4 w-full bg-surface-container-low rounded" />
            <div className="h-4 w-5/6 bg-surface-container-low rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
        <span className="material-symbols-outlined text-6xl text-error mb-4">error</span>
        <h1 className="text-2xl font-headline font-black text-on-background mb-2">Article Not Found</h1>
        <p className="text-on-surface-variant mb-6">{error}</p>
        <Link
          to="/blog"
          className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 transition-opacity"
        >
          Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <article className="animate-fade-in">
        {/* Cover Image Header */}
        <div className="w-full h-56 sm:h-80 md:h-96 relative bg-surface-container-low">
          {post.cover_image_url ? (
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/5">
              <span className="material-symbols-outlined text-6xl text-primary/20">image</span>
            </div>
          )}
          {/* Dark gradient overlay for back button contrast */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent pointer-events-none" />
          
          <div className="absolute top-6 left-4 md:left-8 z-10 pointer-events-auto">
            <Link
              to="/blog"
              className="flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-full font-bold text-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Blog
            </Link>
          </div>
        </div>

        {/* Article Content Container */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 -mt-16 md:-mt-24 relative z-20">
          <div className="bg-surface border border-outline-variant/10 rounded-3xl p-6 md:p-10 shadow-lg mb-12">
            
            {/* Header / Meta */}
            <header className="mb-8 border-b border-outline-variant/10 pb-8 text-center md:text-left">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-headline font-black text-on-background leading-tight mb-4">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-bold text-on-surface-variant tracking-wide">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[18px]">edit_note</span>
                  {post.author_name}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-outline-variant/50"></span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                  {formatDate(post.created_at)}
                </span>
              </div>
            </header>

            {/* Prose Content */}
            <div className="prose prose-sm sm:prose lg:prose-lg dark:prose-invert prose-headings:font-headline prose-headings:font-black prose-a:text-primary hover:prose-a:text-primary/80 prose-img:rounded-2xl max-w-none text-on-background/90 leading-relaxed space-y-6 whitespace-pre-wrap">
              {post.content}
            </div>

          </div>

          {/* Footer Back Button */}
          <div className="flex justify-center">
            <Link
              to="/blog"
              className="flex items-center gap-2 px-6 py-3 bg-surface-container-low hover:bg-surface-container text-on-background rounded-full font-bold transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              More Articles
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
