// OrderDetailsPageAdmin.js
import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import "./OrderDetailsPage.css";

const DELIVERY_OPTIONS = [
  { value: "processing", label: "Processing" },
  { value: "in-transit", label: "In-Transit" },
  { value: "delivered", label: "Delivered" },
];

const getImage = (imageName) => { if (typeof imageName === "string" && (imageName.startsWith("http://") || imageName.startsWith("https://"))) return imageName;
  try   { return require(`./assets/${imageName}`); }
  catch { return require("./assets/logo.png"); }
};

export default function OrderDetailsPageAdmin({ token }) {
  const { orderId }         = useParams();
  const { state }           = useLocation();
  const navigate            = useNavigate();

  const [items, setItems]   = useState(state?.items || []);
  const [dateStr, setDate]  = useState(state?.dateStr || "");
  const [grandTotal, setGrandTotal] = useState(state?.grandTotal || 0);

  /* pagination */
  const [currentPage, setPage] = useState(1);
  const itemsPerPage           = 5;
  const [totalPages, setTP]    = useState(1);

  /* delivery-status edits */
  const [statusEdits, setEdits] = useState({});
  const [saving, setSaving]     = useState({});
  const [saveMsg, setSaveMsg]   = useState({});

  /* ─────────────  Fetch order once  ───────────── */
  useEffect(() => {
    if (items.length) {
      setTP(Math.ceil(items.length / itemsPerPage));
      return;
    }
    (async () => {
      if (!token) return navigate("/home");
      try {
        const res  = await fetch("/purchase/all", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || !json.success) return;

        const filtered = json.data.filter((p) => p.orderId === orderId);
        setItems(filtered);
        setTP(Math.ceil(filtered.length / itemsPerPage));

        const ts = Number(orderId.split("-")[1]);
        setDate(
          !Number.isNaN(ts)
            ? new Date(ts).toLocaleDateString("en-GB",
                { day:"2-digit", month:"long", year:"numeric" })
            : "Unknown date"
        );

        setGrandTotal(filtered.reduce(
          (t, it) =>
            t + (Number(it.totalPrice) ||
                 (Number(it.productId?.price) || 0) * (it.quantity || 1)),
          0
        ));
      } catch (err) {
        console.error("Error fetching order details:", err);
      }
    })();
  }, [items.length, orderId, navigate, token]);

  /* helpers ---------------------------------------------------------- */
  const indexLast   = currentPage * itemsPerPage;
  const current     = items.slice(indexLast - itemsPerPage, indexLast);
  const paginate    = (n) => setPage(n);
  const prevPage    = () => currentPage > 1 && setPage(currentPage - 1);
  const nextPage    = () => currentPage < totalPages && setPage(currentPage + 1);

  const statusSummary = items.reduce((acc, it) => {
    acc[it.status] = (acc[it.status] || 0) + 1;
    return acc;
  }, {});
  const statusText = Object.entries(statusSummary)
    .map(([s, c]) => `${c} ${s.charAt(0).toUpperCase() + s.slice(1)}`)
    .join(", ");

  /* ────────────────────────────────────────────────────────────────── */
  return (
    <div className="order-details-page">
      <h2>Order Details</h2>

      <section className="order-meta">
        <div><strong>Date:</strong> {dateStr}</div>
        <div><strong>Order&nbsp;ID:</strong> {orderId}</div>
        <div><strong>Total:</strong> {grandTotal.toFixed(2)} EUR</div>
        {statusText && <div><strong>Status:</strong> {statusText}</div>}
      </section>

      <section className="order-items">
        {current.map((it) => {
          const src = it.productId?.image1
            ? getImage(it.productId.image1)
            : it.productId?.imageUrl ||
              "https://via.placeholder.com/100x100?text=%20";

          const lineTotal =
            Number(it.totalPrice) ||
            (Number(it.productId?.price) || 0) * (it.quantity || 1);

          return (
            <div key={it._id} className="order-item-card">
              <img src={src} alt={it.productId?.name || "Product"} />
              <div className="item-info">
                <h4>{it.productId?.name || "Unknown Product"}</h4>
                <p className="purchase-id">Purchase&nbsp;ID:&nbsp;{it._id}</p>
                <p>Quantity:&nbsp;{it.quantity}</p>
                <p>Total:&nbsp;{lineTotal.toFixed(2)}&nbsp;EUR</p>

                <div style={{ marginTop: 8 }}>
                  <label>
                    <strong>Change Delivery Status:&nbsp;</strong>
                    <select
                      value={statusEdits[it._id] ?? it.status}
                      onChange={(e) =>
                        setEdits((s) => ({ ...s, [it._id]: e.target.value }))
                      }
                      disabled={saving[it._id]}
                    >
                      {DELIVERY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    style={{ marginLeft: 8 }}
                    disabled={
                      saving[it._id] ||
                      (statusEdits[it._id] ?? it.status) === it.status
                    }
                    onClick={async () => {
                      setSaving((s) => ({ ...s, [it._id]: true }));
                      setSaveMsg((m) => ({ ...m, [it._id]: "" }));
                      try {
                        const res = await fetch(
                          `/purchase/${it._id}/status`,
                          {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                              status: statusEdits[it._id] ?? it.status,
                            }),
                          }
                        );
                        const json = await res.json();
                        if (res.ok && json.success) {
                          setItems((arr) =>
                            arr.map((p) =>
                              p._id === it._id
                                ? { ...p, status: statusEdits[it._id] }
                                : p
                            )
                          );
                          setSaveMsg((m) => ({ ...m, [it._id]: "Updated!" }));
                        } else {
                          setSaveMsg((m) => ({
                            ...m,
                            [it._id]: json.error || "Failed",
                          }));
                        }
                      } catch {
                        setSaveMsg((m) => ({ ...m, [it._id]: "Error" }));
                      }
                      setSaving((s) => ({ ...s, [it._id]: false }));
                    }}
                  >
                    Save
                  </button>

                  {saveMsg[it._id] && (
                    <span
                      style={{
                        marginLeft: 8,
                        color:
                          saveMsg[it._id] === "Updated!" ? "green" : "red",
                      }}
                    >
                      {saveMsg[it._id]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <p className="empty">No items found for this order.</p>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button
              onClick={prevPage}
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              &lt;
            </button>

            <div className="pagination-numbers">
              {[...Array(totalPages).keys()].map((n) => (
                <button
                  key={n + 1}
                  onClick={() => paginate(n + 1)}
                  className={`pagination-number ${
                    currentPage === n + 1 ? "active" : ""
                  }`}
                >
                  {n + 1}
                </button>
              ))}
            </div>

            <button
              onClick={nextPage}
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              &gt;
            </button>
          </div>
        )}
      </section>
    </div>
  );
}