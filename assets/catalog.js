"use strict";

(() => {
  const WHATSAPP_NUMBER = "250788200521";
  const CACHE_KEY = "biriho_catalog_cache_v3";
  const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=900&q=82";

  const productGrid = document.getElementById("productGrid");
  const departmentRow = document.getElementById("departmentRow");
  const departmentSelect = document.getElementById("departmentSelect");
  const searchInput = document.getElementById("searchInput");
  const searchForm = document.getElementById("searchForm");

  let products = [];
  let departments = [];
  let activeDepartment = "All";
  let searchTerm = "";
  let renderFrame = 0;
  let searchTimer = 0;
  let supabaseUrl = "";
  let supabaseKey = "";
  const productsById = new Map();

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));

  const normalizeArray = value => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return value.split(",").map(item => item.trim()).filter(Boolean);
  };

  const formatPrice = value => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0
      ? `${number.toLocaleString("en-US", { maximumFractionDigits: 2 })} RWF`
      : null;
  };

  const waLink = message => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  function setGeneralWhatsAppLinks() {
    const message = "Hello Biriho Shop, I visited your website and I want to buy a product. Please show me the available options, warranty and delivery information.";
    ["headerWhatsapp", "heroWhatsapp", "ctaWhatsapp", "footerWhatsapp", "floatingWhatsapp", "mobileNavWhatsapp"].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.href = waLink(message);
    });
  }

  async function readShopConfig() {
    const response = await fetch("assets/shop.js", { cache: "force-cache" });
    if (!response.ok) throw new Error("Could not read the shop configuration.");
    const source = await response.text();
    supabaseUrl = source.match(/const\s+SUPABASE_URL\s*=\s*["']([^"']+)["']/)?.[1] || "";
    supabaseKey = source.match(/const\s+SUPABASE_ANON_KEY\s*=\s*["']([^"']+)["']/)?.[1] || "";
    if (!supabaseUrl || !supabaseKey) throw new Error("Supabase configuration is missing.");
  }

  async function supabaseGet(table, query) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json"
      },
      cache: "no-store"
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || `Request failed (${response.status})`);
    return data || [];
  }

  function applyCatalog(productData, departmentData) {
    products = (productData || []).filter(product => product.hidden !== true);
    departments = departmentData || [];
    productsById.clear();
    products.forEach(product => productsById.set(String(product.id), product));
    buildDepartmentUI();
    scheduleRender();
  }

  function readCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!cached || !Array.isArray(cached.products) || !Array.isArray(cached.departments)) return false;
      applyCatalog(cached.products, cached.departments);
      return true;
    } catch {
      localStorage.removeItem(CACHE_KEY);
      return false;
    }
  }

  function writeCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ products, departments, savedAt: Date.now() }));
    } catch {}
  }

  function departmentNames() {
    return ["All", ...new Set([
      ...departments.map(department => department.name),
      ...products.map(product => product.department)
    ].filter(Boolean))];
  }

  function buildDepartmentUI() {
    const names = departmentNames();
    if (!names.includes(activeDepartment)) activeDepartment = "All";

    departmentRow.innerHTML = names.map(name => {
      const department = departments.find(item => item.name === name);
      const icon = name === "All" ? "🛍️" : (department?.icon || "📦");
      const active = name === activeDepartment;
      return `<button type="button" class="chip${active ? " active" : ""}" data-department="${escapeHtml(name)}" aria-pressed="${active}"><span class="chip-icon" aria-hidden="true">${escapeHtml(icon)}</span><span class="chip-copy"><span class="chip-name">${escapeHtml(name === "All" ? "All products" : name)}</span></span></button>`;
    }).join("");

    departmentSelect.innerHTML = names.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name === "All" ? "All products" : name)}</option>`).join("");
    departmentSelect.value = activeDepartment;
  }

  function updateActiveDepartmentUI() {
    departmentRow.querySelectorAll("[data-department]").forEach(button => {
      const active = button.dataset.department === activeDepartment;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    departmentSelect.value = activeDepartment;
  }

  function productCard(product, index) {
    const specs = normalizeArray(product.specs);
    const sizes = normalizeArray(product.sizes);
    const price = formatPrice(product.price);
    const eager = index < 4;

    return `<article class="product-card">
      <div class="product-photo">
        <span class="photo-tag">${escapeHtml(product.department || "Product")}</span>
        <img src="${escapeHtml(product.image || FALLBACK_IMAGE)}" alt="${escapeHtml(product.name || "Product")}" loading="${eager ? "eager" : "lazy"}" decoding="async" fetchpriority="${index < 2 ? "high" : "low"}" width="640" height="640" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'">
      </div>
      <div class="product-body">
        <p class="department-label">${escapeHtml(product.department || "")}</p>
        <h3>${escapeHtml(product.name || "Product")}</h3>
        <div class="product-price${price ? "" : " price-request"}"><span class="product-price-label">Price</span>${price || "Price on request"}</div>
        <div class="specs">${specs.map(spec => `<span>${escapeHtml(spec)}</span>`).join("")}</div>
        ${sizes.length ? `<div class="tv-size"><label>Choose a size</label><select class="size-select">${sizes.map(size => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`).join("")}</select></div>` : ""}
        <div class="ask-btn"><button type="button" data-product-id="${escapeHtml(product.id || index)}">Buy on WhatsApp</button></div>
      </div>
    </article>`;
  }

  function renderNow() {
    const normalizedTerm = searchTerm.toLowerCase();
    const filtered = products.filter(product => {
      const matchesDepartment = activeDepartment === "All" || product.department === activeDepartment;
      const searchable = `${product.name || ""} ${product.department || ""} ${product.brand || ""} ${normalizeArray(product.specs).join(" ")} ${product.price || ""}`.toLowerCase();
      return matchesDepartment && searchable.includes(normalizedTerm);
    });

    productGrid.innerHTML = filtered.length
      ? filtered.map(productCard).join("")
      : `<div class="no-results"><h3>No matching products</h3><p>Try another search word or category.</p></div>`;
  }

  function scheduleRender() {
    cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(renderNow);
  }

  departmentRow.addEventListener("click", event => {
    const button = event.target.closest("button[data-department]");
    if (!button || button.dataset.department === activeDepartment) return;
    activeDepartment = button.dataset.department;
    updateActiveDepartmentUI();
    scheduleRender();
  });

  departmentSelect.addEventListener("change", () => {
    activeDepartment = departmentSelect.value;
    updateActiveDepartmentUI();
    scheduleRender();
  });

  searchForm.addEventListener("submit", event => {
    event.preventDefault();
    clearTimeout(searchTimer);
    searchTerm = searchInput.value.trim();
    scheduleRender();
    document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
  });

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchTerm = searchInput.value.trim();
      scheduleRender();
    }, 120);
  });

  productGrid.addEventListener("click", event => {
    const button = event.target.closest("button[data-product-id]");
    if (!button) return;
    const product = productsById.get(button.dataset.productId);
    if (!product) return;
    const card = button.closest(".product-card");
    const size = card?.querySelector(".size-select")?.value;
    const price = formatPrice(product.price);
    const message = `Hello Biriho Shop, I want to buy ${product.name}${size ? ` in ${size}` : ""}.${price ? ` The listed price is ${price}.` : " Please tell me the price."} Please confirm availability, warranty and delivery information.`;
    window.open(waLink(message), "_blank", "noopener");
  });

  const mobileNavLinks = [...document.querySelectorAll("[data-mobile-nav]")];
  const setMobileNavActive = key => mobileNavLinks.forEach(link => {
    const active = link.dataset.mobileNav === key;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  mobileNavLinks.forEach(link => link.addEventListener("click", () => setMobileNavActive(link.dataset.mobileNav)));

  let scrollFrame = 0;
  window.addEventListener("scroll", () => {
    if (window.innerWidth > 820 || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const y = window.scrollY + 150;
      const catalog = document.getElementById("catalog");
      const categories = document.getElementById("categories");
      const about = document.getElementById("about");
      const bottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 90;
      setMobileNavActive(bottom || y >= about.offsetTop ? "about" : y >= categories.offsetTop && y <= categories.offsetTop + categories.offsetHeight + 180 ? "categories" : y >= catalog.offsetTop ? "catalog" : "home");
    });
  }, { passive: true });

  async function refreshCatalog() {
    await readShopConfig();
    const [productData, departmentData] = await Promise.all([
      supabaseGet("products", "select=*&order=created_at.asc"),
      supabaseGet("departments", "select=name,icon,sort_order&order=sort_order.asc,name.asc")
    ]);
    applyCatalog(productData, departmentData);
    writeCache();
  }

  async function start() {
    setGeneralWhatsAppLinks();
    const hadCache = readCache();
    if (!hadCache) productGrid.innerHTML = `<div class="no-results catalog-loading"><span class="loading-spinner" aria-hidden="true"></span><strong>Loading products…</strong></div>`;

    try {
      await refreshCatalog();
    } catch (error) {
      console.error(error);
      if (!hadCache) {
        productGrid.innerHTML = `<div class="no-results"><h3>Products could not load</h3><p>Please check your internet connection and Supabase setup.</p></div>`;
        buildDepartmentUI();
      }
    }
  }

  start();
})();
