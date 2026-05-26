// ProductReviewAdmin.js
import React, { useEffect, useState } from "react";
import { fetchReviews } from "./api/reviews";   // existing helper

/**
 * Admin-only component.
 * Props:
 *   • productId : string   – product to manage
 *   • token     : string   – JWT for auth
 */
export default function ProductReviewAdmin({ productId, token }) {
  const [reviews, setReviews]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState({});
  const [statusMsg, setStatusMsg]   = useState({});

  /* fetch once per product --------------------------------------------------- */
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      const res = await fetchReviews(productId, token);
      if (isMounted && res.success) setReviews(res.data || []);
      setLoading(false);
    })();
    return () => { isMounted = false; };
  }, [productId, token]);

  if (loading)   return <p>Loading reviews…</p>;
  if (!reviews.length)
    return <p style={{ color:"#777" }}><em>No reviews for this product.</em></p>;

  const pending = reviews.filter(r => r.status === "pending");
  if (!pending.length)
    return <p style={{ color:"#777" }}><em>No pending reviews.</em></p>;

  /* ────────────────────────────────────────────────────────────────────────── */
  return (
    <div style={{ background:"#f8f8f8", padding:12, borderRadius:6, marginTop:16 }}>
      <strong>Pending Reviews:</strong>
      {pending.map(r => (
        <div key={r._id}
             style={{ padding:"8px 0", borderBottom:"1px solid #eee" }}>
          <div>Rating: {r.rating} / 5</div>
          <div>Comment: {r.comment || <em>No comment</em>}</div>

          <label style={{ marginTop:4, display:"block" }}>
            <strong>Status:&nbsp;</strong>
            <select
              value={r.status}
              disabled={saving[r._id]}
              onChange={async (e) => {
                const newStatus = e.target.value;
                setSaving(s => ({ ...s, [r._id]: true }));
                setStatusMsg(m => ({ ...m, [r._id]: "" }));
                try {
                  const res = await fetch(
                    `/reviews/${r._id}/${newStatus === "approved" ? "approve" : "decline"}`,
                    {
                      method : "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization : `Bearer ${token}`,
                      },
                    }
                  );
                  const json = await res.json();
                  if (res.ok && json.success) {
                    setReviews(list =>
                      list.map(x =>
                        x._id === r._id ? { ...x, status:newStatus } : x));
                    setStatusMsg(m => ({ ...m, [r._id]:"Updated!" }));
                  } else {
                    setStatusMsg(m => ({ ...m, [r._id]:
                      json.error || "Failed" }));
                  }
                } catch {
                  setStatusMsg(m => ({ ...m, [r._id]:"Error" }));
                }
                setSaving(s => ({ ...s, [r._id]: false }));
              }}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approve</option>
              <option value="declined">Decline</option>
            </select>

            {statusMsg[r._id] && (
              <span style={{ marginLeft:8,
                             color: statusMsg[r._id] === "Updated!"
                                    ? "green" : "red" }}>
                {statusMsg[r._id]}
              </span>
            )}
          </label>
        </div>
      ))}
    </div>
  );
}