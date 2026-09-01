const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).send("Missing slug");
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  try {
    const query = new URL(`${supabaseUrl}/rest/v1/posts`);
    query.searchParams.set("slug", `eq.${slug}`);
    query.searchParams.set("select", "title,excerpt,cover_image_url");

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

    const rawTitle = post ? post.title : "Uni Deals Blog";
    const rawDescription = post
      ? post.excerpt || `Read ${post.title} on the Uni Deals Blog.`
      : "Discover the latest student deals.";
    const rawImage =
      post && post.cover_image_url
        ? post.cover_image_url
        : "https://www.unideals.co/og-default.png";

    const title = escapeHtml(rawTitle);
    const description = escapeHtml(rawDescription);
    const image = escapeHtml(rawImage);

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:type" content="article" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
  </head>
  <body>
    <h1>${title}</h1>
    <p>${description}</p>
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
