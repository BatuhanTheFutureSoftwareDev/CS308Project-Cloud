// frontend AuthModal.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "./CartContext"; // Import refreshCart from cart context
import "./AuthModal.css";

function AuthModal({ isOpen, onClose, defaultActiveTab = "login", setIsSignedIn, openModal }) {
  const [activeTab, setActiveTab] = useState(defaultActiveTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const { refreshCart } = useCart(); // used to load backend cart after merging

  // Key for local cart in localStorage
  const CART_STORAGE_KEY = "shopping_cart";
  const navigate = useNavigate();

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFullName("");
    setPhone("");
    setRememberMe(false);
  };

  // Merge local cart with server-side cart.
  const mergeCart = async (token) => {
    try {
      const localCart = localStorage.getItem(CART_STORAGE_KEY);
      if (!localCart) return;

      const parsedCart = JSON.parse(localCart);
      const itemsToMerge = parsedCart.map(item => ({
        productId: item.id,
        quantity: item.quantity,
      }));

      if (itemsToMerge.length > 0) {
        const mergeResponse = await fetch("/cart/merge", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token,
          },
          body: JSON.stringify({ items: itemsToMerge }),
        });
        if (mergeResponse.ok) {
          localStorage.removeItem(CART_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error("Error merging cart:", error);
    }
  };


  const handleLogin = async (e) => {
    e.preventDefault();
  
    try {
      /* ────────── basic client-side validation ────────── */
      if (!email || !password) {
        alert("Please fill in all fields");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alert("Please enter a valid email address");
        return;
      }
  
      /* ────────── send login request ────────── */
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          mail_adress: email.trim(),
          password:    password.trim(),
          rememberMe
        })
      });
  
      const data = await response.json();
  
      /* ────────── handle success ────────── */
      if (response.ok && data.success) {
        /* ---------- ADMIN ---------- */
        if (data.role === "admin") {
          localStorage.setItem("adminToken", data.token);
          alert("Logged in as admin");
          resetForm();
          onClose();
          setIsSignedIn(true);
          navigate("/product-manager-page");   // redirect to admin panel
          return;                              // no cart/profile work for admins
        }
  
        /* ---------- SALES-ADMIN ---------- */
        if (data.role === "salesAdmin") {
          localStorage.setItem("salesAdminToken", data.token);
          alert("Logged in as sales manager");
          resetForm();
          onClose();
          setIsSignedIn(true);
          navigate("/sales-manager-page");     // redirect to sales manager panel
          return;                              // skip cart/profile merge
        }
  
        /* ---------- REGULAR USER ---------- */
        localStorage.setItem("token", data.token);
        localStorage.setItem("showSaleNotification", "true");  // ← NEW
  
        try {
          /* fetch profile so we can cache it locally */
          const profileResp = await fetch("/user/profile", {
            headers: {
              "Authorization": `Bearer ${data.token}`,
              "Accept":        "application/json"
            }
          });
          if (!profileResp.ok) throw new Error("Profile fetch failed");
          const profileData = await profileResp.json();
          if (profileData.success) {
            localStorage.setItem("userData", JSON.stringify(profileData.data));
          }
        } catch (profileErr) {
          console.error("Profile fetch error:", profileErr);
          /* non-fatal – continue the flow */
        }
  
        // alert("Login successful");
        setIsSignedIn(true);
        await mergeCart(data.token);   // merge local cart with backend
        await refreshCart();           // reload cart context
        resetForm();
        onClose();
        navigate("/shop");
        return;
      }
  
      /* ────────── handle failure ────────── */
      const errorMessage = data.message || "Invalid email or password";
      alert(errorMessage);
  
    } catch (err) {
      console.error("Login error:", err);
      if (!navigator.onLine) {
        alert("Please check your internet connection");
      } else {
        alert("Server error. Please try again later");
      }
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      // Basic validation
      if (!fullName || !email || !password || !confirmPassword) {
        alert("Please fill in all required fields");
        return;
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alert("Please enter a valid email address");
        return;
      }

      if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
      }

      if (password.length < 6) {
        alert("Password must be at least 6 characters long");
        return;
      }

      const response = await fetch("/auth/register", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          name: fullName.trim(),
          mail_adress: email.trim(),
          password: password.trim(),
          phone_number: phone.trim(),
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        localStorage.setItem("token", data.token);

        try {
          const profileResponse = await fetch("/user/profile", {
            headers: {
              "Authorization": `Bearer ${data.token}`,
              "Accept": "application/json"
            }
          });
          
          if (!profileResponse.ok) {
            throw new Error("Failed to fetch profile data");
          }
          
          const profileData = await profileResponse.json();
          if (profileData.success) {
            localStorage.setItem("userData", JSON.stringify(profileData.data));
          }
        } catch (profileError) {
          console.error("Profile fetch error:", profileError);
          // Continue with registration even if profile fetch fails
        }

        alert("User registered successfully!");
        setIsSignedIn(true);
        await mergeCart(data.token);
        await refreshCart();
        resetForm();
        onClose();
        navigate("/shop");
      } else {
        const errorMessage = data.message || "Registration failed. Please try again.";
        alert(errorMessage);
      }
    } catch (error) {
      console.error("Registration error:", error);
      if (!navigator.onLine) {
        alert("Please check your internet connection");
      } else {
        alert("Server error. Please try again later");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <span className="close-button" onClick={onClose}>
          &times;
        </span>
        <div className="tabs">
          <button onClick={() => setActiveTab("login")}>Login</button>
          <button onClick={() => setActiveTab("signup")}>Sign Up</button>
        </div>

        {activeTab === "login" ? (
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="remember-me">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="rememberMe">Remember Me</label>
            </div>
            <button type="submit">Log In</button>
          </form>
        ) : (
          <form onSubmit={handleSignUp}>
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="tel"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <button type="submit">Sign Up</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default AuthModal;