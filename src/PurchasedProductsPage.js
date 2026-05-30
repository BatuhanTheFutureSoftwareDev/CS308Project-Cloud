// PurchasedProductsPage.js — the shopper-side "My Orders" page.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PurchasedProductsPage.css";

const getImage = (imageName) => {
  if (typeof imageName === "string" && (imageName.startsWith("http://") || imageName.startsWith("https://"))) {
    return imageName;
  }
  if (!imageName) {
    try { return require("./assets/logo.png"); } catch { return ""; }
  }
  try { return require(`./assets/${imageName}`); }
  catch { try { return require("./assets/logo.png"); } catch { return ""; } }
};

export default function PurchasedProductsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 5;
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        setError("You must be logged in to view your orders.");
        return;
      }

      try {
        const res = await fetch("/purchase/user", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setLoading(false);
          setError(json.error || "Could not load your orders.");
          return;
        }

        // Group purchases by orderId, then enrich each group with date + total.
        const grouped = {};
        (json.data || []).forEach((p) => {
          const key = p.orderId || "NO_ORDER_ID";
          (grouped[key] ??= []).push(p);
        });

        const list = Object.entries(grouped).map(([orderId, items]) => {
          // orderId is generated server-side as "ORD-<ms>-<random>"; recover the ms.
          const ts = Number(String(orderId).split("-")[1]);
          let dateStr = "Unknown date";
          if (!Number.isNaN(ts) && ts > 0) {
            dateStr = new Date(ts).toLocaleDateString("en-GB", {
              day: "2-digit", month: "long", year: "numeric",
            });
          } else if (items[0]?.purchaseDate) {
            dateStr = new Date(items[0].purchaseDate).toLocaleDateString("en-GB", {
              day: "2-digit", month: "long", year: "numeric",
            });
          }

          const grandTotal = items.reduce((t, it) => {
            const line = Number(it.totalPrice);
            if (Number.isFinite(line)) return t + line;
            const unit = Number(it.productId?.price) || 0;
            const qty = Number(it.quantity) || 1;
            return t + unit * qty;
          }, 0);

          return { orderId, items, dateStr, grandTotal };
        });

        // Newest first.
        list.sort((a, b) => {
          const ta = Number(String(a.orderId).split("-")[1]) || 0;
          const tb = Number(String(b.orderId).split("-")[1]) || 0;
          return tb - ta;
        });

        setOrders(list);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching purchases:", err);
        setError(err.message || "Network error while loading orders.");
        setLoading(false);
      }
    })();
  }, []);

  const totalPages = Math.max(1, Math.ceil(orders.length / ordersPerPage));
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = orders.slice(indexOfFirstOrder, indexOfLastOrder);

  const paginate = (n) => setCurrentPage(n);
  const goPrev = () => currentPage > 1 && setCurrentPage(currentPage - 1);
  const goNext = () => currentPage < totalPages && setCurrentPage(currentPage + 1);

  if (loading) return <div className="purchased-page"><p>Loading your orders…</p></div>;
  if (error)   return <div className="purchased-page"><p className="empty">{error}</p></div>;

  return (
    <div className="purchased-page">
      <h2>Your Orders</h2>

      {orders.length === 0 ? (
        <p className="empty">You have not placed any orders yet.</p>
      ) : (
        <>
          {currentOrders.map(({ orderId, items, dateStr, grandTotal }) => {
            const thumbs = items.slice(0, 7);
            const extraCount = items.length - thumbs.length;

            const statusCounts = items.reduce((acc, it) => {
              const s = it.status || "unknown";
              acc[s] = (acc[s] || 0) + 1;
              return acc;
            }, {});
            const statusSummary = Object.entries(statusCounts)
              .map(([s, c]) => `${c} ${s.replace(/^\w/, (ch) => ch.toUpperCase())}`)
              .join(", ");

            return (
              <div key={orderId} className="order-row">
                <div className="order-info">
                  <div className="order-date">{dateStr}</div>
                  <div className="order-id">ID: {orderId}</div>
                  <div className="order-total">
                    <strong>{Number(grandTotal || 0).toFixed(2)}&nbsp;EUR</strong>
                  </div>
                  <div className="order-status">{statusSummary}</div>
                </div>

                <div className="thumb-list">
                  {thumbs.map((it) => {
                    const img1 = it.productId?.image1;
                    const src = img1
                      ? getImage(img1)
                      : (it.productId?.imageUrl || "https://via.placeholder.com/60x60?text=%20");
                    return (
                      <img
                        key={it._id || it.id || `${orderId}-${it.productId?.id || it.productId?._id || Math.random()}`}
                        src={src}
                        alt={it.productId?.name || "Product"}
                      />
                    );
                  })}
                  {extraCount > 0 && (
                    <span className="more-count">+{extraCount}&nbsp;more</span>
                  )}
                </div>

                <button
                  className="details-btn"
                  onClick={() =>
                    navigate(`/order/${orderId}`, {
                      state: { orderId, items, dateStr, grandTotal },
                    })
                  }
                  aria-label="Details"
                >
                  &gt;
                </button>
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="pagination">
              <button onClick={goPrev} disabled={currentPage === 1} className="pagination-btn">
                &lt;
              </button>
              <div className="pagination-numbers">
                {[...Array(totalPages).keys()].map((n) => (
                  <button
                    key={n + 1}
                    onClick={() => paginate(n + 1)}
                    className={`pagination-number ${currentPage === n + 1 ? "active" : ""}`}
                  >
                    {n + 1}
                  </button>
                ))}
              </div>
              <button onClick={goNext} disabled={currentPage === totalPages} className="pagination-btn">
                &gt;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
