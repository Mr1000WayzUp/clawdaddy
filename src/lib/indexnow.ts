// IndexNow: instant URL submission to Bing, Yandex, Seznam, Naver, etc.
// The key is intentionally public — the protocol verifies ownership by
// fetching https://<host>/<key>.txt, which we serve from a route.
export const INDEXNOW_KEY = 'e4209f40e900dd91afaf4ca8fd3642e9'
export const SITE_HOST = 'begyn.online'

export async function submitToIndexNow(urls: string[]): Promise<boolean> {
  if (!urls.length) return false
  try {
    const resp = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: SITE_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
        urlList: urls.slice(0, 100),
      }),
    })
    return resp.ok
  } catch {
    return false
  }
}
