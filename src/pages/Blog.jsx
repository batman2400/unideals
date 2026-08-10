import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "../lib/supabaseClient";
import { SITE_URL } from "../lib/seo";

export default function Blog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("posts")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setPosts(data || []);
    } catch (err) {
      console.error("Error fetching blog posts:", err);
      setError("Failed to load articles. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Student Guides & Tips | Uni Deals Blog</title>
        <meta
          name="description"
          content="Tips, guides, and student life hacks to help Sri Lankan university students make the most of discounts, campus life, and their student budget."
        />
        <link rel="canonical" href={`${SITE_URL}/blog`} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Uni Deals" />
        <meta property="og:title" content="Student Guides & Tips | Uni Deals Blog" />
        <meta
          property="og:description"
          content="Tips, guides, and student life hacks to help Sri Lankan university students make the most of discounts and campus life."
        />
        <meta property="og:url" content={`${SITE_URL}/blog`} />
        <meta property="og:image" content={`${SITE_URL}/icon-512-v7.png`} />
      </Helmet>

      {/* Header */}
      <section className="bg-surface-container-low border-b border-outline-variant/10 py-8 md:py-12 px-4">
        <div className="max-w-6xl mx-auto text-center animate-slide-up flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-primary">newspaper</span>
          </div>
          <h1 className="font-headline font-black text-4xl md:text-5xl text-on-background tracking-tight">
            Uni Deals <span className="text-primary">Blog</span>
          </h1>
          <p className="text-on-surface-variant text-lg max-w-2xl leading-relaxed">
            Tips, guides, and student life hacks to help you make the most of your university experience.
          </p>
        </div>
      </section>

      {/* Content Grid */}
      <section className="pt-8 pb-12 md:pt-10 md:pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          {error && (
            <div className="bg-error/10 text-error px-4 py-3 rounded-xl text-sm font-medium mb-8">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 animate-pulse px-4 sm:px-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex flex-col gap-4">
                  <div className="h-48 w-full bg-surface-container-low rounded-3xl" />
                  <div className="h-6 w-3/4 bg-surface-container-low rounded-lg" />
                  <div className="h-4 w-full bg-surface-container-low rounded-lg" />
                  <div className="h-4 w-5/6 bg-surface-container-low rounded-lg" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-surface-container-low border border-outline-variant/30 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">
                article
              </span>
              <h3 className="text-xl font-headline font-bold text-on-background mb-2">
                No Articles Yet
              </h3>
              <p className="text-on-surface-variant max-w-sm">
                We're currently brewing up some amazing content. Check back soon for the latest student tips!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 px-4 sm:px-6">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  to={`/blog/${post.slug}`}
                  className="group flex flex-col bg-surface border border-outline-variant/20 rounded-3xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all duration-300 animate-fade-in"
                >
                  <div className="relative h-56 overflow-hidden bg-surface-container-low">
                    {post.cover_image_url ? (
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/5">
                        <span className="material-symbols-outlined text-4xl text-primary/20">
                          image
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">
                      <span>{formatDate(post.created_at)}</span>
                      <span className="w-1 h-1 rounded-full bg-outline-variant/50"></span>
                      <span>{post.author_name}</span>
                    </div>
                    
                    <h2 className="font-headline font-bold text-xl text-on-background leading-tight mb-3 group-hover:text-primary transition-colors line-clamp-2">
                      {post.title}
                    </h2>
                    
                    <p className="text-on-surface-variant text-sm leading-relaxed mb-6 line-clamp-3 flex-1">
                      {post.excerpt || "Read more about this article..."}
                    </p>
                    
                    <div className="flex items-center gap-2 text-primary font-bold text-sm mt-auto">
                      Read Article
                      <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                        arrow_forward
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
