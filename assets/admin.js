"use strict";

let SUPABASE_URL = "";
let SUPABASE_ANON_KEY = "";
const ADMIN_EMAIL = "happycyusa02@gmail.com";
const AUTH_SESSION_KEY = "biriho_supabase_admin_auth";
const $ = id => document.getElementById(id);

let authSession = null;
let products = [];
let departments = [];
let editingProductId = null;
let editingDepartmentName = null;
let toastTimer;

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const toArray = value => Array.isArray(value) ? value : (typeof value === "string" ? value.split(",").map(item => item.trim()).filter(Boolean) : []);
const formatPrice = value => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? `${number.toLocaleString("en-US", {maximumFractionDigits: 2})} RWF` : "Price not set";
};

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3400);
}

function setConnection(state, text) {
  $("connDot").className = state || "";
  $("connText").textContent = text;
}

function setLoginError(message) {
  $("loginError").textContent = message;
  $("loginError").classList.remove("hidden");
}

function clearLoginError() {
  $("loginError").classList.add("hidden");
}

function showLogin() {
  $("adminApp").classList.add("hidden");
  $("loginScreen").classList.remove("hidden");
}

function showApp() {
  $("loginScreen").classList.add("hidden");
  $("adminApp").classList.remove("hidden");
  loadAll();
}

async function loadPublicConfig() {
  const source = await fetch("assets/shop.js", {cache: "no-store"}).then(response => {
    if (!response.ok) throw new Error("Could not read the shop configuration.");
    return response.text();
  });
  const urlMatch = source.match(/const\s+SUPABASE_URL\s*=\s*["']([^"']+)["']/);
  const keyMatch = source.match(/const\s+SUPABASE_ANON_KEY\s*=\s*["']([^"']+)["']/);
  if (!urlMatch || !keyMatch) throw new Error("Supabase configuration was not found in assets/shop.js.");
  SUPABASE_URL = urlMatch[1];
  SUPABASE_ANON_KEY = keyMatch[1];
}

function saveAuthSession(session) {
  authSession = session;
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function clearAuthSession() {
  authSession = null;
  sessionStorage.removeItem(AUTH_SESSION_KEY);
}

async function authRequest(path, {method = "GET", body, token} = {}) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!response.ok) {
    throw new Error(data?.msg || data?.message || data?.error_description || `${response.status} ${response.statusText}`);
  }
  return data;
}

async function signIn(password) {
  const session = await authRequest("token?grant_type=password", {
    method: "POST",
    body: {email: ADMIN_EMAIL, password}
  });
  const email = String(session?.user?.email || "").toLowerCase();
  if (email !== ADMIN_EMAIL.toLowerCase()) {
    if (session?.access_token) {
      try { await authRequest("logout", {method: "POST", token: session.access_token}); } catch {}
    }
    throw new Error("This account is not authorized for Biriho Shop admin.");
  }
  saveAuthSession(session);
}

async function refreshAuthSession() {
  if (!authSession?.refresh_token) throw new Error("Your admin session expired. Please sign in again.");
  const session = await authRequest("token?grant_type=refresh_token", {
    method: "POST",
    body: {refresh_token: authSession.refresh_token}
  });
  if (String(session?.user?.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    throw new Error("This account is not authorized.");
  }
  saveAuthSession(session);
  return session;
}

async function restoreAuthSession() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(AUTH_SESSION_KEY) || "null");
    if (!stored?.access_token) return false;
    authSession = stored;
    try {
      const user = await authRequest("user", {token: stored.access_token});
      return String(user?.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
    } catch {
      await refreshAuthSession();
      return true;
    }
  } catch {
    clearAuthSession();
    return false;
  }
}

async function api(table, {method = "GET", query = "", body, retry = true} = {}) {
  const token = authSession?.access_token || SUPABASE_ANON_KEY;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (response.status === 401 && retry && authSession?.refresh_token) {
    await refreshAuthSession();
    return api(table, {method, query, body, retry: false});
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!response.ok) {
    const message = data?.message || data?.hint || `${response.status} ${response.statusText}`;
    if (/row-level security|policy/i.test(message)) {
      throw new Error("Database blocked this change. Run supabase/secure-database.sql and sign in with the approved Supabase admin account.");
    }
    if (/price/i.test(message) && /column|schema cache/i.test(message)) {
      throw new Error("Price column is missing. Run supabase/add-price.sql in Supabase first.");
    }
    throw new Error(message);
  }
  return data;
}

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  clearLoginError();
  try {
    await signIn($("passwordInput").value);
    $("passwordInput").value = "";
    showApp();
  } catch (error) {
    setLoginError(error.message === "Invalid login credentials" ? "Incorrect Supabase admin password." : error.message);
  } finally {
    button.disabled = false;
  }
});

$("logoutBtn").addEventListener("click", async () => {
  const token = authSession?.access_token;
  if (token) {
    try { await authRequest("logout", {method: "POST", token}); } catch {}
  }
  clearAuthSession();
  $("passwordInput").value = "";
  showLogin();
});

document.querySelectorAll(".tab-btn").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".tab-btn").forEach(item => item.classList.toggle("active", item === button));
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.id === `tab-${button.dataset.tab}`));
}));

async function loadAll() {
  setConnection("", "Connecting…");
  try {
    const [departmentData, productData] = await Promise.all([
      api("departments", {query: "select=*&order=sort_order.asc,name.asc"}),
      api("products", {query: "select=*&order=created_at.asc"})
    ]);
    departments = departmentData || [];
    products = productData || [];
    setConnection("ok", "Securely connected");
    renderAll();
  } catch (error) {
    setConnection("err", "Connection error");
    showToast(error.message);
  }
}

function renderAll() {
  renderDepartmentFilter();
  renderDepartmentOptions();
  renderProducts();
  renderDepartments();
}

function renderDepartmentFilter() {
  const current = $("deptFilter").value || "All";
  $("deptFilter").innerHTML = [`<option value="All">All departments</option>`, ...departments.map(dept => `<option value="${escapeHtml(dept.name)}">${escapeHtml(dept.name)}</option>`)].join("");
  $("deptFilter").value = departments.some(dept => dept.name === current) ? current : "All";
}

function renderDepartmentOptions(selected = $("fDept").value) {
  $("fDept").innerHTML = departments.length ? departments.map(dept => `<option value="${escapeHtml(dept.name)}">${escapeHtml(dept.name)}</option>`).join("") : `<option value="">Create a department first</option>`;
  if (departments.some(dept => dept.name === selected)) $("fDept").value = selected;
}

function filteredProducts() {
  const term = $("searchInput").value.trim().toLowerCase();
  const department = $("deptFilter").value;
  return products.filter(product => {
    const matchesDepartment = department === "All" || product.department === department;
    const searchable = `${product.name} ${product.department} ${product.brand || ""} ${toArray(product.specs).join(" ")} ${product.price || ""}`.toLowerCase();
    return matchesDepartment && searchable.includes(term);
  });
}

function renderProducts() {
  const items = filteredProducts();
  $("statTotal").textContent = products.length;
  $("statPriced").textContent = products.filter(product => Number(product.price) > 0).length;
  $("statDepts").textContent = departments.length;
  $("statFiltered").textContent = items.length;

  $("productList").innerHTML = items.length ? items.map(product => {
    const priceSet = Number(product.price) > 0;
    return `<div class="product-row">
      <div class="product-thumb"><img src="${escapeHtml(product.image)}" alt="" onerror="this.style.opacity='.15'"></div>
      <div class="product-name">${escapeHtml(product.name)}${product.brand ? `<small>${escapeHtml(product.brand)}</small>` : ""}</div>
      <div class="product-dept">${escapeHtml(product.department)}</div>
      <div class="product-price${priceSet ? "" : " empty-price"}">${formatPrice(product.price)}</div>
      <div class="tags">${toArray(product.specs).slice(0, 4).map(spec => `<span>${escapeHtml(spec)}</span>`).join("")}</div>
      <div class="row-actions"><button class="icon-btn" type="button" data-edit-product="${escapeHtml(product.id)}" title="Edit">✏️</button><button class="icon-btn danger" type="button" data-delete-product="${escapeHtml(product.id)}" title="Delete">🗑️</button></div>
    </div>`;
  }).join("") : `<div class="empty">No products match this search or filter.</div>`;
}

function renderDepartments() {
  $("deptGrid").innerHTML = departments.length ? departments.map(dept => {
    const count = products.filter(product => product.department === dept.name).length;
    return `<article class="department-card"><div class="department-top"><div class="department-icon">${escapeHtml(dept.icon || "📦")}</div><div><div class="department-name">${escapeHtml(dept.name)}</div><div class="department-meta">${count} product${count === 1 ? "" : "s"} · order ${Number(dept.sort_order) || 0}</div></div></div><div class="department-actions"><button class="btn btn-light btn-small" type="button" data-edit-dept="${escapeHtml(dept.name)}">Edit</button><button class="btn btn-danger btn-small" type="button" data-delete-dept="${escapeHtml(dept.name)}">Delete</button></div></article>`;
  }).join("") : `<div class="empty">No departments yet.</div>`;
}

$("searchInput").addEventListener("input", renderProducts);
$("deptFilter").addEventListener("change", renderProducts);

function setPreview(url) {
  const value = String(url || "").trim();
  $("previewImg").style.display = value ? "block" : "none";
  $("previewEmpty").style.display = value ? "none" : "block";
  if (value) $("previewImg").src = value;
}

function openProduct(product = null) {
  editingProductId = product?.id || null;
  $("productForm").reset();
  renderDepartmentOptions(product?.department);
  $("productModalTitle").textContent = product ? "Edit product" : "Add product";
  $("fName").value = product?.name || "";
  $("fPrice").value = Number(product?.price) > 0 ? product.price : "";
  $("fBrand").value = product?.brand || "";
  $("fSizes").value = toArray(product?.sizes).join(", ");
  $("fImage").value = product?.image || "";
  $("fSpecs").value = toArray(product?.specs).join(", ");
  $("uploadStatus").textContent = "You can paste a link or upload an image.";
  setPreview(product?.image);
  $("productModal").classList.remove("hidden");
}

function closeProduct() {
  $("productModal").classList.add("hidden");
  editingProductId = null;
  $("fImageFile").value = "";
}

$("addProductBtn").addEventListener("click", () => {
  if (!departments.length) return showToast("Create a department first.");
  openProduct();
});
$("closeProductBtn").addEventListener("click", closeProduct);
$("cancelProductBtn").addEventListener("click", closeProduct);
$("productModal").addEventListener("click", event => { if (event.target === $("productModal")) closeProduct(); });
$("fImage").addEventListener("input", event => setPreview(event.target.value));
$("previewImg").addEventListener("error", () => setPreview(""));

$("uploadBtn").addEventListener("click", async () => {
  const file = $("fImageFile").files[0];
  if (!file) return void ($("uploadStatus").textContent = "Choose an image first.");
  let key = localStorage.getItem("biriho_imgbb_key") || "";
  if (!key) {
    key = prompt("Enter your ImgBB API key. It will be saved only in this browser:") || "";
    if (key) localStorage.setItem("biriho_imgbb_key", key);
  }
  if (!key) return void ($("uploadStatus").textContent = "ImgBB API key is required.");
  $("uploadStatus").textContent = "Uploading…";
  try {
    const form = new FormData();
    form.append("image", file);
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, {method: "POST", body: form});
    const data = await response.json();
    if (!data.success) throw new Error(data.error?.message || "Upload failed");
    $("fImage").value = data.data.url;
    setPreview(data.data.url);
    $("uploadStatus").textContent = "Image uploaded successfully ✓";
  } catch (error) {
    $("uploadStatus").textContent = `Upload failed: ${error.message}`;
  }
});

$("productForm").addEventListener("submit", async event => {
  event.preventDefault();
  const rawPrice = $("fPrice").value.trim();
  const price = rawPrice === "" ? null : Number(rawPrice);
  if (price !== null && (!Number.isFinite(price) || price < 0)) return showToast("Enter a valid price.");
  const entry = {
    name: $("fName").value.trim(),
    department: $("fDept").value,
    price,
    image: $("fImage").value.trim(),
    brand: $("fBrand").value.trim() || null,
    sizes: toArray($("fSizes").value),
    specs: toArray($("fSpecs").value)
  };
  const wasEditing = Boolean(editingProductId);
  $("saveProductBtn").disabled = true;
  try {
    if (editingProductId) await api("products", {method: "PATCH", query: `id=eq.${encodeURIComponent(editingProductId)}`, body: entry});
    else await api("products", {method: "POST", body: entry});
    closeProduct();
    await loadAll();
    showToast(wasEditing ? "Product and price updated safely" : "Product added safely");
  } catch (error) {
    showToast(`Save failed: ${error.message}`);
  } finally {
    $("saveProductBtn").disabled = false;
  }
});

$("productList").addEventListener("click", async event => {
  const editButton = event.target.closest("[data-edit-product]");
  const deleteButton = event.target.closest("[data-delete-product]");
  if (editButton) return openProduct(products.find(product => String(product.id) === editButton.dataset.editProduct));
  if (!deleteButton) return;
  const product = products.find(item => String(item.id) === deleteButton.dataset.deleteProduct);
  if (!product || !confirm(`Delete ${product.name}? A recovery copy will remain in catalog history.`)) return;
  try {
    await api("products", {method: "DELETE", query: `id=eq.${encodeURIComponent(product.id)}`});
    await loadAll();
    showToast("Product deleted; recovery history was preserved");
  } catch (error) { showToast(error.message); }
});

function openDepartment(department = null) {
  editingDepartmentName = department?.name || null;
  $("deptForm").reset();
  $("deptModalTitle").textContent = department ? "Edit department" : "Add department";
  $("dName").value = department?.name || "";
  $("dIcon").value = department?.icon || "";
  $("dOrder").value = department?.sort_order ?? Math.max(0, ...departments.map(item => Number(item.sort_order) || 0)) + 1;
  $("deptModal").classList.remove("hidden");
}

function closeDepartment() {
  $("deptModal").classList.add("hidden");
  editingDepartmentName = null;
}

$("addDeptBtn").addEventListener("click", () => openDepartment());
$("closeDeptBtn").addEventListener("click", closeDepartment);
$("cancelDeptBtn").addEventListener("click", closeDepartment);
$("deptModal").addEventListener("click", event => { if (event.target === $("deptModal")) closeDepartment(); });

$("deptForm").addEventListener("submit", async event => {
  event.preventDefault();
  const name = $("dName").value.trim();
  const entry = {name, icon: $("dIcon").value.trim() || "📦", sort_order: Number($("dOrder").value) || 0};
  const duplicate = departments.some(dept => dept.name.toLowerCase() === name.toLowerCase() && dept.name !== editingDepartmentName);
  if (duplicate) return showToast("A department with this name already exists.");
  const wasEditing = Boolean(editingDepartmentName);
  $("saveDeptBtn").disabled = true;
  try {
    if (editingDepartmentName) await api("departments", {method: "PATCH", query: `name=eq.${encodeURIComponent(editingDepartmentName)}`, body: entry});
    else await api("departments", {method: "POST", body: entry});
    closeDepartment();
    await loadAll();
    showToast(wasEditing ? "Department updated safely" : "Department added safely");
  } catch (error) { showToast(`Save failed: ${error.message}`); }
  finally { $("saveDeptBtn").disabled = false; }
});

$("deptGrid").addEventListener("click", async event => {
  const editButton = event.target.closest("[data-edit-dept]");
  const deleteButton = event.target.closest("[data-delete-dept]");
  if (editButton) return openDepartment(departments.find(dept => dept.name === editButton.dataset.editDept));
  if (!deleteButton) return;
  const name = deleteButton.dataset.deleteDept;
  const count = products.filter(product => product.department === name).length;
  if (count) return showToast(`Move or delete the ${count} linked product${count === 1 ? "" : "s"} first.`);
  if (!confirm(`Delete ${name}? A recovery copy will remain in catalog history.`)) return;
  try {
    await api("departments", {method: "DELETE", query: `name=eq.${encodeURIComponent(name)}`});
    await loadAll();
    showToast("Department deleted; recovery history was preserved");
  } catch (error) { showToast(error.message); }
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (!$("productModal").classList.contains("hidden")) closeProduct();
  else if (!$("deptModal").classList.contains("hidden")) closeDepartment();
});

async function bootstrap() {
  try {
    await loadPublicConfig();
    const restored = await restoreAuthSession();
    if (restored) showApp();
    else showLogin();
  } catch (error) {
    clearAuthSession();
    showLogin();
    setLoginError(error.message);
  }
}

bootstrap();
