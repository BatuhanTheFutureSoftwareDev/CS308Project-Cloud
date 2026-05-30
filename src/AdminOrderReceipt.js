// src/AdminOrderReceipt.js
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import "./AdminOrderReceipt.css";          /* ➜ minimal styles */

const API_BASE =
  process.env.REACT_APP_API_BASE_URL?.replace(/\/$/, "") ||
  (window.location.hostname === "localhost"
    ? ""
    : "");

export default function AdminOrderReceipt() {
  const { orderId } = useParams();
  const [pdf, setPdf] = useState(null);
  const [err, setErr] = useState(null);
  const navigate      = useNavigate();

  useEffect(() => {
    if (!orderId) { setErr("No order specified."); return; }

    const adminToken = localStorage.getItem("salesAdminToken");
    if (!adminToken) { setErr("Admin login required."); return; }

    (async () => {
      try {
        const res  = await fetch(`${API_BASE}/purchase/admin/receipt/${orderId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const data = await res.json();
        if (res.ok && data.success) setPdf(data.pdfBase64);
        else setErr(data.error || "Couldn’t fetch receipt.");
      } catch (e) { setErr("Network error."); }
    })();
  }, [orderId]);

  if (err) return (
    <div className="admin-receipt-page">
      <h2>🤔 {err}</h2>
      <button onClick={() => navigate(-1)}>Back</button>
    </div>
  );

  if (!pdf) return (
    <div className="admin-receipt-page"><h2>Loading receipt…</h2></div>
  );

  return (
    <div className="admin-receipt-page">
      <h2>Order&nbsp;<strong>{orderId}</strong></h2>

      <iframe
        title="Receipt PDF"
        className="receipt-iframe"
        src={`data:application/pdf;base64,${pdf}`}
      />

      <p style={{ marginTop:"1rem" }}>
        Download&nbsp;
        <a
          download={`receipt_${orderId}.pdf`}
          href={`data:application/pdf;base64,${pdf}`}
        >here</a>.
      </p>

      <Link to="/sales-manager-invoices">← Back to list</Link>
    </div>
  );
}