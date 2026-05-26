// api/reviews.js
const API_BASE = "/reviews";

// Get all reviews for a product
export const fetchReviews = async (productId, token) => {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${API_BASE}/${productId}`, { headers });
    return await res.json();
  } catch (err) {
    console.error("Fetch reviews failed:", err);
    return { success: false, error: err.message };
  }
};

// Submit a review (requires login & purchase)
export const submitReview = async (productId, rating, comment) => {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE}/${productId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ rating, comment }),
    });
    return await res.json();
  } catch (err) {
    console.error("Submit review failed:", err);
    return { success: false, error: err.message };
  }
};
