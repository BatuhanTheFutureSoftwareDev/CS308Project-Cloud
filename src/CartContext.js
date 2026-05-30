// src/CartContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const CART_STORAGE_KEY = 'shopping_cart';
const CartContext = createContext();

const API_URL = '/cart';

export const CartProvider = ({ children }) => {
  // If not logged in, load the initial cart from localStorage.
  const initialToken = localStorage.getItem("token");
  const initialCart = initialToken ? [] : JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
  const [cart, setCart] = useState(initialCart);
  const [isInitialized, setIsInitialized] = useState(false);

  // Function to load cart from the backend when logged in.
  const loadCartFromBackend = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        const items = (data.data || [])
          .map((item) => {
            // The cart route returns each item with productId populated to the
            // full Product object. If populate failed (product deleted, etc.)
            // productId is still a string and we skip the row.
            const product = item.productId && typeof item.productId === "object" ? item.productId : null;
            if (!product) return null;
            return {
              id: product.id || product._id,
              name: product.name,
              image1: product.image1,
              image2: product.image2,
              image3: product.image3,
              price: typeof product.price === "number" ? product.price : (item.price || 0),
              discountedPrice: product.discountedPrice ?? item.discountedPrice ?? null,
              discountAmount: product.discountAmount ?? item.discountAmount ?? null,
              quantity: item.quantity || 1,
              stock: typeof product.stock === "number" ? product.stock : 0,
            };
          })
          .filter(Boolean);

        // Validate quantities against stock before setting cart.
        const validatedItems = items.map((item) => ({
          ...item,
          quantity: Math.min(item.quantity, item.stock || item.quantity),
        }));

        setCart(validatedItems);
        console.log("🛒 Cart loaded from backend:", validatedItems);
      } else {
        console.warn("Failed to load cart from backend:", data.error);
      }
    } catch (error) {
      console.error("Error loading cart from backend:", error);
    }
  };

  // Expose refreshCart to be called from other components (e.g., AuthModal)
  const refreshCart = async () => {
    const token = localStorage.getItem("token");
    if (token) {
      await loadCartFromBackend();
    } else {
      const localCartData = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
      setCart(localCartData);
    }
  };

  // On mount, if the user is logged in, load the cart from the backend.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      loadCartFromBackend().finally(() => setIsInitialized(true));
    } else {
      setIsInitialized(true);
    }
  }, []);

  // Save to localStorage for persistence when not logged in.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }
  }, [cart]);

  const addToCart = async (product) => {
    if (!product || !product.id) return;
    const token = localStorage.getItem("token");

    // Check current quantity in cart
    const currentItem = cart.find(item => item.id === product.id);
    const currentQuantity = currentItem?.quantity || 0;

    // Don't add if it would exceed stock
    if (currentQuantity + 1 > product.stock) {
      console.warn("Cannot add more items: would exceed stock");
      return;
    }

    if (!token) {
      setCart(prevCart => {
        const existing = prevCart.find(item => item.id === product.id);
        if (existing) {
          return prevCart;
        } else {
          return [...prevCart, { ...product, quantity: 1 }];
        }
      });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ 
          productId: product.id, 
          quantity: 1,
          setQuantity: true // Tell backend to set exact quantity rather than add
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        // Instead of reloading entire cart, update just this item
        setCart(prevCart => {
          const existing = prevCart.find(item => item.id === product.id);
          if (existing) {
            return prevCart;
          }
          return [...prevCart, { ...product, quantity: 1 }];
        });
      } else {
        console.error("Add to cart failed:", data.error);
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
    }
  };

  const removeFromCart = async (productId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      setCart(prevCart => prevCart.filter(item => item.id !== productId));
      return;
    }

    try {
      const response = await fetch(`${API_URL}/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      if (response.ok) {
        setCart(prevCart => prevCart.filter(item => item.id !== productId));
      } else {
        // If delete fails, refresh cart
        await loadCartFromBackend();
      }
    } catch (error) {
      console.error("Error removing from cart:", error);
      // On error, refresh cart
      await loadCartFromBackend();
    }
  };

  const updateQuantity = async (productId, newQuantity) => {
    if (newQuantity < 1) return removeFromCart(productId);

    // Find the product in cart to check stock
    const product = cart.find(item => item.id === productId);
    if (!product) return;

    // Don't update if it would exceed stock
    if (newQuantity > product.stock) {
      console.warn("Cannot update quantity: would exceed stock");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setCart(prevCart =>
        prevCart.map(item =>
          item.id === productId ? { ...item, quantity: newQuantity } : item
        )
      );
      return;
    }

    try {
      const response = await fetch(`${API_URL}/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ 
          productId, 
          quantity: newQuantity,
          setQuantity: true // Tell backend to set exact quantity
        }),
      });

      if (response.ok) {
        setCart(prevCart =>
          prevCart.map(item =>
            item.id === productId ? { ...item, quantity: newQuantity } : item
          )
        );
      } else {
        // If update fails, refresh cart to get current state
        await loadCartFromBackend();
      }
    } catch (error) {
      console.error("Error updating quantity:", error);
      // On error, refresh cart to ensure consistency
      await loadCartFromBackend();
    }
  };

  const getTotalItems = () =>
    cart.reduce((total, item) => total + (item.quantity || 0), 0);

  const getTotalPrice = () =>
    cart.reduce((total, item) => total + (item.price || 0) * (item.quantity || 0), 0);

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        getTotalItems,
        getTotalPrice,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);