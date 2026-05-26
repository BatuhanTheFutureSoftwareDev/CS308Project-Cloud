// src/Receipt.js
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import "./Receipt.css";

const API_BASE =
  process.env.REACT_APP_API_BASE_URL?.replace(/\/$/,"") ||
  (window.location.hostname==="localhost" ? "" : "");

export default function Receipt() {
  const { orderId } = useParams();
  const [pdf, setPdf] = useState(null);
  const [err, setErr] = useState(null);
  const navigate     = useNavigate();

  /* fetch once */
  useEffect(()=>{
    if (!orderId) { setErr("No order specified."); return; }

    const token = localStorage.getItem("token");
    if (!token) { navigate("/home"); return; }

    (async ()=>{
      try {
        const res  = await fetch(`${API_BASE}/purchase/receipt/${orderId}`, {
          headers:{ Authorization:`Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.success) setPdf(data.pdfBase64);
        else setErr(data.error||"Couldn’t fetch receipt.");
      } catch (e) { setErr("Network error."); }
    })();
  }, [orderId, navigate]);

  if (err) return (
    <div className="receipt-page"><h2>🤔 {err}</h2>
      <Link to="/shop" className="back-to-shop-btn">Back to Shop</Link>
    </div>
  );

  if (!pdf) return (
    <div className="receipt-page"><h2>Loading receipt…</h2></div>
  );

  return (
    <div className="receipt-page">
      <h2>🎉 Thank you for your purchase!</h2>
      <p>Order No: <strong>{orderId}</strong></p>

      <iframe
        title="Receipt PDF"
        className="receipt-iframe"
        src={`data:application/pdf;base64,${pdf}`}
      />

      <p style={{marginTop:"1rem"}}>
        Download&nbsp;
        <a download={`receipt_${orderId}.pdf`}
           href={`data:application/pdf;base64,${pdf}`}>here</a>.
      </p>

      <Link to="/purchased-products">View purchased products</Link> &nbsp;|&nbsp;
      <Link to="/shop" className="back-to-shop-btn">Continue Shopping</Link>
    </div>
  );
}