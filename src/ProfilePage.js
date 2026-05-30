import React, { useEffect, useState } from "react";
import "./ProfilePage.css";

function ProfilePage({ isSignedIn, signOut }) {
  const [userInfo, setUserInfo] = useState({
    name: "Loading...",
    email: "Loading...",
    phoneNumber: "Loading...",
    address: "Loading...",
  });

  const [newAddress, setNewAddress] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSignedIn) return;

    const token = localStorage.getItem("token");
    if (!token) {
      signOut();
      return;
    }

    async function fetchUserInfo() {
      try {
        const res = await fetch("/user/info", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        if (data.success) {
          setUserInfo(data.data);
        }
      } catch (err) {
        console.error("Error fetching user info:", err);
      }
    }

    fetchUserInfo();
  }, [isSignedIn, signOut]);

  const handleUpdateAddress = async () => {
    setError("");
    const token = localStorage.getItem("token");

    if (!newAddress.trim()) {
      setError("Address cannot be empty or just spaces.");
      return;
    }

    try {
      const res = await fetch("/user/address", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ address: newAddress }),
      });

      const data = await res.json();
      if (data.success) {
        setUserInfo((prev) => ({ ...prev, address: data.address }));
        setNewAddress("");
        setIsUpdating(false);
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error("Error updating address:", err);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        <h1>User Information</h1>

        <div className="field">
          <span className="label">Name:</span>
          <span className="value">{userInfo.name}</span>
        </div>

        <div className="field">
          <span className="label">Email:</span>
          <span className="value">{userInfo.email}</span>
        </div>

        <div className="field">
          <span className="label">Phone:</span>
          <span className="value">{userInfo.phoneNumber}</span>
        </div>

        <div className="field">
          <span className="label">Address:</span>
          <span className="value">{userInfo.address}</span>
        </div>

        <button className="update-btn" onClick={() => setIsUpdating(true)}>
          Update Address
        </button>

        {isUpdating && (
          <div className="update-modal">
            <input
              type="text"
              placeholder="Enter new address"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
            />
            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button onClick={handleUpdateAddress}>Save</button>
              <button onClick={() => setIsUpdating(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
