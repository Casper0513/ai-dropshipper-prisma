
// src/services/imageEnhancer.js
import axios from "axios";
import sharp from "sharp";
import { log } from "../utils/logger.js";

/**
 * Enhance an image:
 * 1) Download original
 * 2) Optional background removal (remove.bg)
 * 3) Optional upscaling (DeepAI SRGAN)
 * 4) Resize to 1024x1024 white background
 * Returns base64 data URL or original URL on failure.
 */
export async function enhanceImage(imageUrl) {
  if (!imageUrl) return null;
  if (process.env.IMAGE_ENHANCE_ENABLED !== "true") return imageUrl;

  try {
    const resp = await axios.get(imageUrl, { responseType: "arraybuffer" });
    let buffer = Buffer.from(resp.data);

    // Background removal
    if (process.env.REMOVE_BG_API_KEY) {
      try {
        const bgRes = await axios({
          method: "POST",
          url: "https://api.remove.bg/v1.0/removebg",
          data: {
            image_file_b64: buffer.toString("base64"),
            size: "auto"
          },
          headers: {
            "X-Api-Key": process.env.REMOVE_BG_API_KEY
          },
          responseType: "arraybuffer"
        });
        buffer = Buffer.from(bgRes.data);
        log.info("Background removed via remove.bg");
      } catch (err) {
        log.error("Background removal failed:", err.response?.data || err.message);
      }
    }

    // Upscale
    if (process.env.UPSCALE_API_KEY) {
      try {
        const upRes = await axios({
          method: "POST",
          url: "https://api.deepai.org/api/torch-srgan",
          data: {
            image: buffer.toString("base64")
          },
          headers: {
            "Api-Key": process.env.UPSCALE_API_KEY
          }
        });

        if (upRes.data?.output_url) {
          const upImg = await axios.get(upRes.data.output_url, {
            responseType: "arraybuffer"
          });
          buffer = Buffer.from(upImg.data);
          log.info("Image upscaled via DeepAI");
        }
      } catch (err) {
        log.error("Upscale failed:", err.message);
      }
    }

    // Normalize to 1024x1024 white background
    buffer = await sharp(buffer)
      .resize(1024, 1024, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch (err) {
    log.error("Image enhancement failed:", err.message);
    return imageUrl;
  }
}
