import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminBlog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    cover_image_url: "",
    is_published: false,
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setPosts(data || []);
    } catch (err) {
      console.error("Error fetching posts:", err);
      setError("Failed to load blog posts.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to auto-generate slug from title
  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  };

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setFormData((prev) => ({
      ...prev,
      title: newTitle,
      slug: generateSlug(newTitle),
    }));
  };

  const handleTogglePublish = async (post) => {
    try {
      const { error: updateError } = await supabase
        .from("posts")
        .update({ is_published: !post.is_published })
        .eq("id", post.id);

      if (updateError) throw updateError;
      
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, is_published: !post.is_published } : p
        )
      );
    } catch (err) {
      console.error("Error toggling publish status:", err);
      alert("Failed to update status.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this article? This action cannot be undone.")) return;

    try {
      const { error: deleteError } = await supabase
        .from("posts")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Error deleting post:", err);
      alert("Failed to delete post.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { data, error: insertError } = await supabase
        .from("posts")
        .insert([formData])
        .select()
        .single();

      if (insertError) throw insertError;

      setPosts([data, ...posts]);
      setIsModalOpen(false);
      setFormData({
        title: "",
        slug: "",
        excerpt: "",
        content: "",
        cover_image_url: "",
        is_published: false,
      });
    } catch (err) {
      console.error("Error creating post:", err);
      alert(err.message || "Failed to create post. Please ensure the slug is unique.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-headline font-black text-on-background">
            Blog Manager
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Create, edit, and publish articles for the Uni Deals blog.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="h-12 px-6 bg-primary text-on-primary font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          New Article
        </button>
      </div>

      {error && (
        <div className="bg-error/10 text-error px-4 py-3 rounded-xl text-sm font-medium mb-6">
          {error}
        </div>
      )}

      {/* Posts Table */}
      <div className="w-full overflow-x-auto shadow-sm rounded-lg bg-surface border border-outline-variant/20">
        <table className="min-w-full divide-y divide-outline-variant/10 text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container-low/50">
                <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider w-16">Cover</th>
                <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Title & Slug</th>
                <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-on-surface-variant">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading posts...
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/50 mb-3">post_add</span>
                    <p className="text-on-surface-variant font-medium">No posts found. Create your first article!</p>
                  </td>
                </tr>
              ) : (
                posts.map((post) => (
                  <tr key={post.id} className="hover:bg-surface-container-low/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="w-12 h-12 rounded-lg bg-surface-container overflow-hidden flex items-center justify-center shrink-0">
                        {post.cover_image_url ? (
                          <img src={post.cover_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-on-surface-variant/40">image</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-on-background line-clamp-1">{post.title}</p>
                      <p className="text-xs text-on-surface-variant line-clamp-1">/{post.slug}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant font-medium">
                      {formatDate(post.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleTogglePublish(post)}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors ${
                          post.is_published 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20" 
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {post.is_published ? "Published" : "Draft"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                        title="Delete Post"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
      </div>

      {/* New Article Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-outline-variant/20 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden animate-slide-up">
            
            <div className="px-6 py-5 border-b border-outline-variant/10 flex items-center justify-between bg-surface shrink-0">
              <h2 className="text-xl font-headline font-black text-on-background">Create New Article</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <form id="new-post-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Title */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-on-background">Title <span className="text-error">*</span></label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={handleTitleChange}
                      placeholder="E.g. Top 10 Student Discounts"
                      className="w-full h-12 bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 text-on-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>

                  {/* Slug (Auto-generated but editable) */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-on-background flex justify-between">
                      <span>URL Slug <span className="text-error">*</span></span>
                      <span className="text-xs text-on-surface-variant font-normal">Auto-generated</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) => setFormData({...formData, slug: generateSlug(e.target.value)})}
                      placeholder="top-10-student-discounts"
                      className="w-full h-12 bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 text-on-surface-variant font-mono text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Excerpt */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-on-background">Short Excerpt</label>
                  <input
                    type="text"
                    value={formData.excerpt}
                    onChange={(e) => setFormData({...formData, excerpt: e.target.value})}
                    placeholder="A brief summary for the blog grid card..."
                    className="w-full h-12 bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 text-on-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>

                {/* Cover Image */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-on-background">Cover Image URL</label>
                  <input
                    type="url"
                    value={formData.cover_image_url}
                    onChange={(e) => setFormData({...formData, cover_image_url: e.target.value})}
                    placeholder="https://example.com/image.jpg"
                    className="w-full h-12 bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 text-on-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>

                {/* Content */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-on-background flex justify-between">
                    <span>Article Content <span className="text-error">*</span></span>
                    <span className="text-xs text-on-surface-variant font-normal">Markdown supported</span>
                  </label>
                  <textarea
                    required
                    rows={10}
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    placeholder="Write your article content here..."
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 text-on-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-y font-mono text-sm"
                  />
                </div>

                {/* Publish Toggle */}
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-surface-container-low border border-outline-variant/20 rounded-xl">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_published}
                      onChange={(e) => setFormData({...formData, is_published: e.target.checked})}
                      className="peer sr-only"
                    />
                    <div className="w-10 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </div>
                  <span className="text-sm font-bold text-on-background">Publish Immediately</span>
                </label>
              </form>
            </div>

            <div className="px-6 py-5 border-t border-outline-variant/10 bg-surface shrink-0 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="new-post-form"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-primary text-on-primary hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">save</span>
                )}
                Save Article
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
