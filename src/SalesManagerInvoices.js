// src/SalesManagerInvoices.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SalesManagerInvoices.css";

const getImage = (imageName) => {
  try {
    return require(`./assets/${imageName}`);
  } catch {
    return require("./assets/logo.png");
  }
};

const API_BASE =
  process.env.REACT_APP_API_BASE_URL?.replace(/\/$/, "") ||
  (window.location.hostname === "localhost"
    ? ""
    : "");

export default function SalesManagerInvoices() {
  const [orders, setOrders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAll, setShowAll] = useState(true);

  const navigate = useNavigate();
  const ordersPerPage = 6;

  /* ───────────────────── FETCH & SHAPE DATA ───────────────────── */
  useEffect(() => {
    (async () => {
      const adminToken = localStorage.getItem("salesAdminToken");
      if (!adminToken) return;

      try {
        const res = await fetch(`${API_BASE}/purchase/all`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const json = await res.json();
        if (!res.ok || !json.success) return;

        const grouped = {};
        json.data.forEach((p) => {
          const key = p.orderId || "NO_ORDER_ID";
          grouped[key] ??= [];
          grouped[key].push(p);
        });

        let filteredData = Object.entries(grouped).map(([orderId, items]) => {
          const ts = Number(orderId.split("-")[1]);
          const dateStr = !Number.isNaN(ts)
            ? new Date(ts).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : "Unknown date";

          const grandTotal = items.reduce(
            (t, it) =>
              t +
              (Number(it.totalPrice) ||
                (Number(it.productId?.price) || 0) * (it.quantity || 1)),
            0
          );

          const buyer = items[0].userId;
          const buyerLabel =
            buyer?.username || buyer?.email || buyer?._id || "Unknown user";

          return { orderId, items, dateStr, grandTotal, buyerLabel, timestamp: ts };
        });

        /* Apply date range filter */
        if (!showAll && startDate && endDate) {
          const start = new Date(startDate).getTime();
          const end = new Date(endDate).setHours(23, 59, 59, 999);

          filteredData = filteredData.filter(({ timestamp }) => {
            return timestamp >= start && timestamp <= end;
          });
        }

        filteredData.sort((a, b) => b.timestamp - a.timestamp);

        setOrders(filteredData);
        setTotalPages(Math.ceil(filteredData.length / ordersPerPage));
      } catch (err) {
        console.error("Error fetching all purchases:", err);
      }
    })();
  }, [startDate, endDate, showAll]);

  /* pagination helpers */
  const currLast = currentPage * ordersPerPage;
  const currFirst = currLast - ordersPerPage;
  const currOrders = orders.slice(currFirst, currLast);

  const prevPage = () => currentPage > 1 && setCurrentPage(currentPage - 1);
  const nextPage = () => currentPage < totalPages && setCurrentPage(currentPage + 1);
  const goPage = (n) => setCurrentPage(n);

  const handleShowAll = () => {
    setShowAll(true);
    setStartDate("");
    setEndDate("");
  };

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <div className="sales-invoices-page">
      <h2>All Orders (Sales-Manager View)</h2>
      <h2>(Start Date - End Date)</h2>

      {/* Date Range Filter */}
      <div className="date-filter">
        <div className="date-inputs">
          <input
            type="date"
            value={startDate}
            placeholder="Start Date"
            onChange={(e) => {
              setStartDate(e.target.value);
              setShowAll(false);
            }}
          />

          <input
            type="date"
            value={endDate}
            placeholder="End Date"
            onChange={(e) => {
              setEndDate(e.target.value);
              setShowAll(false);
            }}
          />

          <button className="show-all-btn" onClick={handleShowAll}>
            Show All
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="empty">No orders found in the selected date range.</p>
      ) : (
        <>
          {currOrders.map(({ orderId, items, dateStr, grandTotal, buyerLabel }) => {
            const thumbs = items.slice(0, 7);
            const extraCount = items.length - thumbs.length;

            const statusCounts = items.reduce((acc, it) => {
              acc[it.status] = (acc[it.status] || 0) + 1;
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
                  <div className="order-buyer">Buyer: {buyerLabel}</div>
                  <div className="order-total">
                    <strong>{grandTotal.toFixed(2)}&nbsp;EUR</strong>
                  </div>
                  <div className="order-status">{statusSummary}</div>
                </div>

                <div className="thumb-list">
                  {thumbs.map((it) => {
                    const src = it.productId?.image1
                      ? getImage(it.productId.image1)
                      : "https://via.placeholder.com/60x60?text=%20";
                    return (
                      <img
                        key={it._id}
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
                  onClick={() => navigate(`/admin-order/${orderId}`)}
                  aria-label="Details"
                >
                  &gt;
                </button>
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="pagination">
              <button onClick={prevPage} disabled={currentPage === 1}>
                &lt;
              </button>
              {[...Array(totalPages).keys()].map((i) => (
                <button
                  key={i + 1}
                  onClick={() => goPage(i + 1)}
                  className={currentPage === i + 1 ? "active" : ""}
                >
                  {i + 1}
                </button>
              ))}
              <button onClick={nextPage} disabled={currentPage === totalPages}>
                &gt;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
