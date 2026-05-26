import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./WishlistPage.css";

const images = require.context("./assets", false, /\.(png|jpe?g|webp|svg)$/);
const getImage = (name) => {
  try { return images(`./${name}`); }
  catch { return images("./logo.png"); }
};

function WishlistPage() {
  const [wishlist, setWishlist] = useState([]);
  const navigate = useNavigate();

  const fetchWishlist = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res  = await fetch("/wishlist",
                               { headers:{ Authorization:`Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setWishlist(data.data);
      if (window.updateWishlistCount) window.updateWishlistCount();
    } catch (err) { console.error("Failed to fetch wishlist:", err); }
  };

  const removeFromWishlist = async (productId) => {
    const token = localStorage.getItem("token");
    try {
      await fetch(`/wishlist/${productId}`, {
        method:"DELETE",
        headers:{ Authorization:`Bearer ${token}` },
      });
      setWishlist(prev =>
        prev.filter(it => (it.productId?._id || it.productId) !== productId)
      );
      if (window.updateWishlistCount) window.updateWishlistCount();
    } catch (err) { console.error("Failed to remove:", err); }
  };

  useEffect(() => { fetchWishlist(); }, []);

  return (
    <div className="wishlist-page">
      <h2>Your Wishlist</h2>

      {wishlist.length === 0 ? (
        <p className="empty">Your wishlist is empty.</p>
      ) : (
        <div className="wishlist-items">
          {wishlist.map((item) => {
            const product = typeof item.productId === "object" ? item.productId : null;
            if (!product) return null;

            return (
              <div key={item._id} className="wishlist-card">
                <img
                  src={getImage(product.image1)} alt={product.name}
                  className="wishlist-image"
                  onClick={() => navigate(`/product/${product._id}`)}
                  style={{ cursor:"pointer" }}
                />

                <h3 onClick={() => navigate(`/product/${product._id}`)}
                    style={{ cursor:"pointer" }}>
                  {product.name}
                </h3>

                {/* -------- Price block (mimics Shop.js) -------- */}
                <div className="wishlist-price-section">
                  {product.discountedPrice ? (
                    <>
                      <span className="product-price original-price">
                        €{product.price.toFixed(2)}
                      </span>
                      <span className="product-price discounted-price">
                        €{product.discountedPrice.toFixed(2)}
                      </span>
                      <span className="sale-indicator">On Sale</span>
                    </>
                  ) : (
                    <span className="product-price">
                      €{product.price.toFixed(2)}
                    </span>
                  )}
                </div>

                <button className="remove-btn"
                        onClick={() => removeFromWishlist(product._id)}>
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default WishlistPage;