// src/api.js

const API_URL = ''; // Backend URL

// Register User
export const registerUser = async (userData) => {
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      throw new Error('Failed to register user');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error registering user:', error);
    return { success: false, message: error.message };
  }
};

// Login User
export const loginUser = async (credentials) => {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error logging in user:', error);
    return { success: false, message: error.message };
  }
};

// Submit Review
export const submitReview = async (productId, reviewData, token) => {
  try {
    const response = await fetch(`${API_URL}/reviews/${productId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(reviewData),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error submitting review:', error);
    return { success: false, message: error.message };
  }
};

// Get Reviews
export const getReviews = async (productId) => {
  try {
    const response = await fetch(`${API_URL}/reviews/${productId}`);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return { success: false, message: error.message };
  }
};
