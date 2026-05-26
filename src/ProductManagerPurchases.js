import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function getImage(imageName) {
  try {
    return require(`./assets/${imageName}`);
  } catch {
    return require("./assets/logo.png");
  }
}

export default function ProductManagerPurchases() {
  const [orders, setOrders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ordersPerPage = 5;
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const adminToken = localStorage.getItem("adminToken");
      if (!adminToken) return;
      try {
        const res = await fetch("/purchase/all", {
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

        const list = Object.entries(grouped).map(([orderId, items]) => {
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

          const user = items[0]?.userId;

          return { orderId, items, dateStr, grandTotal, user };
        });

        list.sort((a, b) => Number(b.orderId.split("-")[1]) - Number(a.orderId.split("-")[1]));
        setOrders(list);
        setTotalPages(Math.ceil(list.length / ordersPerPage));
      } catch (err) {
        console.error("Error fetching all purchases:", err);
      }
    })();
  }, []);

  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = orders.slice(indexOfFirstOrder, indexOfLastOrder);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const goToPreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };
  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  return (
    <div className="purchased-page">
      <h2>All Customer Orders</h2>
      {orders.length === 0 ? (
        <p className="empty">No purchases found.</p>
      ) : (
        <>
          {currentOrders.map(({ orderId, items, dateStr, grandTotal, user }) => {
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
                  <div className="order-total">
                    <strong>{grandTotal.toFixed(2)}&nbsp;EUR</strong>
                  </div>
                  <div className="order-status">{statusSummary}</div>
                  <div className="order-user">
                    {user?.name ? (
                      <>
                        <span>User: {user.name} ({user.mail_adress})</span>
                        <br />
                        <span>Address: {user.address || "No address provided"}</span>
                      </>
                    ) : (
                      <span>User: Unknown</span>
                    )}
                  </div>
                </div>

                <div className="thumb-list">
                  {thumbs.map((it) => {
                    const src = it.productId?.image1
                      ? getImage(it.productId.image1)
                      : it.productId?.imageUrl ||
                        "https://via.placeholder.com/60x60?text=%20";
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
                  onClick={() =>
                    navigate(`/order/${orderId}`, {
                      state: { orderId, items, dateStr, grandTotal, user },
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
              <button onClick={goToPreviousPage} disabled={currentPage === 1} className="pagination-btn">
                &lt;
              </button>
              <div className="pagination-numbers">
                {[...Array(totalPages).keys()].map((number) => (
                  <button
                    key={number + 1}
                    onClick={() => paginate(number + 1)}
                    className={`pagination-number ${currentPage === number + 1 ? "active" : ""}`}
                  >
                    {number + 1}
                  </button>
                ))}
              </div>
              <button onClick={goToNextPage} disabled={currentPage === totalPages} className="pagination-btn">
                &gt;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
