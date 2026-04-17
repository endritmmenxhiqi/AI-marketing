const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

/**
 * Automatically resize, crop to 9:16 and add a realistic AI Studio background.
 * POST /api/ai/auto-fix
 */
const autoFixImage = async (req, res, next) => {
  try {
    const { imagePath, title, background: prompt } = req.body;

    if (!title || !prompt || !imagePath) {
      return res.status(400).json({ success: false, message: 'ImagePath, Title, and Background Prompt are required' });
    }

    // Resolve original image path
    const absolutePath = path.join(__dirname, '..', imagePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: 'Original image not found' });
    }
    
    const outputFilename = `circle-elite-${Date.now()}.jpg`;
    const outputPath = path.join(__dirname, '..', 'uploads', outputFilename);

    // ─── Design Specs ───
    const width = 1080;
    const height = 1920;
    const circleSize = 800; // Large center focus

    // 1. Fetch AI Background Scene with Retry Logic
    const safePrompt = encodeURIComponent(prompt);
    const bgUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=${width}&height=${height}&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
    
    let bgBuffer;
    const fetchWithRetry = async (url, retries = 2) => {
      for (let i = 0; i <= retries; i++) {
        try {
          const resp = await axios.get(url, { responseType: 'arraybuffer' });
          if (resp.headers['content-type']?.includes('text')) throw new Error('API returned text error');
          return await sharp(Buffer.from(resp.data)).resize(width, height).toBuffer();
        } catch (err) {
          if (i === retries) throw err;
          console.log(`Retry ${i + 1} for BG generation...`);
          await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s
        }
      }
    };

    try {
      bgBuffer = await fetchWithRetry(bgUrl);
    } catch (err) {
      console.error('BG Fail after retries, using Studio Fallback:', err.message);
      bgBuffer = await sharp({
        create: { width, height, channels: 3, background: { r: 15, g: 15, b: 25 } }
      }).png().toBuffer(); // Explicitly PNG to avoid format errors
    }

    // 2. Create the Luxury Circle Product Frame
    // 2a. The Mask
    const circleMask = await sharp({
      create: { width: circleSize, height: circleSize, channels: 3, background: { r: 255, g: 255, b: 255 } }
    })
    .composite([{
      input: Buffer.from(`<svg><circle cx="${circleSize / 2}" cy="${circleSize / 2}" r="${circleSize / 2}" fill="white"/></svg>`),
      blend: 'dest-in'
    }])
    .png()
    .toBuffer();

    // 2b. The Product (contained in circle)
    const productInCircle = await sharp(absolutePath)
      .resize(circleSize, circleSize, { fit: 'cover' })
      .modulate({ brightness: 1.05, saturation: 1.1 })
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toBuffer();

    // 2c. The Elite Border (Frosted White Glow)
    const borderOverlay = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="15" />
            <feOffset dx="0" dy="10" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.5" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx="${width / 2}" cy="${height / 2}" r="${circleSize / 2 + 10}" fill="none" stroke="white" stroke-width="8" stroke-opacity="0.8" />
        <circle cx="${width / 2}" cy="${height / 2}" r="${circleSize / 2 + 20}" fill="none" stroke="white" stroke-width="2" stroke-opacity="0.3" />
        
        <!-- Premium Typography -->
        <g filter="url(#shadow)">
          <text x="50%" y="${height / 2 + circleSize / 2 + 180}" text-anchor="middle" fill="white" font-size="90" font-weight="900" font-family="serif" letter-spacing="8">
            ${title.toUpperCase()}
          </text>
          
          <text x="50%" y="${height / 2 + circleSize / 2 + 260}" text-anchor="middle" fill="white" font-size="30" font-weight="300" font-family="sans-serif" letter-spacing="15" fill-opacity="0.6">
            PREMIUM SELECTION
          </text>
        </g>
      </svg>
    `;

    // 3. Final Composition (Perfect Blending)
    await sharp(bgBuffer)
      .blur(5) // Soften background for depth of field
      .composite([
        { input: productInCircle, gravity: 'center' },
        { input: Buffer.from(borderOverlay), top: 0, left: 0 }
      ])
      .jpeg({ quality: 95 })
      .toFile(outputPath);

    res.json({
      success: true,
      data: {
        url: `/uploads/${outputFilename}`,
        filename: outputFilename
      }
    });

  } catch (error) {
    console.error('Studio Circle Master Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate elite ad' });
  }
};

module.exports = {
  autoFixImage,
};
