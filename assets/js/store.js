(() => {
const CFG = window.HADI_CONFIG;
const configured = CFG.SUPABASE_URL && !CFG.SUPABASE_URL.startsWith("YOUR_");
const sb = configured ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
const PAGE = document.body.dataset.page || "home";

const DEMO_CATEGORIES = [
 {id:"c1",name:"Phones",slug:"phones",parent_id:null,sort_order:1},
 {id:"c2",name:"Cases",slug:"cases",parent_id:null,sort_order:2},
 {id:"c3",name:"Charging",slug:"charging",parent_id:null,sort_order:3},
 {id:"c4",name:"Audio",slug:"audio",parent_id:null,sort_order:4},
 {id:"c5",name:"Power Banks",slug:"power-banks",parent_id:null,sort_order:5},
 {id:"c6",name:"Smartwatches",slug:"smartwatches",parent_id:null,sort_order:6},
 {id:"s1",name:"iPhone",slug:"iphone",parent_id:"c1",sort_order:1},
 {id:"s2",name:"Samsung",slug:"samsung",parent_id:"c1",sort_order:2},
 {id:"s3",name:"USB-C",slug:"usb-c",parent_id:"c3",sort_order:1}
];

const placeholder = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#F8FBFF"/><stop offset=".55" stop-color="#EEF6FF"/><stop offset="1" stop-color="#F4EEFF"/></linearGradient><linearGradient id="g" x1="0" x2="1"><stop stop-color="#00C2FF"/><stop offset=".5" stop-color="#1677FF"/><stop offset="1" stop-color="#7C3AED"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/><text x="50%" y="48%" text-anchor="middle" fill="#0A1F44" font-family="Arial" font-weight="800" font-size="64">HADI</text><text x="50%" y="57%" text-anchor="middle" fill="url(#g)" font-family="Arial" font-weight="700" font-size="27" letter-spacing="8">MOBILE</text></svg>`);

const DEMO_PRODUCTS = [
 {id:"p1",name:"iPhone 17 Pro",price:1199,description:"Premium smartphone with pro camera system and high-performance display.",image_url:placeholder,category_id:"s1",featured:true,in_stock:true,created_at:"2026-09-09"},
 {id:"p2",name:"MagSafe Clear Case",price:24,description:"Protective clear case with magnetic charging compatibility.",image_url:placeholder,category_id:"c2",featured:true,in_stock:true,created_at:"2026-09-08"},
 {id:"p3",name:"USB-C Fast Charger 30W",price:29,description:"Compact fast charger for compatible phones and accessories.",image_url:placeholder,category_id:"s3",featured:true,in_stock:true,created_at:"2026-09-07"},
 {id:"p4",name:"Wireless Earbuds",price:59,description:"Compact everyday earbuds with charging case.",image_url:placeholder,category_id:"c4",featured:false,in_stock:true,created_at:"2026-09-06"},
 {id:"p5",name:"10,000mAh Power Bank",price:39,description:"Portable power bank for everyday charging on the move.",image_url:placeholder,category_id:"c5",featured:false,in_stock:true,created_at:"2026-09-05"},
 {id:"p6",name:"Smart Watch",price:89,description:"Everyday smart watch with fitness and notification features.",image_url:placeholder,category_id:"c6",featured:false,in_stock:true,created_at:"2026-09-04"}
];

let categories=[];
let products=[];
let activeCategory="all";
let search="";
let sort="newest";
let cart=JSON.parse(localStorage.getItem("hadi_cart") || "[]");

const $=s=>document.querySelector(s);
const money=n=>`$${Number(n).toFixed(2)}`;
const catName=id=>categories.find(c=>String(c.id)===String(id))?.name || "Tech";
const escapeHtml=(s="")=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const escapeAttr=escapeHtml;

async function load(){
  if(sb){
    const [{data:cats,error:ce},{data:prods,error:pe}] = await Promise.all([
      sb.from("categories").select("*").order("sort_order"),
      sb.from("products").select("*").eq("is_active",true).order("created_at",{ascending:false})
    ]);
    if(!ce && !pe){
      categories=cats||[];
      products=prods||[];
    }else{
      categories=DEMO_CATEGORIES;
      products=DEMO_PRODUCTS;
    }
  }else{
    categories=DEMO_CATEGORIES;
    products=DEMO_PRODUCTS;
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

function iconForCategory(name=""){
  const n=name.toLowerCase();
  if(n.includes("phone")) return '<svg viewBox="0 0 24 24"><path d="M8 2h8v20H8Zm3 17h2"/></svg>';
  if(n.includes("case")||n.includes("protect")) return '<svg viewBox="0 0 24 24"><path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/></svg>';
  if(n.includes("charg")||n.includes("cable")) return '<svg viewBox="0 0 24 24"><path d="M9 2v6m6-6v6M7 8h10v4a5 5 0 0 1-10 0Z"/></svg>';
  if(n.includes("audio")||n.includes("ear")) return '<svg viewBox="0 0 24 24"><path d="M4 13v-2a8 8 0 0 1 16 0v2m-16 0v5h4v-7H4m16 2v5h-4v-7h4"/></svg>';
  if(n.includes("watch")) return '<svg viewBox="0 0 24 24"><path d="M8 7h8l1 10H7Zm1-5h6l1 5H8Zm0 20h6l1-5H8Z"/></svg>';
  if(n.includes("power")) return '<svg viewBox="0 0 24 24"><path d="M7 4h10v16H7Zm10 5h2v6h-2M10 8h4"/></svg>';
  if(n.includes("gaming")) return '<svg viewBox="0 0 24 24"><path d="M8 8h8l4 3v6l-3 2-3-3h-4l-3 3-3-2v-6Zm-1 5h4m-2-2v4m6-2h.01m2 2h.01"/></svg>';
  return '<svg viewBox="0 0 24 24"><path d="M4 4h6v6H4Zm10 0h6v6h-6ZM4 14h6v6H4Zm10 0h6v6h-6Z"/></svg>';
}

function card(p){
  return `<article class="product-card">
    <div class="product-image-wrap" data-view="${p.id}">
      <img src="${p.image_url||placeholder}" alt="${escapeAttr(p.name)}" loading="lazy">
      ${p.featured?'<span class="product-badge">FEATURED</span>':""}
    </div>
    <div class="product-body">
      <div class="product-category">${escapeHtml(catName(p.category_id))}</div>
      <h3>${escapeHtml(p.name)}</h3>
      <div class="product-price">${money(p.price)}</div>
      <div class="product-actions">
        <button class="add-btn" data-add="${p.id}" ${p.in_stock===false?"disabled":""}>${p.in_stock===false?"Out of stock":"Add to cart"}</button>
        <button class="view-btn" data-view="${p.id}" aria-label="View details for ${escapeAttr(p.name)}" title="View details">View details</button>
      </div>
    </div>
  </article>`;
}

function bindCards(scope=document){
  scope.querySelectorAll("[data-add]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    addToCart(b.dataset.add);
  });
  scope.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>openProduct(b.dataset.view));
}

function renderFeatured(){
  const grid=$("#featuredGrid");
  const section=$("#featuredSection");
  if(!grid||!section) return;
  const list=products.filter(p=>p.featured).slice(0,4);
  section.classList.toggle("hidden",!list.length);
  grid.innerHTML=list.map(card).join("");
  bindCards(grid);
}

function initHomeSearch(){
  const form=$("#homeSearchForm");
  const input=$("#homeSearchInput");
  if(!form||!input) return;
  form.addEventListener("submit",e=>{
    e.preventDefault();
    const q=input.value.trim();
    location.href=q?`categories.html?q=${encodeURIComponent(q)}`:"categories.html";
  });
}

/* Scroll animation: fully reversible because every frame is based on current scroll progress */
function initHeroScrollAnimation(){
  const hero=$(".hero");
  const device=$("#heroDevice");
  const frame=$("#deviceFrame");
  const island=$("#deviceIsland");
  const brand=$("#deviceBrand");
  const subBrand=$("#deviceSubBrand");
  const tagline=$("#deviceTagline");

  if(!hero||!device||!frame) return;
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let ticking=false;

  function update(){
    ticking=false;

    const heroTop=hero.getBoundingClientRect().top;
    const distance=Math.max(hero.offsetHeight*0.72,1);
    const progress=Math.max(0,Math.min(1,-heroTop/distance));

    const phoneY=-58*progress;
    const phoneScale=1-(0.065*progress);
    const phoneOpacity=1-(0.08*progress);

    const rotateZ=8-(11*progress);
    const rotateX=9-(3*progress);
    const frameY=54-(18*progress);

    device.style.transform=`translate3d(0, ${phoneY}px, 0) scale(${phoneScale})`;
    device.style.opacity=String(phoneOpacity);

    frame.style.transform=`rotateX(${rotateX}deg) rotateZ(${rotateZ}deg) translateY(${frameY}px)`;

    if(brand){
      brand.style.transform=`translate3d(0, ${-10*progress}px, 0)`;
      brand.style.opacity=String(1-(0.12*progress));
    }
    if(subBrand){
      subBrand.style.transform=`translate3d(0, ${-4*progress}px, 0) scale(${1+(0.035*progress)})`;
    }
    if(tagline){
      tagline.style.transform=`translate3d(0, ${8*progress}px, 0)`;
      tagline.style.opacity=String(1-(0.35*progress));
    }
    if(island){
      island.style.transform=`scaleX(${1-(0.08*progress)})`;
    }
  }

  function requestUpdate(){
    if(!ticking){
      ticking=true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener("scroll",requestUpdate,{passive:true});
  window.addEventListener("resize",requestUpdate,{passive:true});
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
      if(search){
        activeCategory="all";
        showProductsSection();
      }else if(activeCategory==="all"){
        showCategoriesSection();
      }
      renderCategoryCards();
      renderCategoryProducts();
    });
  }

  const sortSelect=$("#sortSelect");
  if(sortSelect){
    sortSelect.addEventListener("change",e=>{
      sort=e.target.value;
      renderCategoryProducts();
    });
  }

  $("#backToCategories")?.addEventListener("click",()=>{
    activeCategory="all";
    search="";
    if(input) input.value="";
    history.replaceState(null,"","categories.html");
    showCategoriesSection();
    renderCategoryCards();
    window.scrollTo({top:0,behavior:"smooth"});
  });

  renderCategoryCards();

  if(activeCategory!=="all"||search){
    showProductsSection();
    renderCategoryProducts();
  }else{
    showCategoriesSection();
  }
}

function renderCategoryCards(){
  const grid=$("#categoryCardGrid");
  if(!grid) return;

  grid.innerHTML=rootCategories().map(c=>{
    const ids=descendantIds(c.id);
    const count=products.filter(p=>ids.includes(String(p.category_id))).length;
    return `<button class="category-card" data-category-card="${c.id}">
      <div class="category-card-icon">${iconForCategory(c.name)}</div>
      <strong>${escapeHtml(c.name)}</strong>
      <span>${count} ${count===1?"product":"products"}</span>
    </button>`;
  }).join("");

  grid.querySelectorAll("[data-category-card]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      activeCategory=btn.dataset.categoryCard;
      search="";
      const input=$("#searchInput");
      if(input) input.value="";
      history.replaceState(null,"",`categories.html?category=${encodeURIComponent(activeCategory)}`);
      showProductsSection();
      renderCategoryProducts();
      $("#categoryProductsSection")?.scrollIntoView({behavior:"smooth",block:"start"});
    });
  });
}

function showCategoriesSection(){
  $("#categoryChooserSection")?.classList.remove("hidden");
  $("#categoryProductsSection")?.classList.add("hidden");
}

function showProductsSection(){
  $("#categoryChooserSection")?.classList.add("hidden");
  $("#categoryProductsSection")?.classList.remove("hidden");
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

  if(sort==="price-low") list.sort((a,b)=>Number(a.price)-Number(b.price));
  else if(sort==="price-high") list.sort((a,b)=>Number(b.price)-Number(a.price));
  else if(sort==="name") list.sort((a,b)=>a.name.localeCompare(b.name));
  else list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));

  return list;
}

function renderCategoryProducts(){
  const grid=$("#productGrid");
  if(!grid) return;

  const selected=categories.find(c=>String(c.id)===String(activeCategory));
  const title=$("#productsTitle");
  const eyebrow=$("#selectedCategoryEyebrow");

  if(title) title.textContent=search?"Search results":(selected?.name||"All products");
  if(eyebrow) eyebrow.textContent=search?"SEARCH":"CATEGORY";

  const sub=$("#subcategoryList");
  if(sub){
    const kids=selected?childrenOf(selected.id):[];
    sub.innerHTML=kids.map(c=>`<button class="subcategory-chip" data-sub="${c.id}">${escapeHtml(c.name)}</button>`).join("");

    sub.querySelectorAll("[data-sub]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        activeCategory=btn.dataset.sub;
        history.replaceState(null,"",`categories.html?category=${encodeURIComponent(activeCategory)}`);
        renderCategoryProducts();
      });
    });
  }

  const list=filteredProducts();
  grid.innerHTML=list.map(card).join("");
  bindCards(grid);

  $("#emptyState")?.classList.toggle("hidden",list.length>0);
  if($("#productCount")){
    $("#productCount").textContent=`${list.length} ${list.length===1?"product":"products"}`;
  }
}

function openProduct(id){
  const p=products.find(x=>String(x.id)===String(id));
  const modal=$("#productModal");
  const content=$("#productModalContent");
  if(!p||!modal||!content) return;

  content.innerHTML=`<div class="modal-product">
    <img src="${p.image_url||placeholder}" alt="${escapeAttr(p.name)}">
    <div class="modal-copy">
      <span class="eyebrow">${escapeHtml(catName(p.category_id))}</span>
      <h2>${escapeHtml(p.name)}</h2>
      <div class="modal-price">${money(p.price)}</div>
      <p class="desc">${escapeHtml(p.description||"")}</p>
      <div class="stock-note">${p.in_stock===false?"Currently out of stock":"In stock"}</div>
      <button class="primary-btn" style="margin-top:16px" data-add="${p.id}" ${p.in_stock===false?"disabled":""}>${p.in_stock===false?"Out of stock":"Add to cart"}</button>
    </div>
  </div>`;

  bindCards(content);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
}

function addToCart(id){
  const p=products.find(x=>String(x.id)===String(id));
  if(!p||p.in_stock===false) return;

  const existing=cart.find(x=>String(x.id)===String(id));
  if(existing) existing.qty++;
  else cart.push({id:p.id,name:p.name,price:Number(p.price),image_url:p.image_url||placeholder,qty:1});

  saveCart();
  openCart();
}

function saveCart(){
  localStorage.setItem("hadi_cart",JSON.stringify(cart));
  renderCart();
}

function renderCart(){
  const count=cart.reduce((s,i)=>s+i.qty,0);
  const total=cart.reduce((s,i)=>s+i.price*i.qty,0);

  if($("#cartCount")) $("#cartCount").textContent=count;
  if($("#bottomCartCount")) $("#bottomCartCount").textContent=count;
  if($("#cartTotal")) $("#cartTotal").textContent=money(total);

  const empty=$("#cartEmpty");
  const items=$("#cartItems");
  if(!empty||!items) return;

  empty.classList.toggle("hidden",cart.length>0);
  items.classList.toggle("hidden",cart.length===0);

  items.innerHTML=cart.map(i=>`<div class="cart-row">
    <img src="${i.image_url||placeholder}" alt="">
    <div>
      <h4>${escapeHtml(i.name)}</h4>
      <small>${money(i.price)}</small>
      <div class="qty">
        <button data-dec="${i.id}">−</button>
        <span>${i.qty}</span>
        <button data-inc="${i.id}">+</button>
      </div>
    </div>
    <button class="remove" data-remove="${i.id}">Remove</button>
  </div>`).join("");

  items.querySelectorAll("[data-inc]").forEach(b=>b.onclick=()=>changeQty(b.dataset.inc,1));
  items.querySelectorAll("[data-dec]").forEach(b=>b.onclick=()=>changeQty(b.dataset.dec,-1));
  items.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{
    cart=cart.filter(i=>String(i.id)!==String(b.dataset.remove));
    saveCart();
  });
}

function changeQty(id,n){
  const item=cart.find(x=>String(x.id)===String(id));
  if(!item) return;

  item.qty+=n;
  if(item.qty<=0){
    cart=cart.filter(x=>String(x.id)!==String(id));
  }
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

function checkout(){
  if(!cart.length) return;

  const total=cart.reduce((s,i)=>s+i.price*i.qty,0);
  const lines=cart.map((i,n)=>`${n+1}. ${i.name} × ${i.qty} — ${money(i.price*i.qty)}`).join("\n");
  const msg=`Hello HADI MOBILE 👋\n\nI'd like to place this order:\n\n${lines}\n\nTotal: ${money(total)}\n\nPlease confirm availability and continue the order with me here.`;

  window.open(`https://wa.me/${CFG.WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`,"_blank");
}

$("#cartButton")?.addEventListener("click",openCart);
$("#bottomCart")?.addEventListener("click",openCart);
$("#closeCart")?.addEventListener("click",closeCart);
$("#sheetBackdrop")?.addEventListener("click",closeCart);
$("#whatsappCheckout")?.addEventListener("click",checkout);

$("#closeProduct")?.addEventListener("click",()=>{
  $("#productModal")?.classList.remove("open");
  $("#productModal")?.setAttribute("aria-hidden","true");
});

$("#productModal")?.addEventListener("click",e=>{
  if(e.target===$("#productModal")){
    $("#productModal").classList.remove("open");
    $("#productModal").setAttribute("aria-hidden","true");
  }
});

load();
})();
