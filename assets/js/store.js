(() => {
const CFG=window.HADI_CONFIG;
const configured=CFG.SUPABASE_URL && !CFG.SUPABASE_URL.startsWith("YOUR_");
const sb=configured?window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY):null;
const PAGE=document.body.dataset.page||"home";

let categories=[],products=[],phoneOptions=[];
let activeCategory="all",search="",sort="newest";

let cart=(JSON.parse(localStorage.getItem("hadi_cart")||"[]")||[]).map(i=>({
  ...i,
  key:i.key||`${i.id}${i.phone_model?`::${i.phone_model}`:""}`
}));

const $=s=>document.querySelector(s);
const money=n=>`$${Number(n).toFixed(2)}`;
const catName=id=>categories.find(c=>String(c.id)===String(id))?.name||"Tech";
const esc=(s="")=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

injectStoreEnhancementStyles();
fixWhatsAppIcon();

async function load(){
  if(!sb){
    console.error("Supabase is not configured.");
    renderCart();
    return;
  }

  const [c,p,o]=await Promise.all([
    sb.from("categories").select("*").order("sort_order"),
    sb.from("products").select("*").eq("is_active",true).order("created_at",{ascending:false}),
    sb.from("product_phone_options").select("*").order("sort_order")
  ]);

  if(c.error||p.error||o.error){
    console.error("Store data load failed:",c.error||p.error||o.error);
    categories=c.data||[];
    products=p.data||[];
    phoneOptions=o.data||[];
  }else{
    categories=c.data||[];
    products=p.data||[];
    phoneOptions=o.data||[];
  }

  renderCart();

  if(PAGE==="home"){
    renderFeatured();
    initHomeSearch();
    initHeroScrollAnimation();
  }

  if(PAGE==="categories"){
    initCategoriesPage();
  }
}

function optionsFor(productId){
  return phoneOptions.filter(o=>String(o.product_id)===String(productId));
}
function rootCategories(){
  return categories.filter(c=>!c.parent_id).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
}
function childrenOf(id){
  return categories.filter(c=>String(c.parent_id)===String(id)).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
}
function descendantIds(id){
  const ids=[String(id)];
  childrenOf(id).forEach(ch=>ids.push(...descendantIds(ch.id)));
  return ids;
}
function productAvailable(p){
  if(!p.in_stock)return false;
  if(!p.has_phone_options)return true;
  return optionsFor(p.id).some(o=>o.in_stock);
}

function iconForCategory(name=""){
  const n=name.toLowerCase();
  if(n.includes("phone"))return '<svg viewBox="0 0 24 24"><path d="M8 2h8v20H8Zm3 17h2"/></svg>';
  if(n.includes("case")||n.includes("cover")||n.includes("protect"))return '<svg viewBox="0 0 24 24"><path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/></svg>';
  if(n.includes("charg")||n.includes("cable"))return '<svg viewBox="0 0 24 24"><path d="M9 2v6m6-6v6M7 8h10v4a5 5 0 0 1-10 0Z"/></svg>';
  if(n.includes("audio")||n.includes("ear"))return '<svg viewBox="0 0 24 24"><path d="M4 13v-2a8 8 0 0 1 16 0v2m-16 0v5h4v-7H4m16 2v5h-4v-7h4"/></svg>';
  if(n.includes("watch"))return '<svg viewBox="0 0 24 24"><path d="M8 7h8l1 10H7Zm1-5h6l1 5H8Zm0 20h6l1-5H8Z"/></svg>';
  if(n.includes("power"))return '<svg viewBox="0 0 24 24"><path d="M7 4h10v16H7Zm10 5h2v6h-2M10 8h4"/></svg>';
  return '<svg viewBox="0 0 24 24"><path d="M4 4h6v6H4Zm10 0h6v6h-6ZM4 14h6v6H4Zm10 0h6v6h-6Z"/></svg>';
}

function card(p){
  const available=productAvailable(p);
  const configurable=!!p.has_phone_options;
  const addLabel=!available?"Out of stock":configurable?"Choose phone":"Add to cart";
  const action=configurable?`data-choose="${p.id}"`:`data-add="${p.id}"`;

  return `<article class="product-card ${!available?"product-card-out":""}">
    <div class="product-image-wrap" data-view="${p.id}">
      <img src="${p.image_url||"assets/img/hadi-mobile-logo.jpg"}" alt="${esc(p.name)}" loading="lazy">
      ${p.featured?'<span class="product-badge">FEATURED</span>':""}
      ${!available?'<span class="stock-overlay-badge">OUT OF STOCK</span>':""}
    </div>
    <div class="product-body">
      <div class="product-category">${esc(catName(p.category_id))}</div>
      <h3>${esc(p.name)}</h3>
      <div class="product-price">${money(p.price)}</div>
      ${configurable?'<div class="phone-fit-note">Choose your phone model</div>':""}
      <div class="product-actions">
        <button class="add-btn" ${action} ${!available?"disabled":""}>${addLabel}</button>
        <button class="view-btn" data-view="${p.id}" aria-label="View details for ${esc(p.name)}">View</button>
      </div>
    </div>
  </article>`;
}

function bindCards(scope=document){
  scope.querySelectorAll("[data-add]").forEach(b=>b.onclick=e=>{e.stopPropagation();addToCart(b.dataset.add);});
  scope.querySelectorAll("[data-choose]").forEach(b=>b.onclick=e=>{e.stopPropagation();openProduct(b.dataset.choose,true);});
  scope.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>openProduct(b.dataset.view,false));
}

function renderFeatured(){
  const grid=$("#featuredGrid"),section=$("#featuredSection");
  if(!grid||!section)return;
  const list=products.filter(p=>p.featured).slice(0,4);
  section.classList.toggle("hidden",!list.length);
  grid.innerHTML=list.map(card).join("");
  bindCards(grid);
}

function initHomeSearch(){
  const form=$("#homeSearchForm"),input=$("#homeSearchInput");
  if(!form||!input)return;
  form.addEventListener("submit",e=>{
    e.preventDefault();
    const q=input.value.trim();
    location.href=q?`categories.html?q=${encodeURIComponent(q)}`:"categories.html";
  });
}

function initHeroScrollAnimation(){
  const hero=$(".hero"),device=$("#heroDevice"),frame=$("#deviceFrame")||$(".device-frame");
  const island=$("#deviceIsland")||$(".device-island");
  const brand=$("#deviceBrand")||$(".device-screen span");
  const subBrand=$("#deviceSubBrand")||$(".device-screen strong");
  const tagline=$("#deviceTagline")||$(".device-screen small");
  if(!hero||!device||!frame||matchMedia("(prefers-reduced-motion: reduce)").matches)return;

  let ticking=false;
  function update(){
    ticking=false;
    const heroTop=hero.getBoundingClientRect().top;
    const distance=Math.max(hero.offsetHeight*.72,1);
    const progress=Math.max(0,Math.min(1,-heroTop/distance));

    device.style.transform=`translate3d(0,${-58*progress}px,0) scale(${1-.065*progress})`;
    device.style.opacity=String(1-.08*progress);
    frame.style.transform=`rotateX(${9-3*progress}deg) rotateZ(${8-11*progress}deg) translateY(${54-18*progress}px)`;

    if(brand){brand.style.transform=`translate3d(0,${-10*progress}px,0)`;brand.style.opacity=String(1-.12*progress);}
    if(subBrand)subBrand.style.transform=`translate3d(0,${-4*progress}px,0) scale(${1+.035*progress})`;
    if(tagline){tagline.style.transform=`translate3d(0,${8*progress}px,0)`;tagline.style.opacity=String(1-.35*progress);}
    if(island)island.style.transform=`scaleX(${1-.08*progress})`;
  }
  function requestUpdate(){if(!ticking){ticking=true;requestAnimationFrame(update);}}
  addEventListener("scroll",requestUpdate,{passive:true});
  addEventListener("resize",requestUpdate,{passive:true});
  update();
}

function initCategoriesPage(){
  const params=new URLSearchParams(location.search);
  search=params.get("q")||"";
  activeCategory=params.get("category")||"all";

  const input=$("#searchInput");
  if(input){
    input.value=search;
    input.addEventListener("input",e=>{
      search=e.target.value.trim();
      if(search){activeCategory="all";showProductsSection();}
      else if(activeCategory==="all")showCategoriesSection();
      renderCategoryCards();
      renderCategoryProducts();
    });
  }

  $("#sortSelect")?.addEventListener("change",e=>{sort=e.target.value;renderCategoryProducts();});
  $("#backToCategories")?.addEventListener("click",returnToCategories);

  const topBack=$("#categoryBackLink");
  if(topBack){
    topBack.addEventListener("click",e=>{
      if(activeCategory!=="all"||search){
        e.preventDefault();
        returnToCategories();
      }
    });
  }

  renderCategoryCards();

  if(activeCategory!=="all"||search){
    showProductsSection();
    renderCategoryProducts();
  }else showCategoriesSection();

  addEventListener("popstate",()=>{
    const q=new URLSearchParams(location.search);
    search=q.get("q")||"";
    activeCategory=q.get("category")||"all";
    if(input)input.value=search;
    if(activeCategory!=="all"||search){showProductsSection();renderCategoryProducts();}
    else{showCategoriesSection();renderCategoryCards();}
  });
}

function returnToCategories(){
  activeCategory="all";
  search="";
  const input=$("#searchInput");
  if(input)input.value="";
  history.replaceState(null,"","categories.html");
  showCategoriesSection();
  renderCategoryCards();
  scrollTo({top:0,behavior:"smooth"});
}

function showCategoriesSection(){
  $("#categoryChooserSection")?.classList.remove("hidden");
  $("#categoryProductsSection")?.classList.add("hidden");
  const back=$("#categoryBackLink");
  if(back){back.textContent="← Back home";back.href="index.html";}
}
function showProductsSection(){
  $("#categoryChooserSection")?.classList.add("hidden");
  $("#categoryProductsSection")?.classList.remove("hidden");
  const back=$("#categoryBackLink");
  if(back){back.textContent="← Back to categories";back.href="categories.html";}
}

function renderCategoryCards(){
  const grid=$("#categoryCardGrid");
  if(!grid)return;
  grid.innerHTML=rootCategories().map(c=>{
    const ids=descendantIds(c.id);
    const count=products.filter(p=>ids.includes(String(p.category_id))).length;
    return `<button class="category-card" data-category-card="${c.id}">
      <div class="category-card-icon">${iconForCategory(c.name)}</div>
      <strong>${esc(c.name)}</strong>
      <span>${count} ${count===1?"product":"products"}</span>
    </button>`;
  }).join("");

  grid.querySelectorAll("[data-category-card]").forEach(btn=>btn.onclick=()=>{
    activeCategory=btn.dataset.categoryCard;
    search="";
    const input=$("#searchInput");if(input)input.value="";
    history.pushState(null,"",`categories.html?category=${encodeURIComponent(activeCategory)}`);
    showProductsSection();
    renderCategoryProducts();
    $("#categoryProductsSection")?.scrollIntoView({behavior:"smooth",block:"start"});
  });
}

function filteredProducts(){
  let list=[...products];
  if(activeCategory!=="all"){
    const ids=descendantIds(activeCategory);
    list=list.filter(p=>ids.includes(String(p.category_id)));
  }
  if(search){
    const q=search.toLowerCase();
    list=list.filter(p=>`${p.name} ${p.description||""} ${catName(p.category_id)}`.toLowerCase().includes(q));
  }
  if(sort==="price-low")list.sort((a,b)=>Number(a.price)-Number(b.price));
  else if(sort==="price-high")list.sort((a,b)=>Number(b.price)-Number(a.price));
  else if(sort==="name")list.sort((a,b)=>a.name.localeCompare(b.name));
  else list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  return list;
}

function renderCategoryProducts(){
  const grid=$("#productGrid");if(!grid)return;
  const selected=categories.find(c=>String(c.id)===String(activeCategory));
  if($("#productsTitle"))$("#productsTitle").textContent=search?"Search results":(selected?.name||"All products");
  if($("#selectedCategoryEyebrow"))$("#selectedCategoryEyebrow").textContent=search?"SEARCH":"CATEGORY";

  const sub=$("#subcategoryList");
  if(sub){
    const kids=selected?childrenOf(selected.id):[];
    sub.innerHTML=kids.map(c=>`<button class="subcategory-chip" data-sub="${c.id}">${esc(c.name)}</button>`).join("");
    sub.querySelectorAll("[data-sub]").forEach(btn=>btn.onclick=()=>{
      activeCategory=btn.dataset.sub;
      history.pushState(null,"",`categories.html?category=${encodeURIComponent(activeCategory)}`);
      renderCategoryProducts();
    });
  }

  const list=filteredProducts();
  grid.innerHTML=list.map(card).join("");
  bindCards(grid);
  $("#emptyState")?.classList.toggle("hidden",list.length>0);
  if($("#productCount"))$("#productCount").textContent=`${list.length} ${list.length===1?"product":"products"}`;
}

function openProduct(id,focusChoice=false){
  const p=products.find(x=>String(x.id)===String(id));
  const modal=$("#productModal"),content=$("#productModalContent");
  if(!p||!modal||!content)return;

  const opts=optionsFor(p.id);
  const configurable=!!p.has_phone_options;
  const overallAvailable=productAvailable(p);

  let optionMarkup="";
  if(configurable){
    optionMarkup=`
      <div class="phone-choice-block">
        <label for="phoneChoice">Choose your phone model</label>
        <select id="phoneChoice">
          <option value="">Select your phone</option>
          ${opts.map(o=>`<option value="${esc(o.phone_model)}" ${!o.in_stock?"disabled":""}>${esc(o.phone_model)}${o.in_stock?"":" — Out of stock"}</option>`).join("")}
        </select>
        <div class="phone-choice-help">Unavailable models stay visible so you can immediately see whether this product fits your phone.</div>
      </div>`;
  }

  content.innerHTML=`<div class="modal-product">
    <img src="${p.image_url||"assets/img/hadi-mobile-logo.jpg"}" alt="${esc(p.name)}">
    <div class="modal-copy">
      <span class="eyebrow">${esc(catName(p.category_id))}</span>
      <h2>${esc(p.name)}</h2>
      <div class="modal-price">${money(p.price)}</div>
      <p class="desc">${esc(p.description||"")}</p>
      ${optionMarkup}
      <div class="stock-note ${overallAvailable?"":"stock-note-out"}">${overallAvailable?(configurable?"Choose an available phone model below.":"In stock"):"Currently out of stock"}</div>
      <button class="primary-btn" id="modalAddBtn" style="margin-top:16px" ${!overallAvailable||configurable?"disabled":""}>${overallAvailable?(configurable?"Choose phone first":"Add to cart"):"Out of stock"}</button>
    </div>
  </div>`;

  const add=$("#modalAddBtn");
  const select=$("#phoneChoice");

  if(configurable&&select&&add){
    select.addEventListener("change",()=>{
      const chosen=select.value;
      add.disabled=!chosen;
      add.textContent=chosen?`Add for ${chosen}`:"Choose phone first";
    });
    add.onclick=()=>{if(select.value)addToCart(p.id,select.value);};
  }else if(add&&!add.disabled){
    add.onclick=()=>addToCart(p.id);
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");

  if(focusChoice&&select)setTimeout(()=>select.focus(),150);
}

function addToCart(id,phoneModel=""){
  const p=products.find(x=>String(x.id)===String(id));
  if(!p||!productAvailable(p))return;

  if(p.has_phone_options){
    const opt=optionsFor(p.id).find(o=>o.phone_model===phoneModel);
    if(!opt||!opt.in_stock){openProduct(id,true);return;}
  }

  const key=`${p.id}${phoneModel?`::${phoneModel}`:""}`;
  const existing=cart.find(x=>x.key===key);

  if(existing)existing.qty++;
  else cart.push({
    key,
    id:p.id,
    name:p.name,
    phone_model:phoneModel||"",
    price:Number(p.price),
    image_url:p.image_url||"assets/img/hadi-mobile-logo.jpg",
    qty:1
  });

  saveCart();
  closeProduct();
  openCart();
}

function saveCart(){
  localStorage.setItem("hadi_cart",JSON.stringify(cart));
  renderCart();
}
function renderCart(){
  const count=cart.reduce((s,i)=>s+i.qty,0);
  const total=cart.reduce((s,i)=>s+i.price*i.qty,0);

  if($("#cartCount"))$("#cartCount").textContent=count;
  if($("#bottomCartCount"))$("#bottomCartCount").textContent=count;
  if($("#cartTotal"))$("#cartTotal").textContent=money(total);

  const empty=$("#cartEmpty"),items=$("#cartItems");
  if(!empty||!items)return;

  empty.classList.toggle("hidden",cart.length>0);
  items.classList.toggle("hidden",cart.length===0);
  items.innerHTML=cart.map(i=>`<div class="cart-row">
    <img src="${i.image_url||"assets/img/hadi-mobile-logo.jpg"}" alt="">
    <div>
      <h4>${esc(i.name)}</h4>
      ${i.phone_model?`<div class="cart-phone-model">${esc(i.phone_model)}</div>`:""}
      <small>${money(i.price)}</small>
      <div class="qty"><button data-dec="${esc(i.key)}">−</button><span>${i.qty}</span><button data-inc="${esc(i.key)}">+</button></div>
    </div>
    <button class="remove" data-remove="${esc(i.key)}">Remove</button>
  </div>`).join("");

  items.querySelectorAll("[data-inc]").forEach(b=>b.onclick=()=>changeQty(b.dataset.inc,1));
  items.querySelectorAll("[data-dec]").forEach(b=>b.onclick=()=>changeQty(b.dataset.dec,-1));
  items.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{
    cart=cart.filter(i=>i.key!==b.dataset.remove);
    saveCart();
  });
}
function changeQty(key,n){
  const i=cart.find(x=>x.key===key);if(!i)return;
  i.qty+=n;if(i.qty<=0)cart=cart.filter(x=>x.key!==key);
  saveCart();
}
function openCart(){
  $("#cartSheet")?.classList.add("open");
  $("#sheetBackdrop")?.classList.add("open");
  $("#cartSheet")?.setAttribute("aria-hidden","false");
}
function closeCart(){
  $("#cartSheet")?.classList.remove("open");
  $("#sheetBackdrop")?.classList.remove("open");
  $("#cartSheet")?.setAttribute("aria-hidden","true");
}
function closeProduct(){
  $("#productModal")?.classList.remove("open");
  $("#productModal")?.setAttribute("aria-hidden","true");
}
function checkout(){
  if(!cart.length)return;
  const total=cart.reduce((s,i)=>s+i.price*i.qty,0);
  const lines=cart.map((i,n)=>`${n+1}. ${i.name}${i.phone_model?` — ${i.phone_model}`:""} × ${i.qty} — ${money(i.price*i.qty)}`).join("\n");
  const msg=`Hello HADI MOBILE 👋\n\nI'd like to place this order:\n\n${lines}\n\nTotal: ${money(total)}\n\nPlease confirm availability and continue the order with me here.`;
  window.open(`https://wa.me/${CFG.WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`,"_blank");
}

$("#cartButton")?.addEventListener("click",openCart);
$("#bottomCart")?.addEventListener("click",openCart);
$("#closeCart")?.addEventListener("click",closeCart);
$("#sheetBackdrop")?.addEventListener("click",closeCart);
$("#whatsappCheckout")?.addEventListener("click",checkout);
$("#closeProduct")?.addEventListener("click",closeProduct);
$("#productModal")?.addEventListener("click",e=>{if(e.target===$("#productModal"))closeProduct();});

function fixWhatsAppIcon(){
  document.querySelectorAll(".whatsapp-btn svg").forEach(svg=>{
    svg.setAttribute("viewBox","0 0 32 32");
    svg.innerHTML=`<path fill="currentColor" stroke="none" d="M16 3a13 13 0 0 0-11.15 19.7L3.1 29l6.47-1.7A13 13 0 1 0 16 3Zm0 23.6c-2.04 0-4.03-.55-5.76-1.6l-.41-.24-3.84 1.01 1.03-3.74-.27-.43A10.6 10.6 0 1 1 16 26.6Zm5.82-7.93c-.32-.16-1.88-.93-2.17-1.03-.29-.11-.5-.16-.71.16-.21.32-.82 1.03-1 1.24-.18.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.72-.98-2.35-.26-.62-.52-.54-.71-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.11 1.08-1.11 2.64 0 1.56 1.14 3.07 1.3 3.28.16.21 2.24 3.42 5.43 4.8.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.88-.77 2.14-1.51.26-.74.26-1.37.18-1.51-.08-.13-.29-.21-.61-.37Z"/>`;
  });
}

function injectStoreEnhancementStyles(){
  const style=document.createElement("style");
  style.textContent=`
    .whatsapp-btn svg{width:24px!important;height:24px!important;display:block!important;overflow:visible!important}
    .phone-fit-note{font-size:.62rem;color:#697a91;margin-top:6px;font-weight:700}
    .stock-overlay-badge{position:absolute;right:9px;top:9px;background:#fff1f1;color:#d84f4f;border:1px solid #f1c5c5;border-radius:999px;padding:6px 8px;font-size:.53rem;font-weight:900;letter-spacing:.06em}
    .product-card-out .product-image-wrap img{opacity:.55;filter:grayscale(.25)}
    .phone-choice-block{margin-top:16px;padding:14px;border-radius:16px;background:linear-gradient(145deg,#f4fbff,#f6f1ff);border:1px solid rgba(22,119,255,.12)}
    .phone-choice-block label{display:block;font-size:.72rem;font-weight:800;color:#0a1f44;margin-bottom:7px}
    .phone-choice-block select{width:100%;padding:12px;border-radius:12px;border:1px solid rgba(10,31,68,.12);background:#fff;color:#0a1f44;font:inherit}
    .phone-choice-help{font-size:.62rem;line-height:1.45;color:#738098;margin-top:8px}
    .stock-note-out{color:#d84f4f!important}
    .cart-phone-model{font-size:.66rem;font-weight:800;color:#1677ff;margin:2px 0 3px}
  `;
  document.head.appendChild(style);
}

load();
})();
