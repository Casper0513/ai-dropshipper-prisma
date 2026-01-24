import axios from "axios";

export async function amazonBestSellers(req, res) {
  try {
    const category = req.query.category || "electronics";

    const response = await axios.get(
      "https://real-time-amazon-data.p.rapidapi.com/best-sellers",
      {
        params: {
          category,
          country: "US",
        },
        headers: {
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
          "X-RapidAPI-Host": "real-time-amazon-data.p.rapidapi.com",
        },
        timeout: 15000,
      }
    );

    const products =
      response.data?.products?.map((p) => ({
        asin: p.asin,
        title: p.title,
        rank: p.rank,
        price: p.price?.value || null,
        image: p.image || null,
        rating: p.rating || null,
      })) || [];

    res.json({
      source: "amazon",
      type: "BEST_SELLERS",
      category,
      count: products.length,
      products,
    });
  } catch (err) {
    console.error(
      "🔥 Amazon BEST_SELLERS error:",
      err.response?.data || err.message
    );

    res.status(500).json({
      error: "Amazon BEST_SELLERS fetch failed",
      details: err.response?.data || err.message,
    });
  }
}

