// src/SalesManagerRevenue.js
import React, { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import "./SalesManagerRevenue.css";

const API_BASE =
  process.env.REACT_APP_API_BASE_URL?.replace(/\/$/, "") ||
  (window.location.hostname === "localhost"
    ? ""
    : "");

export default function SalesManagerRevenue() {
  const [metrics,     setMetrics]     = useState([]);
  const [granularity, setGranularity] = useState("month");
  const [startDate,   setStartDate]   = useState("");
  const [endDate,     setEndDate]     = useState("");
  const [totals,      setTotals]      = useState({ revenue: 0, profit: 0 });

  /* ─────────────────────────── FETCH ─────────────────────────── */
  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("salesAdminToken");
      if (!token) return;

      const q = new URLSearchParams({ granularity });
      if (startDate) q.append("start", startDate);
      if (endDate)   q.append("end",   endDate);

      try {
        const res  = await fetch(`${API_BASE}/purchase/metrics?${q.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Fetch failed");

        setMetrics(json.data);
        /* compute grand totals */
        const rev = json.data.reduce((t, d) => t + d.revenue, 0);
        const pro = json.data.reduce((t, d) => t + d.profit,  0);
        setTotals({ revenue: rev.toFixed(2), profit: pro.toFixed(2) });
      } catch (err) {
        console.error("Error fetching metrics:", err);
      }
    })();
  }, [granularity, startDate, endDate]);

  // /* ─────────────────────────── UI ─────────────────────────── */
  // return (
  //   <div className="sales-revenue-page">
  //     <h2>Revenue & Profit Overview</h2>

  //     {/* Controls */}
  //     <div className="controls">
  //       <label>
  //         Granularity:&nbsp;
  //         <select value={granularity} onChange={(e)=>setGranularity(e.target.value)}>
  //           <option value="day">Daily</option>
  //           <option value="month">Monthly</option>
  //           <option value="year">Yearly</option>
  //         </select>
  //       </label>

  //       <input type="date" value={startDate}
  //              onChange={(e)=>setStartDate(e.target.value)} />
  //       <span style={{margin:"0 .5rem"}}>—</span>
  //       <input type="date" value={endDate}
  //              onChange={(e)=>setEndDate(e.target.value)} />

  //       <button onClick={()=>{setStartDate(""); setEndDate("");}}>
  //         Clear Range
  //       </button>
  //     </div>

  //     {/* Totals */}
  //     <div className="totals">
  //       <span>Total Revenue: <strong>{totals.revenue} EUR</strong></span>
  //       <span>Total Profit: <strong>{totals.profit} EUR</strong></span>
  //     </div>

  //     {/* Chart */}
  //     {metrics.length === 0 ? (
  //       <p className="empty">No data for selected range.</p>
  //     ) : (
  //       <ResponsiveContainer width="100%" height={400}>
  //         <LineChart data={metrics} margin={{ top:20, right:30, left:10, bottom:5 }}>
  //           <CartesianGrid strokeDasharray="3 3" />
  //           <XAxis dataKey="label" />
  //           <YAxis />
  //           <Tooltip />
  //           <Legend verticalAlign="top" height={36}/>
  //           <Line type="monotone" dataKey="revenue" strokeWidth={2} dot={false} />
  //           <Line type="monotone" dataKey="profit"  strokeWidth={2} dot={false} />
  //         </LineChart>
  //       </ResponsiveContainer>
  //     )}
  //   </div>
  // );

  /* …unchanged imports & state… */

  return (
    <div className="sales-revenue-page">
      <h2>Revenue & Profit Overview</h2>

      {/* Controls */}
      <div className="controls">
        <label>
          Granularity:&nbsp;
          <select value={granularity} onChange={(e)=>setGranularity(e.target.value)}>
            <option value="day">Daily</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </label>

        {/* date range inputs */}
        <input
          type="date"
          value={startDate}
          onChange={(e)=>setStartDate(e.target.value)}
        />
        <span className="date-dash">—</span>
        <input
          type="date"
          value={endDate}
          onChange={(e)=>setEndDate(e.target.value)}
        />

        <button onClick={()=>{ setStartDate(""); setEndDate(""); }}>
          Clear Range
        </button>
      </div>

      {/* Totals */}
      <div className="totals">
        <span>Total Revenue: <strong>{totals.revenue} EUR</strong></span>
        <span>Total Profit:  <strong>{totals.profit} EUR</strong></span>
      </div>

      {/* Chart */}
      {metrics.length === 0 ? (
        <p className="empty">No data for selected range.</p>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={metrics} margin={{ top:20, right:30, left:10, bottom:5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend verticalAlign="top" height={36}/>
            {/* blue revenue, green profit */}
            <Line type="monotone" dataKey="revenue" stroke="#2C7BE5" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="profit"  stroke="#27AE60" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}