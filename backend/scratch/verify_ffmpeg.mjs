import 'dotenv/config';
import { config } from 'dotenv';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

config({ path: path.resolve('backend/.env') });

ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

async function verifyFFprobe() {
  const testFile = 'backend/storage/cache/voice/4ecb36679b83d0252682f1c38770b5dd5a913828ad96be41365f31b9b3f25037.mp3';
  
  console.log(`Probing file: ${testFile}`);
  console.log(`Using ffprobe at: ${process.env.FFPROBE_PATH}`);

  ffmpeg.ffprobe(testFile, (err, data) => {
    if (err) {
      console.error('❌ FFprobe failed:', err.message);
      process.exit(1);
    } else {
      console.log('✅ FFprobe success! Duration:', data.format.duration);
      process.exit(0);
    }
  });
}

verifyFFprobe();
