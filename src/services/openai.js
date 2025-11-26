import OpenAI from "openai";
import { CONFIG } from "../config.js";
import { log } from "../utils/logger.js";

const client = new OpenAI({ apiKey: CONFIG.openai.key });

export async function generateDescription(product, keyword) {
  const bulletPoints = (product.bulletPoints || []).slice(0, 6);

  const prompt = `
Write a high-converting Shopify product description in HTML.

Product:
- Title: ${product.title}
- Brand: ${product.brand}
- Selling Price: $${product.price?.toFixed(2) ?? "N/A"}
- Keyword Category: ${keyword}
- Source URL: ${product.url}

Bullet points:
${bulletPoints.map((b, i) => `${i + 1}. ${b}`).join("\n")}

Requirements:
- Output HTML using only <p>, <ul>, <li>, <strong>.
- Start with a short hook paragraph (2–3 sentences) focused on benefits.
- Add a bullet list of 4–6 key features/benefits.
- End with a short paragraph about shipping / satisfaction guarantee.
`;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an expert Shopify copywriter." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty description from OpenAI");
    return text;
  } catch (err) {
    log.error(`OpenAI error: ${err.message}`);
    throw err;
  }
}
