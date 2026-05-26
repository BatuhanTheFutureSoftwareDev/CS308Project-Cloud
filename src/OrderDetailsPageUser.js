import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import "./OrderDetailsPage.css";
import OrderDetailsPageAdmin from "./OrderDetailsPageAdmin";

const getImage = (imageName) => {
  try {
    return require(`./assets/${imageName}`);
  } catch {
    return require("./assets/logo.png");
  }
};

export default function OrderDetailsPageUser({ token }) {
  const { orderId } = useParams();
  const { state }   = useLocation();
  const navigate    = useNavigate();
  const [role, setRole] = useState(null);

  const [items, setItems]       = useState(state?.items || []);
  const [dateStr, setDateStr]   = useState(state?.dateStr || "");
  const [grandTotal, setTotal]  = useState(state?.grandTotal || 0);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [canceling, setCanceling] = useState({});
  const [cancelMsg, setCancelMsg] = useState({});
  const [refunding, setRefunding] = useState({});
  const [refundMsg, setRefundMsg] = useState({});
  const itemsPerPage = 5;

  useEffect(() => {
    const adminToken = localStorage.getItem("adminToken");
    const userToken = localStorage.getItem("token");
    let tokenToUse = adminToken || userToken;
    if (!tokenToUse) {
      setRole("none");
      return;
    }
    fetch("/auth/is-admin", {
      headers: { Authorization: `Bearer ${tokenToUse}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) setRole(data.isAdmin ? "admin" : "user");
        else setRole("user");
      })
      .catch(() => setRole("user"));
  }, []);

  useEffect(() => {
    if (items.length) {
      setTotalPages(Math.ceil(items.length / itemsPerPage));
      return;
    }
    (async () => {
      if (!token) return navigate("/home");
      try {
        const res  = await fetch("/purchase/user", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || !json.success) return;
        const filtered = json.data.filter((p) => p.orderId === orderId);
        setItems(filtered);
        setTotalPages(Math.ceil(filtered.length / itemsPerPage));
        const ts = Number(orderId.split("-")[1]);
        setDateStr(
          !Number.isNaN(ts)
            ? new Date(ts).toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" })
            : "Unknown date"
        );
        setTotal(
          filtered.reduce(
            (t, it) =>
              t +
              (Number(it.totalPrice) ||
                (Number(it.productId?.price) || 0) * (it.quantity || 1)),
            0
          )
        );
      } catch (e) {
        console.error("Error fetching order details:", e);
      }
    })();
  }, [items.length, orderId, navigate, token]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = items.slice(indexOfFirstItem, indexOfLastItem);
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const goToPreviousPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
  const goToNextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };

  const statusSummary = items.reduce((acc, it) => {
    acc[it.status] = (acc[it.status] || 0) + 1;
    return acc;
  }, {});
  const statusText = Object.entries(statusSummary)
    .map(([s, c]) => `${c} ${s.replace(/^\w/, (ch) => ch.toUpperCase())}`)
    .join(", ");

  const handleCancel = async (itemId) => {
    setCanceling(s => ({ ...s, [itemId]: true }));
    setCancelMsg(m => ({ ...m, [itemId]: "" }));
    try {
      const res = await fetch(`/purchase/${itemId}/cancel`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        // Remove the canceled item from the list
        setItems(items => items.filter(item => item._id !== itemId));
        // Update the total
        setTotal(total => {
          const item = items.find(i => i._id === itemId);
          return total - (item ? (Number(item.totalPrice) || (Number(item.productId?.price) || 0) * (item.quantity || 1)) : 0);
        });
        setCancelMsg(m => ({ ...m, [itemId]: "Canceled!" }));
      } else {
        setCancelMsg(m => ({ ...m, [itemId]: json.error || "Failed to cancel" }));
      }
    } catch (e) {
      setCancelMsg(m => ({ ...m, [itemId]: "Error canceling" }));
    }
    setCanceling(s => ({ ...s, [itemId]: false }));
  };

  const handleRefundRequest = async (itemId) => {
    setRefunding(s => ({ ...s, [itemId]: true }));
    setRefundMsg(m => ({ ...m, [itemId]: "" }));
    try {
      // Always get the latest user token from localStorage
      const userToken = localStorage.getItem("token");
      if (!userToken) {
        setRefundMsg(m => ({ ...m, [itemId]: "User not logged in" }));
        setRefunding(s => ({ ...s, [itemId]: false }));
        return;
      }
      const res = await fetch(`/api/refund/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          purchaseId: itemId,
          reason: "I want a refund because..." // Optionally, you can let the user enter a reason
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        // Update the item's refund status
        setItems(items => items.map(item => 
          item._id === itemId 
            ? { ...item, refundStatus: "requested", refundRequestDate: new Date() }
            : item
        ));
        setRefundMsg(m => ({ ...m, [itemId]: "Refund requested!" }));
      } else {
        setRefundMsg(m => ({ ...m, [itemId]: json.error || "Failed to request refund" }));
      }
    } catch (e) {
      setRefundMsg(m => ({ ...m, [itemId]: "Error requesting refund" }));
    }
    setRefunding(s => ({ ...s, [itemId]: false }));
  };

  if (role === null) return <div>Loading...</div>;
  if (role === "admin") return <OrderDetailsPageAdmin />;
  if (role === "user") return (
    <div className="order-details-page">
      <h2>Order Details</h2>
      <section className="order-meta">
        <div><strong>Date:</strong> {dateStr}</div>
        <div><strong>Order&nbsp;ID:</strong> {orderId}</div>
        <div><strong>Total:</strong> {grandTotal.toFixed(2)} EUR</div>
        {statusText && <div><strong>Status:</strong> {statusText}</div>}
      </section>
      <section className="order-items">
        {currentItems.map((it) => {
          const src = it.productId?.image1
            ? getImage(it.productId.image1)
            : it.productId?.imageUrl ||
              "https://via.placeholder.com/100x100?text=%20";
          const lineTotal =
            Number(it.totalPrice) ||
            (Number(it.productId?.price) || 0) * (it.quantity || 1);
          const delivered = it.status === "delivered";
          const processing = it.status === "processing";
          const refundRequested = it.refundStatus === "requested";
          const refundRejected = it.refundStatus === "rejected";
          const refunded = it.status === "refunded";

          return (
            <div key={it._id} className="order-item-card">
              <img src={src} alt={it.productId?.name} />
              <div className="item-info">
                <h4>{it.productId?.name || "Unknown Product"}</h4>
                <p className="purchase-id">Purchase&nbsp;ID:&nbsp;{it._id}</p>
                <p>Quantity:&nbsp;{it.quantity}</p>
                <p>Total:&nbsp;{lineTotal.toFixed(2)}&nbsp;EUR</p>
                <p className="status">{it.status}</p>
                {refundRequested && (
                  <p className="refund-status requested">Refund requested</p>
                )}
                {refundRejected && (
                  <p className="refund-status rejected">Refund rejected</p>
                )}
                {refunded && (
                  <p className="refunded-label">Refunded</p>
                )}
              </div>
              <div className="item-actions">
                {!refunded && processing && (
                  <button
                    className="cancel-btn"
                    onClick={() => handleCancel(it._id)}
                    disabled={canceling[it._id]}
                  >
                    {canceling[it._id] ? "Canceling..." : "Cancel"}
                  </button>
                )}
                {!refunded && delivered && !refundRequested && !refundRejected && (
                  <button
                    className="refund-btn"
                    onClick={() => handleRefundRequest(it._id)}
                    disabled={refunding[it._id]}
                  >
                    {refunding[it._id] ? "Requesting..." : "Request Refund"}
                  </button>
                )}
                {!refunded && (
                  <button
                    className={`review-btn ${delivered ? "" : "disabled"}`}
                    onClick={() => {
                      if (delivered) navigate(`/review/${it.productId?._id}`);
                    }}
                  >
                    Write&nbsp;Review
                  </button>
                )}
              </div>
              {cancelMsg[it._id] && (
                <span className={`cancel-msg ${cancelMsg[it._id] === "Canceled!" ? "success" : "error"}`}>
                  {cancelMsg[it._id]}
                </span>
              )}
              {refundMsg[it._id] && (
                <span className={`refund-msg ${refundMsg[it._id] === "Refund requested!" ? "success" : "error"}`}>
                  {refundMsg[it._id]}
                </span>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="empty">No items found for this order.</p>
        )}
        {totalPages > 1 && (
          <div className="pagination">
            <button 
              onClick={goToPreviousPage} 
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              &lt;
            </button>
            <div className="pagination-numbers">
              {[...Array(totalPages).keys()].map(number => (
                <button
                  key={number + 1}
                  onClick={() => paginate(number + 1)}
                  className={`pagination-number ${currentPage === number + 1 ? 'active' : ''}`}
                >
                  {number + 1}
                </button>
              ))}
            </div>
            <button 
              onClick={goToNextPage} 
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
  return <div>You are not logged in.</div>;
} 