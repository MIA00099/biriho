"use strict";

(() => {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  const productsById = new Map();
  const whatsappNumber = "250788200521";

  const formatPrice = value => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0
      ? `${number.toLocaleString("en-US", {maximumFractionDigits: 2})} RWF`
      : null;
  };

  function ensureStyles() {
    if (document.getElementById("biriho-price-styles")) return;
    const style = document.createElement("style");
    style.id = "biriho-price-styles";
    style.textContent = `.product-price{margin-top:12px;font-size:1.14rem;font-weight:950;letter-spacing:-.025em;color:#0d1525}.product-price.price-request{font-size:.78rem;color:#667085;letter-spacing:0}.product-price-label{display:block;margin-bottom:2px;color:#667085;font-size:.62rem;font-weight:900;letter-spacing:.07em;text-transform:uppercase}`;
    document.head.appendChild(style);
  }

  async function readShopConfig() {
    const source = await fetch("assets/shop.js", {cache: "no-store"}).then(response => {
      if (!response.ok) throw new Error("Could not read shop configuration");
      return response.text();
    });
    const url = source.match(/const\s+SUPABASE_URL\s*=\s*["']([^"']+)["']/)?.[1];
    const key = source.match(/const\s+SUPABASE_ANON_KEY\s*=\s*["']([^"']+)["']/)?.[1];
    if (!url || !key) throw new Error("Supabase configuration is missing");
    return {url, key};
  }

  async function loadPrices() {
    const {url, key} = await readShopConfig();
    const response = await fetch(`${url}/rest/v1/products?select=id,name,price`, {
      headers: {apikey: key, Authorization: `Bearer ${key}`}
    });
    if (!response.ok) throw new Error("Could not load product prices");
    const products = await response.json();
    products.forEach(product => productsById.set(String(product.id), product));
    decorateCards();
  }

  function decorateCards() {
    grid.querySelectorAll(".product-card").forEach(card => {
      const button = card.querySelector("button[data-product-id]");
      const body = card.querySelector(".product-body");
      if (!button || !body) return;
      const product = productsById.get(button.dataset.productId);
      if (!product) return;

      const formatted = formatPrice(product.price);
      const nextClass = `product-price${formatted ? "" : " price-request"}`;
      const nextContent = `<span class="product-price-label">Price</span>${formatted || "Price on request"}`;
      let price = body.querySelector(".product-price");

      if (!price) {
        price = document.createElement("div");
        const specs = body.querySelector(".specs");
        body.insertBefore(price, specs || body.querySelector(".ask-btn"));
      }

      if (price.className !== nextClass) price.className = nextClass;
      if (price.innerHTML !== nextContent) price.innerHTML = nextContent;
    });
  }

  grid.addEventListener("click", event => {
    const button = event.target.closest("button[data-product-id]");
    if (!button) return;
    const product = productsById.get(button.dataset.productId);
    if (!product) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const card = button.closest(".product-card");
    const size = card?.querySelector(".size-select")?.value;
    const price = formatPrice(product.price);
    const message = `Hello Biriho Shop, I want to buy ${product.name}${size ? ` in ${size}` : ""}.${price ? ` The listed price is ${price}.` : " Please tell me the price."} Please confirm availability, warranty and delivery information.`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }, true);

  ensureStyles();

  // The storefront replaces the direct children of productGrid after searches
  // and category changes. Observing only direct children avoids a self-triggering
  // loop when the price element itself is inserted or updated inside a card.
  const observer = new MutationObserver(decorateCards);
  observer.observe(grid, {childList: true});

  loadPrices().catch(error => console.warn("Price feature:", error.message));
})();
