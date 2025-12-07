
import axios from "axios";

// Download image and return base64 string (no data: prefix).
export async function enhanceImage(imageUrl) {
  if (!imageUrl) return null;
  try {
    const resp = await axios.get(imageUrl, { responseType: "arraybuffer" });
    return Buffer.from(resp.data).toString("base64");
  } catch (err) {
    console.error("enhanceImage failed:", err.message);
    return null;
  }
}
