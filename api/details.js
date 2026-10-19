module.exports = async (req, res) => {
  const key = process.env.RAPIDAPI_KEY || process.env.CONFIG_RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST || 'youtube-media-downloader.p.rapidapi.com';
  const { videoId } = req.query;
  if (!key) return res.status(500).json({ error: 'Missing RAPIDAPI_KEY' });
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });
  try {
    const r = await fetch(`https://${host}/v2/video/details?videoId=${encodeURIComponent(videoId)}`, {
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host }
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
