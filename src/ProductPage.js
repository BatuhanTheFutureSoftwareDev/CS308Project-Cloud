// ProductPage.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from './CartContext';
import './ProductPage.css';

function ProductPage({ openModal, isSignedIn, signOut }) {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { addToCart, updateQuantity, cart } = useCart();
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [mainImage, setMainImage] = useState(0);
  const [isWishlisted, setWishlisted] = useState(false);

  useEffect(() => {
    fetch('/products/sort?by=name&order=asc')
      .then(res => res.json())
      .then(data => data.success && setProducts(data.data))
      .catch(console.error);

    fetch(`/reviews/${productId}`)
      .then(res => res.json())
      .then(data => data.success && setReviews(data.data))
      .catch(console.error);

    // Check if product is already wishlisted
    if (isSignedIn) {
      const token = localStorage.getItem("token");
      fetch(`/wishlist`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const wishlistItems = data.data;
            const isInWishlist = wishlistItems.some(item => (item.productId._id || item.productId) === productId);
            setWishlisted(isInWishlist);
          }
        })
        .catch(console.error);
    }
  }, [productId, isSignedIn]);

  const getImage = (imageName) => {
    try {
      return require(`./assets/${imageName}`);
    } catch {
      return require('./assets/logo.png');
    }
  };

  const product = products.find(p => p._id === productId);
  if (!product) return <div className="loading">Loading...</div>;

  const productImages = [
    getImage(product.image1),
    getImage(product.image2),
    getImage(product.image3),
  ];

  const handleAddToCart = () => {
    const existingItem = cart.find(item => item.id === product._id);
    const currentQuantity = existingItem?.quantity || 0;

    if (currentQuantity + 1 > product.stock) {
      alert(`❌ Only ${product.stock} in stock.`);
      return;
    }

    if (existingItem) {
      updateQuantity(product._id, currentQuantity + 1);
    } else {
      addToCart({ ...product, id: product._id });
    }

    alert("✅ Product added to cart!");
  };

  const handleAddToWishlist = async () => {
    if (!isSignedIn) {
      openModal("login");
      return;
    }
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/wishlist/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ productId })
      });
      const data = await res.json();
      if (data.success) {
        setWishlisted(true);
        alert("Added to wishlist!");
      } else {
        alert(data.message || "Could not add to wishlist.");
      }
    } catch (err) {
      alert("Error adding to wishlist.");
    }
  };

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "No rating";

  return (
    <div className="modern-product-page">
      {/* Product Content */}
      <div className="product-layout">
        <div className="product-gallery">
          <div className="main-image">
            <img src={productImages[mainImage]} alt={product.name} />
          </div>
          <div className="thumbnail-list">
            {productImages.map((img, i) => (
              <div
                key={i}
                className={`thumbnail ${mainImage === i ? 'active' : ''}`}
                onClick={() => setMainImage(i)}
              >
                <img src={img} alt={`Product view ${i + 1}`} />
              </div>
            ))}
          </div>
        </div>

        <div className="product-info">
          <h1 className="product-name">{product.name}</h1>

          {/* Price Display */}
          <div className="price-section">
            {product.discountedPrice ? (
              <>
                <span className="original-price">€{product.price.toFixed(2)}</span>
                <span className="discounted-price">€{product.discountedPrice.toFixed(2)}</span>
                <span className="sale-indicator">On Sale</span>
              </>
            ) : (
              <span className="price">€{product.price.toFixed(2)}</span>
            )}
          </div>

          <p className="description">{product.description}</p>

          <button
            className="add-button"
            disabled={product.stock < 1}
            onClick={handleAddToCart}
          >
            {product.stock < 1 ? 'OUT OF STOCK' : 'ADD TO CART'}
          </button>

          <button
            className={`wishlist-btn ${isWishlisted ? 'hearted' : 'unhearted'}`}
            disabled={!isSignedIn}
            onClick={handleAddToWishlist}
          >
            {isWishlisted ? '❤️ Wishlisted' : '♡ Add to Wishlist'}
          </button>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="reviews-section">
        <h2>Customer Reviews</h2>
        <div className="average-rating">
          <span className="star-symbol">★</span>
          <span className="rating-number">{averageRating}</span>
        </div>

        {reviews.length > 0 ? (
          <div className="reviews-list">
            {reviews.map(r => (
              <div key={r._id} className="review-card">
                <div className="review-rating">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className={`star ${i < r.rating ? 'filled' : ''}`}>★</span>
                  ))}
                </div>
                <p className="review-comment">{r.comment}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-reviews">No reviews yet. Be the first!</p>
        )}
      </div>
    </div>
  );
}

export default ProductPage;
