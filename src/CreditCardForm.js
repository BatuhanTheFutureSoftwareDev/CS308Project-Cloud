// src/CreditCardForm.js
import React, { useState } from "react";
import { useNavigate }      from "react-router-dom";
import { useCart }          from "./CartContext";
import "./CreditCardForm.css";

const API_BASE =
  process.env.REACT_APP_API_BASE_URL?.replace(/\/$/,"") ||
  (window.location.hostname==="localhost" ? "" : "");

export default function CreditCardForm() {
  const { cart, clearCart } = useCart();
  const navigate = useNavigate();

  const [cardNumber, setCardNumber] = useState("");
  const [cvv,        setCvv]        = useState("");
  const [expiry,     setExpiry]     = useState("");
  const [err,        setErr]        = useState("");

  const submit = async e => {
    e.preventDefault(); setErr("");
    if (!cardNumber||!cvv||!expiry)      return setErr("Fill every field.");
    if (!cart.length)                    return setErr("Your cart is empty.");
    const token = localStorage.getItem("token");
    if (!token)                          return setErr("Please log in.");

    /* we still send items, but the backend now ignores them – harmless */
    const items = cart.map(i=>({ productId:i.id||i._id, quantity:i.quantity, totalPrice:i.price*i.quantity }));

    const res  = await fetch(`${API_BASE}/purchase`, {
      method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      body:JSON.stringify({ items })
    });
    const data = await res.json();
    if (!res.ok || !data.success) return setErr(data.error||"Payment failed.");

    clearCart();
    /* ➜ orderId only */
    navigate(`/receipt/${data.orderId}`);
  };

  return (
    <div className="credit-card-form">
      <h2>Enter Credit Card Information</h2>
      <form onSubmit={submit}>
        {/* …inputs identical… */}
        <div className="form-group">
          <label>Card Number:</label>
          <input maxLength={16} value={cardNumber} onChange={e=>setCardNumber(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>CVV:</label>
          <input maxLength={3} value={cvv} onChange={e=>setCvv(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Expiration (MM/YY):</label>
          <input maxLength={5} placeholder="MM/YY" value={expiry} onChange={e=>setExpiry(e.target.value)} required />
        </div>
        {err && <p className="error-message">{err}</p>}
        <button type="submit" className="pay-button">Pay Now</button>
      </form>
    </div>
  );
}