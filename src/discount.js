import React, { useEffect, useState } from "react";
import "./discount.css";

export default function Discount() {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [discountAmounts, setDiscountAmounts] = useState({});

  /* Fetch Products */
  useEffect(() => {
    fetch("/products")
      .then((res) => res.json())
      .then((data) => data.success && setProducts(data.data))
      .catch(console.error);
  }, []);

  /* Handle Discount Change */
  const handleDiscountChange = (id, value) => {
    if (value >= 0 && value <= 99) {
      setDiscountAmounts((prev) => ({
        ...prev,
        [id]: value,
      }));
    }
  };

  /* Apply Discount */
  const applyDiscount = async (productId) => {
    const discount = discountAmounts[productId];

    if (!discount || isNaN(discount) || discount <= 0 || discount >= 100) {
      alert("Enter a valid discount percentage (1-99).");
      return;
    }

    try {
      const res = await fetch(`/apply-discount/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ discountAmount: Number(discount) }),
      });

      const data = await res.json();

      if (data.success) {
        alert(data.msg);

        setProducts((prev) =>
          prev.map((product) =>
            product._id === productId
              ? {
                  ...product,
                  discountAmount: discount,
                  discountedPrice: product.price - (product.price * discount) / 100,
                }
              : product
          )
        );
      } else {
        alert(data.msg);
      }
    } catch (err) {
      console.error("Error applying discount:", err);
    }
  };

  /* Remove Discount */
  const removeDiscount = async (productId) => {
    try {
      const res = await fetch(`/apply-discount/remove/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (data.success) {
        alert(data.msg);

        setProducts((prev) =>
          prev.map((product) =>
            product._id === productId
              ? { ...product, discountedPrice: null, discountAmount: null }
              : product
          )
        );
        setDiscountAmounts((prev) => ({ ...prev, [productId]: "" }));
      } else {
        alert(data.msg);
      }
    } catch (err) {
      console.error("Error removing discount:", err);
    }
  };

  /* Render */
  return (
    <div className="discount-page">
      <h2>Apply Discounts</h2>
      <div className="discount-controls">
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="discount-products">
        {products.length > 0 ? (
          products.map((product) => {
            const isDiscounted = product.discountAmount !== null;

            const originalPrice = product.price.toFixed(2);
            const discountedPrice = product.discountedPrice 
              ? product.discountedPrice.toFixed(2) 
              : null;

            return (
              <div key={product._id} className="discount-card">
                <div className="discount-info">
                  <h3>{product.name}</h3>
                  <p>Category: {product.category}</p>
                  <p>Original Price: ${originalPrice}</p>

                  {isDiscounted ? (
                    <p style={{ color: "red" }}>
                      Discounted Price: ${discountedPrice} (Saved {product.discountAmount}%)
                    </p>
                  ) : (
                    <p>No Discount Applied</p>
                  )}
                </div>

                <div className="discount-actions">
                  {isDiscounted ? (
                    <>
                      <p className="discount-indicator">Product is in discount</p>
                      <button onClick={() => removeDiscount(product._id)}>
                        Remove Discount
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="number"
                        placeholder="Discount %"
                        value={discountAmounts[product._id] || ""}
                        onChange={(e) => handleDiscountChange(product._id, e.target.value)}
                      />
                      <button onClick={() => applyDiscount(product._id)}>Apply</button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p>No products found.</p>
        )}
      </div>
    </div>
  );
}
