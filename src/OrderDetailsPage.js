// src/OrderDetailsPage.js
import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import "./OrderDetailsPage.css";
import { fetchReviews } from "./api/reviews";
import OrderDetailsPageAdmin from "./OrderDetailsPageAdmin";
import OrderDetailsPageUser from "./OrderDetailsPageUser";

const getImage = (imageName) => { if (typeof imageName === "string" && (imageName.startsWith("http://") || imageName.startsWith("https://"))) return imageName;
  try {
    return require(`./assets/${imageName}`);
  } catch {
    return require("./assets/logo.png");
  }
};

const STATUS_OPTIONS = [
  { value: "processing", label: "Processing" },
  { value: "in-transit", label: "In-Transit" },
  { value: "delivered", label: "Delivered" },
];

export default function OrderDetailsPage() {
  const { orderId } = useParams();
  const { state }   = useLocation();
  const navigate    = useNavigate();

  const [items, setItems]       = useState(state?.items || []);
  const [dateStr, setDateStr]   = useState(state?.dateStr || "");
  const [grandTotal, setTotal]  = useState(state?.grandTotal || 0);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 5; // Keeping at 5 as confirmed

  const [statusEdits, setStatusEdits] = useState({});
  const [saving, setSaving] = useState({});
  const [saveMsg, setSaveMsg] = useState({});
  const [role, setRole] = useState(null);
  const [token, setToken] = useState(null);

  const [productReviews, setProductReviews] = useState({}); // { productId: [reviews] }
  const [reviewSaving, setReviewSaving] = useState({});
  const [reviewMsg, setReviewMsg] = useState({});

  /* fetch if state is missing */
  useEffect(() => {
    if (items.length) {
      // Calculate total pages based on items length
      setTotalPages(Math.ceil(items.length / itemsPerPage));
      return;
    }

    (async () => {
      const token = localStorage.getItem("token");
      if (!token) return navigate("/home");

      try {
        const res  = await fetch("/purchase/user", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || !json.success) return;

        const filtered = json.data.filter((p) => p.orderId === orderId);
        setItems(filtered);
        
        // Calculate total pages based on filtered items
        setTotalPages(Math.ceil(filtered.length / itemsPerPage));

        const ts = Number(orderId.split("-")[1]);
        setDateStr(
          !Number.isNaN(ts)
            ? new Date(ts).toLocaleDateString("en-GB",
                { day:"2-digit", month:"long", year:"numeric" })
            : "Unknown date"
        );
        setTotal(
          filtered.reduce(
            (t, it) => {
              // First try to use totalPrice if available
              if (Number(it.totalPrice)) {
                return t + Number(it.totalPrice);
              }
              // Then try to use discountedPrice if available
              if (it.discountedPrice) {
                return t + (it.discountedPrice * (it.quantity || 1));
              }
              // Finally fall back to product price
              return t + ((Number(it.productId?.price) || 0) * (it.quantity || 1));
            },
            0
          )
        );
      } catch (e) {
        console.error("Error fetching order details:", e);
      }
    })();
  }, [items.length, orderId, navigate]);

  // Fetch reviews for all products in the order (admin only)
  useEffect(() => {
    if (!role || !items.length) return;
    const userId = items[0]?.userId?._id || items[0]?.userId || items[0]?.user?._id;
    const fetchAll = async () => {
      const reviewsByProduct = {};
      for (const it of items) {
        const res = await fetchReviews(it.productId?._id || it.productId);
        if (res.success) {
          reviewsByProduct[it.productId?._id || it.productId] = res.data;
        }
      }
      setProductReviews(reviewsByProduct);
    };
    fetchAll();
    // eslint-disable-next-line
  }, [role, items]);

  // Get current page items
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = items.slice(indexOfFirstItem, indexOfLastItem);

  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  
  // Previous page
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  // Next page
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  /* status breakdown */
  const statusSummary = items.reduce((acc, it) => {
    acc[it.status] = (acc[it.status] || 0) + 1;
    return acc;
  }, {});
  const statusText = Object.entries(statusSummary)
    .map(([s, c]) => `${c} ${s.replace(/^\w/, (ch) => ch.toUpperCase())}`)
    .join(", ");

  useEffect(() => {
    const adminToken = localStorage.getItem("adminToken");
    const userToken = localStorage.getItem("token");
    let tokenToUse = adminToken || userToken;
    setToken(tokenToUse);
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

  if (role === null) return <div>Loading...</div>;
  if (role === "admin") return <OrderDetailsPageAdmin token={token} />;
  if (role === "user") return <OrderDetailsPageUser token={token} />;
  return <div>You are not logged in.</div>;
}