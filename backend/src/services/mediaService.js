const config = require('../config');

const PEXELS_API_BASE = 'https://api.pexels.com';

const dedupeStrings = (items) => [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];

const buildMediaQuery = ({ productDescription, keywords = [], mediaKeywords = [], platform }) => {
  const leadTerms = dedupeStrings([
    ...mediaKeywords.slice(0, 3),
    ...keywords.slice(0, 2),
  ]);

  if (leadTerms.length > 0) {
    return leadTerms.join(' ');
  }

  return `${platform} ${productDescription}`.trim().slice(0, 80);
};

const fetchPexelsJson = async (path, params) => {
  const url = new URL(`${PEXELS_API_BASE}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      Authorization: config.pexelsApiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(`Pexels request failed: ${response.status} ${errorText}`);
    err.statusCode = response.status;
    throw err;
  }

  return response.json();
};

const pickVideoFile = (videoFiles = []) => {
  const mp4Files = videoFiles.filter((file) => file.file_type === 'video/mp4');

  if (mp4Files.length === 0) return null;

  return mp4Files.sort((a, b) => (a.width || 0) - (b.width || 0))[0];
};

const searchPexelsMedia = async ({ productDescription, keywords, mediaKeywords, platform }) => {
  const query = buildMediaQuery({ productDescription, keywords, mediaKeywords, platform });

  if (!config.pexelsApiKey) {
    return {
      provider: 'pexels',
      configured: false,
      query,
      fetchedAt: new Date(),
      errorMessage: 'PEXELS_API_KEY is missing',
      photos: [],
      videos: [],
    };
  }

  try {
    const [photoResponse, videoResponse] = await Promise.all([
      fetchPexelsJson('/v1/search', {
        query,
        per_page: 6,
        orientation: 'portrait',
      }),
      fetchPexelsJson('/videos/search', {
        query,
        per_page: 4,
        orientation: 'portrait',
        size: 'medium',
      }),
    ]);

    return {
      provider: 'pexels',
      configured: true,
      query,
      fetchedAt: new Date(),
      errorMessage: '',
      photos: (photoResponse.photos || []).map((photo) => ({
        externalId: photo.id,
        url: photo.url,
        thumbnailUrl: photo.src?.large || photo.src?.medium || photo.src?.original || '',
        photographer: photo.photographer || '',
        alt: photo.alt || query,
        width: photo.width || 0,
        height: photo.height || 0,
      })),
      videos: (videoResponse.videos || [])
        .map((video) => {
          const selectedFile = pickVideoFile(video.video_files || []);
          return {
            externalId: video.id,
            url: selectedFile?.link || '',
            thumbnailUrl: video.image || video.video_pictures?.[0]?.picture || '',
            duration: video.duration || 0,
            width: selectedFile?.width || video.width || 0,
            height: selectedFile?.height || video.height || 0,
          };
        })
        .filter((video) => video.url),
    };
  } catch (error) {
    return {
      provider: 'pexels',
      configured: true,
      query,
      fetchedAt: new Date(),
      errorMessage: error.message,
      photos: [],
      videos: [],
    };
  }
};

module.exports = {
  searchPexelsMedia,
};
