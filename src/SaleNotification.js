import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SaleNotification.css";

const getImage = (img) => { if (typeof img === "string" && (img.startsWith("http://") || img.startsWith("https://"))) return img;
  try   { return require(`./assets/${img}`); }
  catch { return require("./assets/logo.png"); }
};

export default function SaleNotification() {
  const [items, setItems] = useState([]);
  const [show,  setShow]  = useState(false);
  const navigate          = useNavigate();

  /* one-shot popup */
  useEffect(() => {
    if (localStorage.getItem("showSaleNotification") !== "true") return;

    const t = setTimeout(async () => {
      const token = localStorage.getItem("token");
      if (!token) { localStorage.removeItem("showSaleNotification"); return; }

      try {
        const res  = await fetch("/wishlist",
                                 { headers:{ Authorization:`Bearer ${token}` } });
        const json = await res.json();

        if (json.success) {
          const discounted = json.data
            .map(w => (typeof w.productId === "object" ? w.productId : null))
            .filter(p => p && p.discountedPrice != null);

          if (discounted.length) { setItems(discounted); setShow(true); }
        }
      } catch (err) { console.error(err); }

      localStorage.removeItem("showSaleNotification");
    }, 1000);

    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  const openWishlist = () => navigate("/wishlist");
  const dismiss      = () => setShow(false);

  return (
    <div className={`sale-banner ${show ? "show" : ""}`}>
      <span className="sale-text" onClick={openWishlist}>
        {items.length === 1
          ? `${items[0].name} from your wishlist is discounted!`
          : `${items.length} wishlist items are on sale →`}
      </span>

      <div className="thumbs" onClick={openWishlist}>
        {items.slice(0, 4).map(p => (
          <img key={p._id} src={getImage(p.image1)} alt={p.name} />
        ))}
      </div>

      <button className="close-btn" onClick={dismiss}>×</button>
    </div>
  );
}