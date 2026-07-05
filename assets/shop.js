const SUPABASE_URL="https://cqjuirswcehwazmpyimm.supabase.co";
const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxanVpcnN3Y2Vod2F6bXB5aW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NDM0MzcsImV4cCI6MjA5NzUxOTQzN30.2sSVHJZnPxO-GUYu1p59i4xEuvA6Q1h_JvoeE4SOczM";
const WHATSAPP_NUMBER="250788200521";
const headers={apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`};

let products=[];
let departments=[];
let activeDepartment="All";
let searchTerm="";

const productGrid=document.getElementById("productGrid");
const departmentRow=document.getElementById("departmentRow");
const departmentSelect=document.getElementById("departmentSelect");
const searchInput=document.getElementById("searchInput");
const resultCount=document.getElementById("resultCount");

const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const waLink=message=>`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
const generalMessage="Hello Biriho Shop, I visited your website and I want to buy a product. Please show me the available options, warranty and delivery information.";
["headerWhatsapp","ctaWhatsapp","footerWhatsapp","floatingWhatsapp","mobileNavWhatsapp"].forEach(id=>{const el=document.getElementById(id);if(el)el.href=waLink(generalMessage)});

async function supabaseGet(table,params=""){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`,{headers});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(data?.message||`Request failed (${response.status})`);
  return data||[];
}

function normalizeArray(value){
  if(Array.isArray(value))return value;
  if(typeof value==="string"){
    try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed}catch{}
    return value.split(",").map(item=>item.trim()).filter(Boolean);
  }
  return [];
}

function buildDepartmentUI(){
  const names=["All",...new Set(departments.map(d=>d.name).concat(products.map(p=>p.department)).filter(Boolean))];
  const counts=products.reduce((map,p)=>{map[p.department]=(map[p.department]||0)+1;return map},{});
  departmentRow.innerHTML=names.map(name=>{
    const department=departments.find(d=>d.name===name);
    const count=name==="All"?products.length:(counts[name]||0);
    const icon=name==="All"?"🛍️":(department?.icon||"📦");
    return `<button type="button" class="chip ${name===activeDepartment?"active":""}" data-department="${escapeHtml(name)}" aria-pressed="${name===activeDepartment}"><span class="chip-icon" aria-hidden="true">${escapeHtml(icon)}</span><span class="chip-copy"><span class="chip-name">${escapeHtml(name==="All"?"All products":name)}</span><span class="chip-count">${count} ${count===1?"product":"products"}</span></span></button>`;
  }).join("");
  departmentSelect.innerHTML=names.map(name=>`<option value="${escapeHtml(name)}">${escapeHtml(name==="All"?"All products":name)}</option>`).join("");
  departmentSelect.value=activeDepartment;
}

function render(){
  const filtered=products.filter(product=>{
    const matchesDepartment=activeDepartment==="All"||product.department===activeDepartment;
    const haystack=`${product.name||""} ${product.department||""} ${normalizeArray(product.specs).join(" ")} ${product.brand||""}`.toLowerCase();
    return matchesDepartment&&haystack.includes(searchTerm.toLowerCase());
  });
  resultCount.textContent=`${filtered.length} product${filtered.length===1?"":"s"}`;
  productGrid.innerHTML=filtered.length?filtered.map((product,index)=>{
    const specs=normalizeArray(product.specs);
    const sizes=normalizeArray(product.sizes);
    return `<article class="product-card" data-index="${index}"><div class="product-photo"><span class="photo-tag">${escapeHtml(product.department||"Product")}</span><img src="${escapeHtml(product.image||"")}" alt="${escapeHtml(product.name||"Product")}" loading="lazy" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=900&q=82'"></div><div class="product-body"><p class="department-label">${escapeHtml(product.department||"")}</p><h3>${escapeHtml(product.name||"Product")}</h3><div class="specs">${specs.map(spec=>`<span>${escapeHtml(spec)}</span>`).join("")}</div>${sizes.length?`<div class="tv-size"><label>Choose a size</label><select class="size-select">${sizes.map(size=>`<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`).join("")}</select></div>`:""}<div class="ask-btn"><button type="button" data-product-id="${escapeHtml(product.id||index)}">Buy on WhatsApp</button></div></div></article>`;
  }).join(""):`<div class="no-results"><h3>No matching products</h3><p>Try another search word or category.</p></div>`;
}

departmentRow.addEventListener("click",event=>{
  const button=event.target.closest("button[data-department]");
  if(!button)return;
  activeDepartment=button.dataset.department;
  buildDepartmentUI();
  render();
});
departmentSelect.addEventListener("change",()=>{activeDepartment=departmentSelect.value;buildDepartmentUI();render()});
document.getElementById("searchForm").addEventListener("submit",event=>{event.preventDefault();searchTerm=searchInput.value.trim();render();document.getElementById("catalog").scrollIntoView({behavior:"smooth"})});
searchInput.addEventListener("input",()=>{searchTerm=searchInput.value.trim();render()});
productGrid.addEventListener("click",event=>{
  const button=event.target.closest("button[data-product-id]");
  if(!button)return;
  const card=button.closest(".product-card");
  const product=products.filter(item=>activeDepartment==="All"||item.department===activeDepartment).find(item=>String(item.id)===button.dataset.productId)||products.find(item=>String(item.id)===button.dataset.productId);
  if(!product)return;
  const size=card.querySelector(".size-select")?.value;
  const message=`Hello Biriho Shop, I want to buy ${product.name}${size?` in ${size}`:""}. Please tell me the available models, warranty, latest price and delivery information.`;
  window.open(waLink(message),"_blank","noopener");
});

const mobileNavLinks=[...document.querySelectorAll("[data-mobile-nav]")];
function setMobileNavActive(key){mobileNavLinks.forEach(link=>{const active=link.dataset.mobileNav===key;link.classList.toggle("is-active",active);active?link.setAttribute("aria-current","page"):link.removeAttribute("aria-current")})}
mobileNavLinks.forEach(link=>link.addEventListener("click",()=>setMobileNavActive(link.dataset.mobileNav)));
window.addEventListener("scroll",()=>{
  if(window.innerWidth>820)return;
  const y=window.scrollY+150;
  const catalog=document.getElementById("catalog");
  const categories=document.getElementById("categories");
  const about=document.getElementById("about");
  const bottom=window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-90;
  setMobileNavActive(bottom||y>=about.offsetTop?"about":y>=categories.offsetTop&&y<=categories.offsetTop+categories.offsetHeight+180?"categories":y>=catalog.offsetTop?"catalog":"home");
},{passive:true});

async function loadCatalog(){
  productGrid.innerHTML='<div class="no-results">Loading products…</div>';
  try{
    const [productData,departmentData]=await Promise.all([
      supabaseGet("products","select=*&order=created_at.asc"),
      supabaseGet("departments","select=*&order=sort_order.asc,name.asc")
    ]);
    products=productData.filter(product=>product.hidden!==true);
    departments=departmentData;
  }catch(error){
    console.error(error);
    products=[];
    departments=[];
    productGrid.innerHTML='<div class="no-results"><h3>Products could not load</h3><p>Please check your internet connection and Supabase setup.</p></div>';
    resultCount.textContent="0 products";
    buildDepartmentUI();
    return;
  }
  buildDepartmentUI();
  render();
}
loadCatalog();
