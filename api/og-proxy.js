/**
 * Server-rendered Open Graph & Schema.org proxy for /blog/:slug
 *
 * Serves fully prerendered HTML to search engines (Googlebot, Bingbot, ...)
 * and social bots (WhatsApp, Telegram, Facebook, Twitter, Slack, ...) and
 * AI answer engines (ChatGPT, Perplexity, Claude).
 *
 * Emits BlogPosting JSON-LD, canonical, Open Graph, 404 on missing slug,
 * and a rich indexable HTML body with internal links back to the blog hub & deals.
 */
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const SITE_URL = "https://www.unideals.co";
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug || typeof slug !== "string") {
    res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(notFoundHtml());
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  try {
    const query = new URL(`${supabaseUrl}/rest/v1/posts`);
    query.searchParams.set("slug", `eq.${slug}`);
    query.searchParams.set("is_published", "eq.true");
    query.searchParams.set(
      "select",
      "title,excerpt,content,cover_image_url,created_at",
    );

    const postRes = await fetch(query, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!postRes.ok) {
      throw new Error(`Upstream responded ${postRes.status}`);
    }

    const posts = await postRes.json();
    const post = Array.isArray(posts) ? posts[0] : null;

    if (!post) {
      res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(notFoundHtml());
    }

    const canonicalUrl = `${SITE_URL}/blog/${slug}`;
    const rawTitle = `${post.title} | Uni Deals Blog`;
    const rawDescription =
      post.excerpt ||
      `Read ${post.title} on the Uni Deals Blog. Discover student life guides and money-saving tips in Sri Lanka.`;
    const rawImage = post.cover_image_url || DEFAULT_IMAGE;

    const title = escapeHtml(rawTitle);
    const description = escapeHtml(rawDescription);
    const image = escapeHtml(rawImage);

    const schema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": post.title,
      "description": rawDescription,
      "image": [rawImage],
      "url": canonicalUrl,
      ...(post.created_at ? { "datePublished": post.created_at } : {}),
      "publisher": {
        "@type": "Organization",
        "name": "Uni Deals",
        "url": SITE_URL,
        "logo": {
          "@type": "ImageObject",
          "url": `${SITE_URL}/logo-512.png`,
        },
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": canonicalUrl,
      },
    };

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Uni Deals" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="en_LK" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
  </head>
  <body>
    <article>
      <header>
        <p><strong>Published on:</strong> Uni Deals Student Blog (Sri Lanka)</p>
        <h1>${title}</h1>
      </header>
      <section>
        <p>${description}</p>
      </section>
      <nav aria-label="Related links">
        <ul>
          <li><a href="${SITE_URL}/blog">All Student Blog Articles</a></li>
          <li><a href="${SITE_URL}/deals">Student Discounts in Sri Lanka</a></li>
          <li><a href="${SITE_URL}">Uni Deals Homepage</a></li>
        </ul>
      </nav>
    </article>
  </body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    res.status(200).send(html);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
}

function notFoundHtml() {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Article Not Found | Uni Deals Blog</title>
    <meta name="robots" content="noindex, nofollow" />
    <meta property="og:title" content="Article Not Found | Uni Deals" />
    <meta property="og:description" content="This article may have been removed or does not exist." />
  </head>
  <body>
    <h1>Article Not Found</h1>
    <p>The student guide or blog post you are looking for does not exist or has been unpublished.</p>
    <p><a href="${SITE_URL}/blog">Back to Uni Deals Blog</a></p>
  </body>
</html>`;
}
