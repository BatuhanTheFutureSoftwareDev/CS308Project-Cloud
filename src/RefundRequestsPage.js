import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./RefundRequestsPage.css";

// Add getImage helper
const getImage = (imageName) => {
  try {
    return require(`./assets/${imageName}`);
  } catch {
    return require("./assets/logo.png");
  }
};

const RefundRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem("salesAdminToken");
      const response = await fetch("/api/refund/all", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch refund requests");
      }

      const data = await response.json();
      setRequests(data.data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleRefundAction = async (requestId, action) => {
    try {
      setProcessing({ ...processing, [requestId]: true });
      const token = localStorage.getItem("salesAdminToken");
      const response = await fetch(`/api/refund/${requestId}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} refund request`);
      }

      // Update the requests list
      setRequests(requests.map(request => 
        request._id === requestId 
          ? { ...request, status: action === "approve" ? "approved" : "rejected" }
          : request
      ));
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing({ ...processing, [requestId]: false });
    }
  };

  if (loading) return <div className="loading">Loading refund requests...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="refund-requests-page">
      <h1>Refund Requests</h1>
      <div className="requests-list">
        {requests.length === 0 ? (
          <p className="no-requests">No pending refund requests</p>
        ) : (
          requests.map((request) => (
            <div key={request._id} className="request-card">
              <div className="request-header">
                <h3>Order #{request.orderId}</h3>
                <span className={`status ${request.status}`}>{request.status}</span>
              </div>
              
              <div className="request-details">
                <div className="product-info">
                  <img src={getImage(request.productId?.image1)} alt={request.productId?.name || "Product"} />
                  <div>
                    <h4>{request.productId?.name || "Unknown Product"}</h4>
                    <p>Quantity: {request.quantity}</p>
                    <p>Total Price: {request.totalPrice} EUR</p>
                  </div>
                </div>

                <div className="user-info">
                  <p>Requested by: {request.userId.name}</p>
                  <p>Email: {request.userId.mail_adress}</p>
                  <p>Request Date: {new Date(request.requestDate).toLocaleDateString()}</p>
                </div>

                {request.status === "pending" && (
                  <div className="admin-actions">
                    <div className="action-buttons">
                      <button
                        className="approve-btn"
                        onClick={() => handleRefundAction(request._id, "approve")}
                        disabled={processing[request._id]}
                      >
                        {processing[request._id] ? "Processing..." : "Approve"}
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() => handleRefundAction(request._id, "reject")}
                        disabled={processing[request._id]}
                      >
                        {processing[request._id] ? "Processing..." : "Reject"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RefundRequestsPage;