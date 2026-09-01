/**
 * Blog markdown helpers: `[deal:123]` embeds a live DealCard.
 */

const DEAL_TOKEN = /\[deal:(\d+)\]/;
const DEAL_TOKEN_GLOBAL = /\[deal:(\d+)\]/g;
const DEAL_TOKEN_ONLY = /^\[deal:(\d+)\]$/;

export function extractDealEmbedIds(content) {
  const ids = [];
  const source = String(content ?? "");
  DEAL_TOKEN_GLOBAL.lastIndex = 0;
  let match;
  while ((match = DEAL_TOKEN_GLOBAL.exec(source))) {
    const id = Number(match[1]);
    if (Number.isInteger(id) && id > 0) ids.push(id);
  }
  return [...new Set(ids)];
}

export function splitBlogContent(content) {
  const source = String(content ?? "");
  if (!source) return [];
  if (!DEAL_TOKEN.test(source)) {
    return [{ type: "markdown", text: source }];
  }

  return source.split(/(\[deal:\d+\])/g).flatMap((chunk) => {
    const token = chunk.match(DEAL_TOKEN_ONLY);
    if (token) {
      return [{ type: "deal", id: Number(token[1]) }];
    }
    return chunk ? [{ type: "markdown", text: chunk }] : [];
  });
}
