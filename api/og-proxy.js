export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).send("Missing slug");
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  try {
    const postRes = await fetch(`${supabaseUrl}/rest/v1/posts?slug=eq.${slug}&select=title,excerpt,cover_image_url`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    const posts = await postRes.json();
    const post = posts[0];

    const title = post ? post.title : "Uni Deals Blog";
    const description = post ? (post.excerpt || `Read ${post.title} on the Uni Deals Blog.`) : "Discover the latest student deals.";
    const image = post && post.cover_image_url ? post.cover_image_url : "https://unideals-nine.vercel.app/images/og-default.png";

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
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

    res.setHeader("Content-Type", "text/html");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    res.status(200).send(html);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
}
