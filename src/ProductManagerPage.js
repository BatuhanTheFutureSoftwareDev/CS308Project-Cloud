// src/ProductManagerPage.js
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./ProductManagerPage.css";

export default function ProductManagerPage() {
  const [cats, setCats]         = useState([]);
  const [products, setProducts] = useState([]);
  const [status, setStatus]     = useState({ msg: "", error: false });
  const [newCat, setNewCat]     = useState("");
  const [stockEdits, setStockEdits] = useState({});
  const [newProd, setNewProd]   = useState({
    name: "", category: "", color: "", description: "",
    stock: 10, image1: "", image2: "", image3: ""
  });

  const adminToken = localStorage.getItem("adminToken");
  const navigate   = useNavigate();

  /* ---------- load categories + products ---------- */
  const load = useCallback(async () => {
    const headers = { Authorization: `Bearer ${adminToken}` };

    const c = await fetch("/productmanager/categories",
                          { headers }).then(r => r.json());
    if (c.success) setCats(c.data);

    const p = await fetch("/productmanager/products",
                          { headers }).then(r => r.json());
    if (p.success) setProducts(p.data);
  }, [adminToken]);

  useEffect(() => { load(); }, [load]);

  /* ---------- category actions ---------- */
  const addCategory = async e => {
    e.preventDefault();
    const name = newCat.trim();
    if (!name) return;
    if (cats.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      setStatus({ msg:`Category "${name}" already exists.`, error:true });
      return;
    }
    const out = await fetch("/productmanager/categories", {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        Authorization:`Bearer ${adminToken}`
      },
      body: JSON.stringify({ name })
    }).then(r => r.json());

    setStatus({ msg: out.msg || `"${name}" added ✔`, error: !out.success });
    if (out.success) { setNewCat(""); load(); }
  };

  const delCategory = async name => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    const out = await fetch(
      `/productmanager/categories/${encodeURIComponent(name)}`,
      { method:"DELETE", headers:{ Authorization:`Bearer ${adminToken}` } }
    ).then(r => r.json());

    setStatus({ msg: out.msg, error: !out.success });
    if (out.success) load();
  };

  /* ---------- stock helpers ---------- */
  const handleStockChange = (id, val) =>
    setStockEdits(p => ({ ...p, [id]: val }));

  const updateStock = async id => {
    const s = Number(stockEdits[id]);
    if (Number.isNaN(s) || s < 0) {
      setStatus({ msg:"Invalid stock value.", error:true });
      return;
    }
    const out = await fetch(
      `/productmanager/products/${id}/stock`,
      {
        method:"PUT",
        headers:{
          "Content-Type":"application/json",
          Authorization:`Bearer ${adminToken}`
        },
        body: JSON.stringify({ stock:s })
      }
    ).then(r => r.json());

    setStatus({ msg: out.msg || "Failed to update stock.", error: !out.success });
    if (out.success) {
      setStockEdits(p => ({ ...p, [id]: undefined }));
      load();
    }
  };

  /* ---------- product actions ---------- */
  const removeProduct = async id => {
    if (!window.confirm("Remove this product?")) return;
    const out = await fetch(
      `/productmanager/products/${id}`,
      { method:"DELETE", headers:{ Authorization:`Bearer ${adminToken}` } }
    ).then(r => r.json());

    setStatus({ msg: out.msg, error: !out.success });
    if (out.success) load();
  };

  const addProduct = async e => {
    e.preventDefault();
    const { name, category, image1, image2, image3 } = newProd;
    if (!name.trim() || !category || !image1 || !image2 || !image3) {
      setStatus({ msg:"name, category and three image fields are required.",
                  error:true });
      return;
    }
    const out = await fetch("/productmanager/products",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          Authorization:`Bearer ${adminToken}`
        },
        body: JSON.stringify(newProd)   // no product_id sent
      }
    ).then(r => r.json());

    setStatus({ msg: out.msg || "Product added.", error: !out.success });
    if (out.success) {
      setNewProd({
        name:"", category:"", color:"", description:"",
        stock:10, image1:"", image2:"", image3:""
      });
      load();
    }
  };

  /* ─────────────────────────────────────────────────────────────────── */

  return (
    <div className="admin-page">
      <div className="admin-header-bar">
        <h1 className="admin-title">Product Manager</h1>

        <div className="admin-header-sections">
          <div className="admin-subsection">
            <h3 className="admin-subheading">Customers Purchases</h3>
            <button
              onClick={() => navigate("/product-manager-purchases")}
              className="pm-purchases-btn white-btn"
            >
              Purchases
            </button>
          </div>

          <div className="admin-subsection">
            <h3 className="admin-subheading">Add New Category</h3>
            <form onSubmit={addCategory} className="admin-add-form">
              <input
                className="admin-category-input"
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
                placeholder="New category name"
              />
              <button type="submit" className="admin-add-btn">Add</button>
            </form>
          </div>
        </div>

        {status.msg && (
          <p className={status.error ? "status error" : "status ok"}>{status.msg}</p>
        )}
      </div>

      <div className="admin-side-by-side">
        <div className="admin-section-box admin-half">
          <h2>Existing Categories</h2>
          <ul className="admin-cat-list">
            {cats.map(c => (
              <li className="admin-cat-item" key={c._id}>
                <div>{c.name}</div>
                <button
                  className="admin-delete-btn"
                  onClick={() => delCategory(c.name)}
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-section-box admin-half">
          <h2>Add New Product</h2>
          <form onSubmit={addProduct} className="admin-add-product-form">
            <select
              value={newProd.category}
              onChange={e =>
                setNewProd({ ...newProd, category: e.target.value })}
            >
              <option value="">Select category</option>
              {cats.map(c => (
                <option key={c._id} value={c.name}>{c.name}</option>
              ))}
            </select>

            <input
              placeholder="Name"
              value={newProd.name}
              onChange={e => setNewProd({ ...newProd, name: e.target.value })}
            />
            <input
              placeholder="Color (optional)"
              value={newProd.color}
              onChange={e => setNewProd({ ...newProd, color: e.target.value })}
            />
            <textarea
              placeholder="Description (optional)"
              value={newProd.description}
              onChange={e =>
                setNewProd({ ...newProd, description: e.target.value })}
            />
            <input
              placeholder="Initial stock"
              type="number"
              value={newProd.stock}
              onChange={e => setNewProd({ ...newProd, stock: e.target.value })}
            />
            <input
              placeholder="Image 1"
              value={newProd.image1}
              onChange={e => setNewProd({ ...newProd, image1: e.target.value })}
            />
            <input
              placeholder="Image 2"
              value={newProd.image2}
              onChange={e => setNewProd({ ...newProd, image2: e.target.value })}
            />
            <input
              placeholder="Image 3"
              value={newProd.image3}
              onChange={e => setNewProd({ ...newProd, image3: e.target.value })}
            />
            <button className="white-btn" type="submit">Add Product</button>
          </form>
        </div>
      </div>

      <div className="admin-section-box">
        <h2>Product Stock Management</h2>
        <ul className="admin-stock-list">
          {products.map(p => (
            <li className="admin-stock-item" key={p._id}>
              <div className="admin-stock-left">
                <strong>{p.name}</strong> (Stock: {p.stock})
              </div>

              <div className="admin-stock-right">
                <input
                  type="number" min="0"
                  value={stockEdits[p._id] ?? p.stock}
                  onChange={e => handleStockChange(p._id, e.target.value)}
                />
                <button onClick={() => updateStock(p._id)}>Update1</button>

                <button
                  className="admin-delete-btn"
                  onClick={() => removeProduct(p._id)}
                >
                  🗑
                </button>

                <button
                  className="admin-sikis-btn"
                  onClick={() => navigate(`/product-manager-reviews/${p._id}`)}
                >
                  ➜
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}