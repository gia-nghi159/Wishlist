import * as https from 'https';
import * as http from 'http';

export type LinkMetadata = {
  title: string | null;
  description: string | null;
  price: string | null;
  image: string | null;
};

/**
 * Extracts standard and OpenGraph metadata from a given URL without needing a headless browser.
 */
export async function parseLinkMetadata(url: string): Promise<LinkMetadata> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'http:' ? http : https;

      client.get(
        url,
        { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GiftAssistantBot/1.0)' } },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            // Handle redirect (naive single-hop for now)
            return resolve(parseLinkMetadata(res.headers.location));
          }

          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
            // Stop downloading early if we got enough of the head (save bandwidth)
            if (data.length > 500000) res.destroy(); 
          });

          res.on('end', () => {
            resolve(extractMetaTags(data));
          });
        }
      ).on('error', (err) => {
        console.error("Link parsing error:", err.message);
        resolve({ title: null, description: null, price: null, image: null });
      });
    } catch (e) {
      resolve({ title: null, description: null, price: null, image: null });
    }
  });
}

function extractMetaTags(html: string): LinkMetadata {
  const getMatch = (regex: RegExp) => {
    const match = html.match(regex);
    return match ? match[1].trim() : null;
  };

  const title = getMatch(/<title[^>]*>([^<]+)<\/title>/i) || getMatch(/property="og:title" content="([^"]+)"/i);
  const description = getMatch(/property="og:description" content="([^"]+)"/i) || getMatch(/name="description" content="([^"]+)"/i);
  const price = getMatch(/property="product:price:amount" content="([^"]+)"/i);
  const image = getMatch(/property="og:image" content="([^"]+)"/i);

  return { title, description, price, image };
}
