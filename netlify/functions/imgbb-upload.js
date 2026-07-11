"use strict";

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {"Content-Type": "application/json", Allow: "POST"},
      body: JSON.stringify({success: false, message: "Method not allowed"})
    };
  }

  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({success: false, message: "Image upload is not configured on the server."})
    };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const image = String(payload.image || "").replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    const name = String(payload.name || "product-image").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);

    if (!image) {
      return {
        statusCode: 400,
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({success: false, message: "No image was received."})
      };
    }

    const form = new URLSearchParams();
    form.set("image", image);
    form.set("name", name || "product-image");

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    });

    const body = await response.text();
    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({success: false, message: error.message || "Image upload failed."})
    };
  }
};
