import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SalesManagerPage.css";

export default function SalesManagerPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ msg: "", error: false });
  const [priceEdits, setPriceEdits] = useState({});
  const adminToken = localStorage.getItem("salesAdminToken");
  const navigate = useNavigate();

  const loadPendingProducts = async () => {
    try {
      const res = await fetch("/salesmanager/pending-products", {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const json = await res.json();
      if (json.success) setProducts(json.data);
      else setStatus({ msg: json.msg || "Error loading products", error: true });
    } catch (e) {
      setStatus({ msg: e.message, error: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingProducts();
  }, []);

  const handlePriceChange = (id, val) =>
    setPriceEdits((prev) => ({ ...prev, [id]: val }));

  const updatePrice = async (id) => {
    const price = Number(priceEdits[id]);
    if (isNaN(price) || price <= 0) {
      setStatus({ msg: "Price must be a positive number", error: true });
      return;
    }
    try {
      const res = await fetch(`/salesmanager/products/${id}/price`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ price }),
      });
      const json = await res.json();
      if (json.success) {
        setStatus({ msg: "Price updated successfully", error: false });
        setPriceEdits((prev) => ({ ...prev, [id]: undefined }));
        setProducts((prev) => prev.filter((p) => p._id !== id));
      } else {
        setStatus({ msg: json.msg || "Failed to update price", error: true });
      }
    } catch (e) {
      setStatus({ msg: e.message, error: true });
    }
  };

  if (loading) return <div className="sales-loading">Loading products…</div>;

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1 className="sales-title">Sales Manager</h1>
        <div className="sales-actions">
          <button onClick={() => navigate("/refund-requests")}>Refund Requests</button>
          <button onClick={() => navigate("/sales-manager-invoices")}>Invoices</button>
          <button onClick={() => navigate("/discount")}>Discount</button>
          <button onClick={() => navigate("/sales-manager-charts")}>Charts</button>
        </div>
        {status.msg && (
          <p className={`sales-status ${status.error ? "error" : "ok"}`}>
            {status.msg}
          </p>
        )}
      </div>

      <div className="sales-section">
        <h2>Products Awaiting Price Assignment</h2>
        {products.length === 0 ? (
          <p className="sales-empty">No products need pricing at this time.</p>
        ) : (
          <div className="sales-list">
            {products.map((product) => (
              <div className="sales-card" key={product._id}>
                <div className="sales-info">
                  <h3>{product.name}</h3>
                  {/* <p><strong>ID:</strong> {product.product_id}</p> */}
                  <p><strong>ID:</strong> {product._id}</p>
                  <p><strong>Category:</strong> {product.category}</p>
                  {product.color && <p><strong>Color:</strong> {product.color}</p>}
                  {product.description && <p><strong>Description:</strong> {product.description}</p>}
                  <p><strong>Stock:</strong> {product.stock}</p>
                </div>
                <div className="sales-price-form">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Enter price"
                    value={priceEdits[product._id] || ""}
                    onChange={(e) => handlePriceChange(product._id, e.target.value)}
                  />
                  <button onClick={() => updatePrice(product._id)}>Set Price</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
