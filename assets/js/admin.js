const CFG=window.HADI_CONFIG;
if(!CFG.SUPABASE_URL || CFG.SUPABASE_URL.startsWith("YOUR_")) location.href="login.html";
const sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);

let products=[],categories=[],phoneOptions=[],productImages=[],productColors=[],promos=[],brands=[],restockRequests=[],setupDevices=[],setupRenders=[];
let editingBrandIcon=null,editingSetupDeviceImage=null,editingSetupDeviceModel3d=null,editingSetupRenderImage=null,editingSetupRenderModel3d=null;
let editingGallery=[],editingPromoImage=null;
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const slugify=s=>s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const uid=()=>`tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

injectAdminEnhancementStyles();

(async()=>{
  const {data:{session}}=await sb.auth.getSession();
  if(!session){location.href="login.html";return;}
  const {data:admin,error:adminError}=await sb.from("admins").select("user_id").eq("user_id",session.user.id).maybeSingle();
  if(adminError || !admin){
    await sb.auth.signOut();
    alert("This account is not authorized as an admin.");
    location.href="login.html";
    return;
  }
  await reload();
})();

async function reload(){
  const [c,p,o,i,col,pr,br,rr,sd,sr]=await Promise.all([
    sb.from("categories").select("*").order("sort_order"),
    sb.from("products").select("*").order("created_at",{ascending:false}),
    sb.from("product_phone_options").select("*").order("sort_order"),
    sb.from("product_images").select("*").order("sort_order"),
    sb.from("product_colors").select("*").order("sort_order"),
    sb.from("home_promotions").select("*").order("sort_order"),
    sb.from("brands").select("*").order("sort_order"),
    sb.from("restock_requests").select("*").order("created_at",{ascending:false}),
    sb.from("setup_devices").select("*").order("sort_order"),
    sb.from("setup_product_renders").select("*").order("created_at",{ascending:false})
  ]);
  [c,p,o,i,col,pr,br,rr,sd,sr].forEach((r,idx)=>{if(r.error)console.error(["Categories","Products","Phone options","Images","Colors","Promos","Brands","Requests","Setup devices","Setup renders"][idx],r.error);});
  categories=c.data||[];products=p.data||[];phoneOptions=o.data||[];productImages=i.data||[];productColors=col.data||[];promos=pr.data||[];brands=br.data||[];restockRequests=rr.data||[];setupDevices=sd.data||[];setupRenders=sr.data||[];
  render();
}

const optionsFor=id=>phoneOptions.filter(o=>String(o.product_id)===String(id));
const imagesFor=id=>productImages.filter(o=>String(o.product_id)===String(id));
const colorsFor=id=>productColors.filter(o=>String(o.product_id)===String(id));

function render(){
  $("#stats").innerHTML=`
    <div class="stat"><strong>${products.length}</strong><span>PRODUCTS</span></div>
    <div class="stat"><strong>${promos.filter(x=>x.is_active).length}</strong><span>ACTIVE PROMOS</span></div>
    <div class="stat"><strong>${products.filter(p=>p.in_stock).length}</strong><span>IN STOCK</span></div>
    <div class="stat"><strong>${restockRequests.filter(r=>!r.notified).length}</strong><span>WAITING</span></div>`;

  $("#productList").innerHTML=products.map(p=>{
    const opts=optionsFor(p.id), imgs=imagesFor(p.id), cols=colorsFor(p.id);
    const status=p.availability_status||"standard";
    const stockSummary=status==="preorder"?" · Preorder":status==="coming_soon"?" · Coming soon":p.has_phone_options?` · ${opts.filter(o=>o.in_stock).length}/${opts.length} phones available`:(p.in_stock?" · In stock":" · Out of stock");
    const brand=brands.find(b=>String(b.id)===String(p.brand_id))?.name||"";
    return `<div class="admin-row">
      <img src="${p.image_url||imgs[0]?.image_url||"../assets/img/hadi-mobile-logo.jpg"}">
      <div class="row-main"><strong>${esc(p.name)}</strong><span>$${Number(p.price).toFixed(2)}${Number(p.compare_at_price)>Number(p.price)?` (was $${Number(p.compare_at_price).toFixed(2)})`:""} · ${esc(categories.find(c=>c.id===p.category_id)?.name||"No category")}${brand?` · ${esc(brand)}`:""}${p.is_new_arrival?" · New":""}${p.is_trending?" · Trending":""}${p.featured?" · Featured":""}${stockSummary}${imgs.length?` · ${imgs.length} photos`:""}${cols.length?` · ${cols.length} colors`:""}</span></div>
      <div class="row-actions"><button class="mini-btn" data-editp="${p.id}">Edit</button><button class="mini-btn danger" data-delp="${p.id}">Delete</button></div>
    </div>`;
  }).join("");

  $("#promoList").innerHTML=promos.length?promos.map(pr=>{
    const p=products.find(x=>String(x.id)===String(pr.product_id));
    return `<div class="admin-row"><img src="${pr.image_url||"../assets/img/hadi-mobile-logo.jpg"}"><div class="row-main"><strong>${esc(pr.show_title?pr.title||"Untitled promo":"Image promo")}</strong><span>${esc(p?.name||"No product")}${pr.is_active?" · Active":" · Hidden"}</span></div><div class="row-actions"><button class="mini-btn" data-editpromo="${pr.id}">Edit</button><button class="mini-btn danger" data-delpromo="${pr.id}">Delete</button></div></div>`;
  }).join(""):`<div class="empty-admin">No homepage promos yet.</div>`;

  const merch=$("#homepageMerchList");
  if(merch){
    merch.innerHTML=products.length?products.map(p=>{
      const status=p.availability_status||"standard";
      return `<div class="homepage-merch-row">
        <img src="${p.image_url||imagesFor(p.id)[0]?.image_url||"../assets/img/hadi-mobile-logo.jpg"}" alt="">
        <div class="homepage-merch-main">
          <strong>${esc(p.name)}</strong>
          <select class="quick-status" data-quick-status="${p.id}">
            <option value="standard" ${status==="standard"?"selected":""}>Standard</option>
            <option value="preorder" ${status==="preorder"?"selected":""}>Preorder</option>
            <option value="coming_soon" ${status==="coming_soon"?"selected":""}>Coming soon</option>
          </select>
        </div>
        <label class="merch-check"><input type="checkbox" data-merch="${p.id}" data-field="is_new_arrival" ${p.is_new_arrival?"checked":""}>New</label>
        <label class="merch-check"><input type="checkbox" data-merch="${p.id}" data-field="is_trending" ${p.is_trending?"checked":""}>Trending</label>
        <label class="merch-check"><input type="checkbox" data-merch="${p.id}" data-field="featured" ${p.featured?"checked":""}>Featured</label>
      </div>`;
    }).join(""):`<div class="empty-admin">Add products first.</div>`;
  }

  const brandPreview=$("#homepageBrandPreview");
  if(brandPreview){
    const visibleBrands=brands.map(b=>({b,count:products.filter(p=>p.is_active!==false&&String(p.brand_id)===String(b.id)).length})).filter(x=>x.count);
    brandPreview.innerHTML=visibleBrands.length?visibleBrands.map(x=>`<span class="brand-preview-chip">${x.b.icon_url?`<img src="${x.b.icon_url}" alt="">`:""}${esc(x.b.name)} <b>${x.count}</b></span>`).join(""):`<div class="empty-admin">Assign a brand to at least one active product and it will appear here automatically.</div>`;
  }

  $("#categoryAdminList").innerHTML=categories.map(c=>`<div class="admin-row"><div class="cat-icon">${c.parent_id?"↳":"# "}</div><div class="row-main"><strong>${esc(c.name)}</strong><span>${c.parent_id?"Subcategory of "+esc(categories.find(x=>x.id===c.parent_id)?.name||"Unknown"):"Main category"} · Order ${c.sort_order||0}</span></div><div class="row-actions"><button class="mini-btn" data-editc="${c.id}">Edit</button><button class="mini-btn danger" data-delc="${c.id}">Delete</button></div></div>`).join("");

  $("#brandList").innerHTML=brands.length?brands.map(b=>`<div class="admin-row"><div class="cat-icon brand-admin-icon">${b.icon_url?`<img src="${b.icon_url}" alt="">`:esc(b.name).slice(0,1).toUpperCase()}</div><div class="row-main"><strong>${esc(b.name)}</strong><span>Order ${b.sort_order||0} · ${products.filter(p=>String(p.brand_id)===String(b.id)).length} products</span></div><div class="row-actions"><button class="mini-btn" data-editbrand="${b.id}">Edit</button><button class="mini-btn danger" data-delbrand="${b.id}">Delete</button></div></div>`).join(""):`<div class="empty-admin">No brands yet.</div>`;

  if($("#setupDeviceList")) $("#setupDeviceList").innerHTML=setupDevices.length?setupDevices.map(d=>`<div class="admin-row"><img src="${d.base_image_url||"../assets/img/hadi-mobile-logo.jpg"}"><div class="row-main"><strong>${esc(d.phone_model)}</strong><span>Order ${d.sort_order||0}${d.is_active?" · Active":" · Hidden"} · ${setupRenders.filter(r=>String(r.device_id)===String(d.id)).length} renders</span></div><div class="row-actions"><button class="mini-btn" data-editdevice="${d.id}">Edit</button><button class="mini-btn danger" data-deldevice="${d.id}">Delete</button></div></div>`).join(""):`<div class="empty-admin">No phone renders yet.</div>`;

  if($("#setupRenderList")) $("#setupRenderList").innerHTML=setupRenders.length?setupRenders.map(r=>{const prod=products.find(p=>String(p.id)===String(r.product_id));const dev=setupDevices.find(d=>String(d.id)===String(r.device_id));return `<div class="admin-row"><img src="${r.image_url||"../assets/img/hadi-mobile-logo.jpg"}"><div class="row-main"><strong>${esc(prod?.name||"Deleted product")}</strong><span>${esc(dev?.phone_model||"Unknown phone")} · ${esc(r.slot||"other")} · X ${Number(r.pos_x||50)} / Y ${Number(r.pos_y||50)} / Scale ${Number(r.scale||100)}%</span></div><div class="row-actions"><button class="mini-btn" data-editrender="${r.id}">Edit</button><button class="mini-btn danger" data-delrender="${r.id}">Delete</button></div></div>`;}).join(""):`<div class="empty-admin">No accessory renders yet.</div>`;

  $("#requestList").innerHTML=restockRequests.length?restockRequests.map(r=>{const p=products.find(x=>String(x.id)===String(r.product_id));return `<div class="admin-row"><div class="cat-icon">${r.notified?"✓":"!"}</div><div class="row-main"><strong>${esc(p?.name||"Deleted product")}</strong><span>${r.phone_model?esc(r.phone_model)+" · ":""}${r.color_name?esc(r.color_name)+" · ":""}${esc(r.customer_contact)} · ${new Date(r.created_at).toLocaleDateString()}</span></div><div class="row-actions"><button class="mini-btn" data-toggle-request="${r.id}">${r.notified?"Mark waiting":"Mark contacted"}</button><button class="mini-btn danger" data-delrequest="${r.id}">Delete</button></div></div>`;}).join(""):`<div class="empty-admin">No availability requests yet.</div>`;

  $("#productCategory").innerHTML=categoryOptions();
  $("#productBrand").innerHTML='<option value="">No brand</option>'+brands.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join("");
  $("#promoProduct").innerHTML=products.filter(p=>p.is_active!==false).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
  if($("#setupRenderProduct")) $("#setupRenderProduct").innerHTML=products.filter(p=>p.is_active!==false).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
  if($("#setupRenderDevice")) $("#setupRenderDevice").innerHTML=setupDevices.map(d=>`<option value="${d.id}">${esc(d.phone_model)}</option>`).join("");
  bind();
}

function categoryOptions(exclude=""){
  return categories.filter(c=>c.id!==exclude).map(c=>`<option value="${c.id}">${c.parent_id?"↳ ":""}${esc(c.name)}</option>`).join("");
}

function bind(){
  document.querySelectorAll("[data-editp]").forEach(b=>b.onclick=()=>editProduct(b.dataset.editp));
  document.querySelectorAll("[data-delp]").forEach(b=>b.onclick=()=>deleteProduct(b.dataset.delp));
  document.querySelectorAll("[data-editc]").forEach(b=>b.onclick=()=>editCategory(b.dataset.editc));
  document.querySelectorAll("[data-delc]").forEach(b=>b.onclick=()=>deleteCategory(b.dataset.delc));
  document.querySelectorAll("[data-editpromo]").forEach(b=>b.onclick=()=>editPromo(b.dataset.editpromo));
  document.querySelectorAll("[data-delpromo]").forEach(b=>b.onclick=()=>deletePromo(b.dataset.delpromo));
  document.querySelectorAll("[data-editbrand]").forEach(b=>b.onclick=()=>editBrand(b.dataset.editbrand));
  document.querySelectorAll("[data-delbrand]").forEach(b=>b.onclick=()=>deleteBrand(b.dataset.delbrand));
  document.querySelectorAll("[data-editdevice]").forEach(b=>b.onclick=()=>editSetupDevice(b.dataset.editdevice));
  document.querySelectorAll("[data-deldevice]").forEach(b=>b.onclick=()=>deleteSetupDevice(b.dataset.deldevice));
  document.querySelectorAll("[data-editrender]").forEach(b=>b.onclick=()=>editSetupRender(b.dataset.editrender));
  document.querySelectorAll("[data-delrender]").forEach(b=>b.onclick=()=>deleteSetupRender(b.dataset.delrender));
  document.querySelectorAll("[data-toggle-request]").forEach(b=>b.onclick=()=>toggleRequest(b.dataset.toggleRequest));
  document.querySelectorAll("[data-delrequest]").forEach(b=>b.onclick=()=>deleteRequest(b.dataset.delrequest));
  document.querySelectorAll("[data-merch]").forEach(i=>i.onchange=()=>quickMerchUpdate(i.dataset.merch,i.dataset.field,i.checked,i));
  document.querySelectorAll("[data-quick-status]").forEach(s=>s.onchange=()=>quickStatusUpdate(s.dataset.quickStatus,s.value,s));
}

document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");
  document.querySelectorAll(".tab-panel").forEach(p=>p.classList.add("hidden"));
  $("#"+b.dataset.tab+"Tab")?.classList.remove("hidden");
});
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).classList.remove("open"));

$("#newProduct").onclick=()=>{
  $("#productForm").reset();$("#productId").value="";$("#productStock").checked=true;$("#productActive").checked=true;$("#productStatus").value="standard";$("#productBrand").value="";
  $("#productHasPhoneOptions").checked=false;$("#productHasColors").checked=false;$("#productEditorTitle").textContent="Add product";
  $("#phoneOptionsRows").innerHTML="";$("#colorOptionsRows").innerHTML="";editingGallery=[];renderImageManager();toggleDrawers();$("#productEditor").classList.add("open");
};
$("#newPromo").onclick=()=>{
  $("#promoForm").reset();$("#promoId").value="";$("#promoShowTitle").checked=true;$("#promoActive").checked=true;$("#promoButtonText").value="Shop now";$("#promoEditorTitle").textContent="Add promo";$("#currentPromoImage").innerHTML="";editingPromoImage=null;$("#promoEditor").classList.add("open");
};
$("#newCategory").onclick=()=>{
  $("#categoryForm").reset();$("#categoryId").value="";$("#categoryEditorTitle").textContent="Add category";$("#categoryParent").innerHTML='<option value="">None — main category</option>'+categoryOptions();$("#categoryEditor").classList.add("open");
};
$("#newBrand").onclick=()=>{
  $("#brandForm").reset();$("#brandId").value="";editingBrandIcon=null;$("#currentBrandIcon").innerHTML="";$("#brandEditorTitle").textContent="Add brand";$("#brandEditor").classList.add("open");
};
$("#newSetupDevice")?.addEventListener("click",()=>{
  $("#setupDeviceForm").reset();$("#setupDeviceId").value="";$("#setupDeviceOrder").value=0;$("#setupDeviceActive").checked=true;editingSetupDeviceImage=null;editingSetupDeviceModel3d=null;$("#currentSetupDeviceImage").innerHTML="";$("#setupDeviceEditorTitle").textContent="Add phone render";$("#setupDeviceEditor").classList.add("open");
});
$("#newSetupRender")?.addEventListener("click",()=>{
  if(!setupDevices.length){alert("Add a phone render first.");return;}
  $("#setupRenderForm").reset();$("#setupRenderId").value="";$("#setupRenderX").value=50;$("#setupRenderY").value=50;$("#setupRenderScale").value=100;$("#setupRenderZ").value=10;$("#setupRenderActive").checked=true;editingSetupRenderImage=null;editingSetupRenderModel3d=null;$("#currentSetupRenderImage").innerHTML="";$("#setupRenderEditorTitle").textContent="Add accessory render";$("#setupRenderEditor").classList.add("open");
});

function editProduct(id){
  const p=products.find(x=>String(x.id)===String(id));if(!p)return;
  $("#productId").value=p.id;$("#productName").value=p.name;$("#productPrice").value=p.price;$("#productComparePrice").value=p.compare_at_price??"";$("#productCategory").value=p.category_id||"";$("#productBrand").value=p.brand_id||"";$("#productStatus").value=p.availability_status||"standard";$("#productExpectedDate").value=p.expected_date||"";$("#productDescription").value=p.description||"";
  $("#productStock").checked=!!p.in_stock;$("#productFeatured").checked=!!p.featured;$("#productNewArrival").checked=!!p.is_new_arrival;$("#productTrending").checked=!!p.is_trending;$("#productActive").checked=p.is_active!==false;$("#productHasPhoneOptions").checked=!!p.has_phone_options;$("#productHasColors").checked=!!p.has_color_options;$("#productEditorTitle").textContent="Edit product";
  $("#phoneOptionsRows").innerHTML="";optionsFor(p.id).forEach(o=>addPhoneRow(o.phone_model,o.in_stock));
  $("#colorOptionsRows").innerHTML="";colorsFor(p.id).forEach(c=>addColorRow(c.name,c.hex_color,c.id));
  const existing=imagesFor(p.id);
  editingGallery=existing.length?existing.map(img=>({key:uid(),id:img.id,url:img.image_url,file:null,isPrimary:!!img.is_primary,colorKey:img.color_id||""})):(p.image_url?[{key:uid(),id:null,url:p.image_url,file:null,isPrimary:true,colorKey:""}]:[]);
  if(editingGallery.length&&!editingGallery.some(x=>x.isPrimary))editingGallery[0].isPrimary=true;
  renderImageManager();toggleDrawers();$("#productEditor").classList.add("open");
}

function editPromo(id){
  const pr=promos.find(x=>String(x.id)===String(id));if(!pr)return;
  $("#promoId").value=pr.id;$("#promoTitle").value=pr.title||"";$("#promoShowTitle").checked=pr.show_title!==false;$("#promoButtonText").value=pr.button_text||"Shop now";$("#promoProduct").value=pr.product_id||"";$("#promoActive").checked=pr.is_active!==false;editingPromoImage=pr.image_url||null;$("#currentPromoImage").innerHTML=pr.image_url?`<img src="${pr.image_url}">`:"";$("#promoEditorTitle").textContent="Edit promo";$("#promoEditor").classList.add("open");
}
function editBrand(id){
  const b=brands.find(x=>String(x.id)===String(id));if(!b)return;
  $("#brandId").value=b.id;$("#brandName").value=b.name;$("#brandOrder").value=b.sort_order||0;editingBrandIcon=b.icon_url||null;$("#currentBrandIcon").innerHTML=b.icon_url?`<img src="${b.icon_url}" alt="${esc(b.name)}">`:"";$("#brandEditorTitle").textContent="Edit brand";$("#brandEditor").classList.add("open");
}
function editSetupDevice(id){
  const d=setupDevices.find(x=>String(x.id)===String(id));if(!d)return;
  $("#setupDeviceId").value=d.id;$("#setupDeviceModel").value=d.phone_model||"";$("#setupDeviceOrder").value=d.sort_order||0;$("#setupDeviceActive").checked=d.is_active!==false;editingSetupDeviceImage=d.base_image_url||null;editingSetupDeviceModel3d=d.base_model_url||null;$("#currentSetupDeviceImage").innerHTML=d.base_image_url?`<img src="${d.base_image_url}" alt="">`:"";$("#setupDeviceEditorTitle").textContent="Edit phone render";$("#setupDeviceEditor").classList.add("open");
}
function editSetupRender(id){
  const r=setupRenders.find(x=>String(x.id)===String(id));if(!r)return;
  $("#setupRenderId").value=r.id;$("#setupRenderProduct").value=r.product_id||"";$("#setupRenderDevice").value=r.device_id||"";$("#setupRenderSlot").value=r.slot||"case";$("#setupRenderX").value=Number(r.pos_x||50);$("#setupRenderY").value=Number(r.pos_y||50);$("#setupRenderScale").value=Number(r.scale||100);$("#setupRenderZ").value=Number(r.z_index||10);$("#setupRenderActive").checked=r.is_active!==false;editingSetupRenderImage=r.image_url||null;editingSetupRenderModel3d=r.model_url||null;$("#currentSetupRenderImage").innerHTML=r.image_url?`<img src="${r.image_url}" alt="">`:"";$("#setupRender3dX").value=Number(r.model_pos_x||0);$("#setupRender3dY").value=Number(r.model_pos_y||0);$("#setupRender3dZ").value=Number(r.model_pos_z||0);$("#setupRender3dScale").value=Number(r.model_scale||1);$("#setupRender3dRotX").value=Number(r.model_rot_x||0);$("#setupRender3dRotY").value=Number(r.model_rot_y||0);$("#setupRender3dRotZ").value=Number(r.model_rot_z||0);$("#setupRenderEditorTitle").textContent="Edit accessory render";$("#setupRenderEditor").classList.add("open");
}

function editCategory(id){
  const c=categories.find(x=>String(x.id)===String(id));if(!c)return;
  $("#categoryId").value=c.id;$("#categoryName").value=c.name;$("#categoryOrder").value=c.sort_order||0;$("#categoryParent").innerHTML='<option value="">None — main category</option>'+categoryOptions(c.id);$("#categoryParent").value=c.parent_id||"";$("#categoryEditorTitle").textContent="Edit category";$("#categoryEditor").classList.add("open");
}

$("#productHasPhoneOptions").addEventListener("change",()=>{if($("#productHasPhoneOptions").checked&&!$("#phoneOptionsRows").children.length)addPhoneRow("",true);toggleDrawers();});
$("#productHasColors").addEventListener("change",()=>{if($("#productHasColors").checked&&!$("#colorOptionsRows").children.length)addColorRow("Black","#111111");toggleDrawers();renderImageManager();});
$("#addPhoneOption").onclick=()=>addPhoneRow("",true);
$("#addColorOption").onclick=()=>{addColorRow("","#111111");renderImageManager();};

function addPhoneRow(model="",inStock=true){
  const row=document.createElement("div");row.className="phone-option-row";row.innerHTML=`<input class="phone-model-input" type="text" placeholder="e.g. iPhone 17 Pro" value="${esc(model)}"><label class="phone-stock-switch"><input class="phone-stock-input" type="checkbox" ${inStock?"checked":""}><span>In stock</span></label><button class="phone-remove-btn" type="button">×</button>`;row.querySelector(".phone-remove-btn").onclick=()=>row.remove();$("#phoneOptionsRows").appendChild(row);
}
function addColorRow(name="",hex="#111111",key=uid()){
  const row=document.createElement("div");row.className="color-option-row";row.dataset.colorKey=key;row.innerHTML=`<input class="color-swatch-input" type="color" value="${esc(hex||"#111111")}"><input class="color-name-input" type="text" placeholder="e.g. Orange" value="${esc(name)}"><button class="phone-remove-btn" type="button">×</button>`;
  row.querySelector(".phone-remove-btn").onclick=()=>{const removed=row.dataset.colorKey;row.remove();editingGallery.forEach(img=>{if(String(img.colorKey)===String(removed))img.colorKey="";});renderImageManager();};
  row.querySelectorAll("input").forEach(inp=>inp.addEventListener("input",()=>renderImageManager()));$("#colorOptionsRows").appendChild(row);
}
function toggleDrawers(){
  const phones=$("#productHasPhoneOptions").checked, colors=$("#productHasColors").checked;$("#phoneOptionsDrawer").classList.toggle("hidden",!phones);$("#colorOptionsDrawer").classList.toggle("hidden",!colors);$("#productStock").disabled=phones;const l=$("#productStock").closest("label");if(l)l.style.opacity=phones?".45":"1";
}
const getPhoneRows=()=>[...document.querySelectorAll(".phone-option-row")].map((row,index)=>({phone_model:row.querySelector(".phone-model-input").value.trim(),in_stock:row.querySelector(".phone-stock-input").checked,sort_order:index})).filter(r=>r.phone_model);
const getColorRows=()=>[...document.querySelectorAll(".color-option-row")].map((row,index)=>({key:row.dataset.colorKey,name:row.querySelector(".color-name-input").value.trim(),hex_color:row.querySelector(".color-swatch-input").value,sort_order:index})).filter(r=>r.name);

$("#productImages").addEventListener("change",e=>{
  [...e.target.files].forEach(file=>editingGallery.push({key:uid(),id:null,url:URL.createObjectURL(file),file,isPrimary:editingGallery.length===0,colorKey:""}));e.target.value="";renderImageManager();
});
function renderImageManager(){
  const box=$("#imageManager");if(!box)return;const colors=getColorRows();
  if(!editingGallery.length){box.innerHTML='<div class="image-empty">No photos added yet.</div>';return;}
  box.innerHTML=editingGallery.map((img,idx)=>`<div class="image-item" data-image-key="${img.key}"><img src="${img.url}"><div class="image-item-controls"><label class="cover-choice"><input type="radio" name="coverImage" ${img.isPrimary?"checked":""} data-cover="${img.key}"> Cover</label>${$("#productHasColors").checked?`<select data-image-color="${img.key}"><option value="">No color</option>${colors.map(c=>`<option value="${esc(c.key)}" ${String(c.key)===String(img.colorKey)?"selected":""}>${esc(c.name||"Color")}</option>`).join("")}</select>`:""}<button type="button" class="image-remove" data-remove-image="${img.key}">Remove</button></div></div>`).join("");
  box.querySelectorAll("[data-cover]").forEach(r=>r.onchange=()=>{editingGallery.forEach(x=>x.isPrimary=x.key===r.dataset.cover);});
  box.querySelectorAll("[data-image-color]").forEach(s=>s.onchange=()=>{const x=editingGallery.find(i=>i.key===s.dataset.imageColor);if(x)x.colorKey=s.value;});
  box.querySelectorAll("[data-remove-image]").forEach(b=>b.onclick=()=>{const was=editingGallery.find(x=>x.key===b.dataset.removeImage)?.isPrimary;editingGallery=editingGallery.filter(x=>x.key!==b.dataset.removeImage);if(was&&editingGallery.length)editingGallery[0].isPrimary=true;renderImageManager();});
}

async function uploadFile(file,prefix="product"){
  const ext=(file.name.split(".").pop()||"jpg").toLowerCase();const name=`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;const up=await sb.storage.from("product-images").upload(name,file,{cacheControl:"3600",upsert:false});if(up.error)throw up.error;return sb.storage.from("product-images").getPublicUrl(name).data.publicUrl;
}

$("#productForm").addEventListener("submit",async e=>{
  e.preventDefault();const msg=$("#productMsg");msg.textContent="Saving...";
  try{
    const hasPhones=$("#productHasPhoneOptions").checked, hasColors=$("#productHasColors").checked;const phones=hasPhones?getPhoneRows():[];const colors=hasColors?getColorRows():[];
    if(hasPhones&&!phones.length)throw new Error("Add at least one phone model.");
    if(hasColors&&!colors.length)throw new Error("Add at least one color.");
    if(new Set(phones.map(r=>r.phone_model.toLowerCase())).size!==phones.length)throw new Error("The same phone model was added more than once.");
    if(new Set(colors.map(r=>r.name.toLowerCase())).size!==colors.length)throw new Error("The same color was added more than once.");
    if(!editingGallery.length)throw new Error("Add at least one product photo.");

    for(const img of editingGallery){if(img.file){img.url=await uploadFile(img.file,"product");img.file=null;}}
    if(!editingGallery.some(x=>x.isPrimary))editingGallery[0].isPrimary=true;const cover=editingGallery.find(x=>x.isPrimary)||editingGallery[0];
    const compareRaw=$("#productComparePrice").value.trim();
    const payload={name:$("#productName").value.trim(),price:Number($("#productPrice").value),compare_at_price:compareRaw?Number(compareRaw):null,category_id:$("#productCategory").value||null,brand_id:$("#productBrand").value||null,availability_status:$("#productStatus").value||"standard",expected_date:$("#productExpectedDate").value.trim()||null,description:$("#productDescription").value.trim(),image_url:cover.url,in_stock:hasPhones?phones.some(r=>r.in_stock):$("#productStock").checked,featured:$("#productFeatured").checked,is_new_arrival:$("#productNewArrival").checked,is_trending:$("#productTrending").checked,is_active:$("#productActive").checked,has_phone_options:hasPhones,has_color_options:hasColors};
    if(payload.compare_at_price!==null&&payload.compare_at_price<=payload.price)payload.compare_at_price=null;
    let productId=$("#productId").value;
    if(productId){const r=await sb.from("products").update(payload).eq("id",productId).select("id").single();if(r.error)throw r.error;productId=r.data.id;}else{const r=await sb.from("products").insert(payload).select("id").single();if(r.error)throw r.error;productId=r.data.id;}

    let r=await sb.from("product_images").delete().eq("product_id",productId);if(r.error)throw r.error;
    r=await sb.from("product_colors").delete().eq("product_id",productId);if(r.error)throw r.error;
    r=await sb.from("product_phone_options").delete().eq("product_id",productId);if(r.error)throw r.error;

    const colorIdByKey={};
    if(hasColors&&colors.length){const ins=await sb.from("product_colors").insert(colors.map(c=>({product_id:productId,name:c.name,hex_color:c.hex_color,sort_order:c.sort_order}))).select("id,name,hex_color,sort_order");if(ins.error)throw ins.error;colors.forEach(c=>{const found=ins.data.find(x=>x.name===c.name&&x.sort_order===c.sort_order);if(found)colorIdByKey[c.key]=found.id;});}
    const imgs=editingGallery.map((img,index)=>({product_id:productId,image_url:img.url,is_primary:!!img.isPrimary,sort_order:index,color_id:img.colorKey?colorIdByKey[img.colorKey]||null:null}));
    r=await sb.from("product_images").insert(imgs);if(r.error)throw r.error;
    if(hasPhones&&phones.length){r=await sb.from("product_phone_options").insert(phones.map(x=>({...x,product_id:productId})));if(r.error)throw r.error;}

    $("#productEditor").classList.remove("open");msg.textContent="";await reload();
  }catch(err){console.error(err);msg.textContent=err.message||"Could not save product.";}
});

$("#promoForm").addEventListener("submit",async e=>{
  e.preventDefault();const msg=$("#promoMsg");msg.textContent="Saving...";
  try{
    let image_url=editingPromoImage;const file=$("#promoImage").files[0];if(file)image_url=await uploadFile(file,"promo");if(!image_url)throw new Error("Add a promo image.");
    const payload={image_url,title:$("#promoTitle").value.trim(),show_title:$("#promoShowTitle").checked,button_text:$("#promoButtonText").value.trim()||"Shop now",product_id:$("#promoProduct").value||null,is_active:$("#promoActive").checked};
    const id=$("#promoId").value;const r=id?await sb.from("home_promotions").update(payload).eq("id",id):await sb.from("home_promotions").insert(payload);if(r.error)throw r.error;$("#promoEditor").classList.remove("open");msg.textContent="";await reload();
  }catch(err){console.error(err);msg.textContent=err.message||"Could not save promo.";}
});

$("#brandForm").addEventListener("submit",async e=>{
  e.preventDefault();const msg=$("#brandMsg");msg.textContent="Saving...";
  try{
    const id=$("#brandId").value;
    let icon_url=editingBrandIcon;
    const file=$("#brandIcon").files[0];
    if(file) icon_url=await uploadFile(file,"brand");
    const payload={name:$("#brandName").value.trim(),sort_order:Number($("#brandOrder").value||0),icon_url:icon_url||null};
    const r=id?await sb.from("brands").update(payload).eq("id",id):await sb.from("brands").insert(payload);
    if(r.error)throw r.error;
    $("#brandEditor").classList.remove("open");msg.textContent="";await reload();
  }catch(err){console.error(err);msg.textContent=err.message||"Could not save brand.";}
});

$("#setupDeviceForm")?.addEventListener("submit",async e=>{
  e.preventDefault();const msg=$("#setupDeviceMsg");msg.textContent="Saving...";
  try{
    let base_image_url=editingSetupDeviceImage;const file=$("#setupDeviceImage").files[0];if(file)base_image_url=await uploadFile(file,"setup-phone");let base_model_url=editingSetupDeviceModel3d;const modelFile=$("#setupDeviceModel3d")?.files?.[0];if(modelFile)base_model_url=await uploadFile(modelFile,"setup-phone-3d");if(!base_image_url&&!base_model_url)throw new Error("Add a phone image or a GLB 3D model.");
    const payload={phone_model:$("#setupDeviceModel").value.trim(),base_image_url:base_image_url||"",base_model_url:base_model_url||null,sort_order:Number($("#setupDeviceOrder").value||0),is_active:$("#setupDeviceActive").checked};
    const id=$("#setupDeviceId").value;const r=id?await sb.from("setup_devices").update(payload).eq("id",id):await sb.from("setup_devices").insert(payload);if(r.error)throw r.error;$("#setupDeviceEditor").classList.remove("open");msg.textContent="";await reload();
  }catch(err){console.error(err);msg.textContent=err.message||"Could not save phone render.";}
});

$("#setupRenderForm")?.addEventListener("submit",async e=>{
  e.preventDefault();const msg=$("#setupRenderMsg");msg.textContent="Saving...";
  try{
    let image_url=editingSetupRenderImage;const file=$("#setupRenderImage").files[0];if(file)image_url=await uploadFile(file,"setup-accessory");let model_url=editingSetupRenderModel3d;const modelFile=$("#setupRenderModel3d")?.files?.[0];if(modelFile)model_url=await uploadFile(modelFile,"setup-accessory-3d");if(!image_url&&!model_url)throw new Error("Add a transparent image or a GLB 3D model.");
    const payload={product_id:$("#setupRenderProduct").value,device_id:$("#setupRenderDevice").value,slot:$("#setupRenderSlot").value,image_url:image_url||"",model_url:model_url||null,pos_x:Number($("#setupRenderX").value||50),pos_y:Number($("#setupRenderY").value||50),scale:Number($("#setupRenderScale").value||100),z_index:Number($("#setupRenderZ").value||10),model_pos_x:Number($("#setupRender3dX").value||0),model_pos_y:Number($("#setupRender3dY").value||0),model_pos_z:Number($("#setupRender3dZ").value||0),model_scale:Number($("#setupRender3dScale").value||1),model_rot_x:Number($("#setupRender3dRotX").value||0),model_rot_y:Number($("#setupRender3dRotY").value||0),model_rot_z:Number($("#setupRender3dRotZ").value||0),is_active:$("#setupRenderActive").checked};
    const id=$("#setupRenderId").value;const r=id?await sb.from("setup_product_renders").update(payload).eq("id",id):await sb.from("setup_product_renders").insert(payload);if(r.error)throw r.error;$("#setupRenderEditor").classList.remove("open");msg.textContent="";await reload();
  }catch(err){console.error(err);msg.textContent=err.message||"Could not save accessory render.";}
});

$("#categoryForm").addEventListener("submit",async e=>{
  e.preventDefault();const msg=$("#categoryMsg");msg.textContent="Saving...";const id=$("#categoryId").value;const payload={name:$("#categoryName").value.trim(),slug:slugify($("#categoryName").value),parent_id:$("#categoryParent").value||null,sort_order:Number($("#categoryOrder").value||0)};const r=id?await sb.from("categories").update(payload).eq("id",id):await sb.from("categories").insert(payload);if(r.error){msg.textContent=r.error.message;return;}$("#categoryEditor").classList.remove("open");msg.textContent="";await reload();
});

async function quickMerchUpdate(id,field,value,el){
  el.disabled=true;
  const r=await sb.from("products").update({[field]:value}).eq("id",id);
  if(r.error){alert(r.error.message);el.checked=!value;}
  else{const p=products.find(x=>String(x.id)===String(id));if(p)p[field]=value;}
  el.disabled=false;
}
async function quickStatusUpdate(id,value,el){
  el.disabled=true;
  const r=await sb.from("products").update({availability_status:value}).eq("id",id);
  if(r.error){alert(r.error.message);}
  else{const p=products.find(x=>String(x.id)===String(id));if(p)p.availability_status=value;}
  el.disabled=false;
}

async function deleteProduct(id){if(!confirm("Delete this product?"))return;const r=await sb.from("products").delete().eq("id",id);if(r.error)alert(r.error.message);else await reload();}
async function deletePromo(id){if(!confirm("Delete this homepage promo?"))return;const r=await sb.from("home_promotions").delete().eq("id",id);if(r.error)alert(r.error.message);else await reload();}
async function deleteCategory(id){if(!confirm("Delete this category? Products inside it must be moved or deleted first."))return;const r=await sb.from("categories").delete().eq("id",id);if(r.error)alert(r.error.message);else await reload();}
async function deleteBrand(id){if(!confirm("Delete this brand? Products will keep working and simply have no brand."))return;const r=await sb.from("brands").delete().eq("id",id);if(r.error)alert(r.error.message);else await reload();}
async function deleteSetupDevice(id){if(!confirm("Delete this phone render? Its accessory render mappings will also be deleted."))return;const r=await sb.from("setup_devices").delete().eq("id",id);if(r.error)alert(r.error.message);else await reload();}
async function deleteSetupRender(id){if(!confirm("Delete this accessory render?"))return;const r=await sb.from("setup_product_renders").delete().eq("id",id);if(r.error)alert(r.error.message);else await reload();}
async function toggleRequest(id){const row=restockRequests.find(r=>String(r.id)===String(id));if(!row)return;const r=await sb.from("restock_requests").update({notified:!row.notified}).eq("id",id);if(r.error)alert(r.error.message);else await reload();}
async function deleteRequest(id){if(!confirm("Delete this availability request?"))return;const r=await sb.from("restock_requests").delete().eq("id",id);if(r.error)alert(r.error.message);else await reload();}
$("#logoutBtn").onclick=async()=>{await sb.auth.signOut();location.href="login.html";};

function injectAdminEnhancementStyles(){
  const style=document.createElement("style");style.textContent=`
  .admin-subsection{margin:16px 0;padding:14px;border:1px solid var(--line);border-radius:18px;background:#fbfdff}.admin-subsection-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:10px}.admin-subsection-head strong{font-size:.82rem}.admin-subsection-head small{display:block;color:var(--muted);font-size:.64rem;margin-top:3px}.option-toggle{display:flex!important;align-items:center;gap:10px;margin:8px 0!important;padding:12px;border-radius:14px;background:linear-gradient(145deg,#f7fbff,#f6f2ff);cursor:pointer}.option-toggle input{width:auto!important;margin:0!important}.option-toggle strong{font-size:.76rem}.option-drawer{margin:6px 0 12px;padding:12px;border:1px solid var(--line);border-radius:14px;background:#fff}.drawer-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.drawer-head strong{font-size:.74rem}#phoneOptionsRows,#colorOptionsRows{display:grid;gap:8px}.phone-option-row,.color-option-row{display:grid;grid-template-columns:minmax(0,1fr) auto 34px;gap:7px;align-items:center;padding:8px;border-radius:13px;background:#fff;border:1px solid var(--line)}.color-option-row{grid-template-columns:46px minmax(0,1fr) 34px}.color-swatch-input{width:42px!important;height:38px!important;padding:2px!important;border-radius:10px!important}.phone-model-input,.color-name-input{margin:0!important;padding:10px!important}.phone-stock-switch{display:flex!important;align-items:center;gap:5px;margin:0!important;white-space:nowrap;font-size:.64rem!important}.phone-stock-switch input{width:auto!important;margin:0!important}.phone-remove-btn{width:32px;height:32px;border:1px solid #f0c9c9;background:#fff6f6;color:#d85252;border-radius:9px;font-size:1.1rem}.image-manager{display:grid;grid-template-columns:repeat(auto-fill,minmax(135px,1fr));gap:10px;margin-top:10px}.image-item{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff}.image-item>img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block}.image-item-controls{display:grid;gap:6px;padding:8px}.image-item-controls select{width:100%;padding:8px;border:1px solid var(--line);border-radius:9px;background:#fff;font:inherit;font-size:.64rem}.cover-choice{display:flex!important;align-items:center;gap:5px;margin:0!important;font-size:.64rem!important}.cover-choice input{width:auto!important;margin:0!important}.image-remove{border:0;background:#fff0f0;color:#cf4c4c;border-radius:8px;padding:7px;font-size:.62rem;font-weight:800}.image-empty,.empty-admin{padding:16px;color:var(--muted);font-size:.7rem;text-align:center}.current-image img{max-width:180px;border-radius:14px;margin-top:8px}.tabs{overflow-x:auto;scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}.tab{flex:0 0 auto}.stats{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))!important}.homepage-merch-list{display:grid;gap:9px}.homepage-merch-row{display:grid;grid-template-columns:54px minmax(0,1fr) auto auto auto;gap:8px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:15px;background:#fff}.homepage-merch-row>img{width:54px;height:54px;border-radius:12px;object-fit:cover;background:#f4f7fb}.homepage-merch-main{min-width:0}.homepage-merch-main strong{display:block;font-size:.76rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.quick-status{margin-top:5px;width:100%;max-width:170px;padding:7px 8px;border:1px solid var(--line);border-radius:9px;background:#fff;font:inherit;font-size:.61rem}.merch-check{display:flex!important;align-items:center;gap:5px;margin:0!important;font-size:.61rem!important;font-weight:800;white-space:nowrap}.merch-check input{width:auto!important;margin:0!important}.homepage-brand-preview{display:flex;gap:8px;flex-wrap:wrap}.brand-admin-icon img{width:100%;height:100%;object-fit:contain;border-radius:10px}.brand-preview-chip img{width:22px;height:22px;object-fit:contain;border-radius:7px;vertical-align:middle;margin-right:6px}.brand-preview-chip{padding:8px 11px;border-radius:999px;background:linear-gradient(135deg,#eefaff,#f2edff);border:1px solid rgba(45,119,255,.12);font-size:.64rem;font-weight:800;color:#0a1f44}.brand-preview-chip b{color:#1677ff;margin-left:4px}.admin-subsection .gold-btn{flex:0 0 auto}.setup-current-image img{max-height:220px;object-fit:contain;background:linear-gradient(145deg,#f8fbff,#f5f1ff);padding:10px}.setup-placement{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.setup-placement input{width:100%}.admin-row>img{object-fit:contain!important;background:#f7f9fc}@media(max-width:680px){.setup-placement{grid-template-columns:1fr 1fr}.setup-placement label:last-child{grid-column:1/-1}.homepage-merch-row{grid-template-columns:50px minmax(0,1fr)}.homepage-merch-row>.merch-check{grid-column:auto}.admin-subsection-head{align-items:flex-start}.admin-subsection-head .gold-btn{padding:10px 12px}.admin-subsection-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important}.admin-subsection-head>div{min-width:0!important}.admin-subsection-head small{max-width:290px!important;line-height:1.45!important}.admin-subsection-head .gold-btn{white-space:nowrap!important;max-width:180px!important}.tabs{padding-bottom:2px!important;scroll-snap-type:x proximity}.tab{scroll-snap-align:start}.admin-shell{overflow-x:hidden!important}}@media(max-width:480px){.phone-option-row{grid-template-columns:1fr auto}.phone-remove-btn{grid-column:2}.phone-stock-switch{grid-column:1;grid-row:2}.image-manager{grid-template-columns:repeat(2,1fr)}.admin-subsection-head{grid-template-columns:1fr!important;gap:12px!important}.admin-subsection-head .gold-btn{width:100%!important;max-width:none!important}.homepage-merch-row{padding:12px!important}.stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}.tabs{gap:4px!important}.tab{padding-left:10px!important;padding-right:10px!important}}`;
  document.head.appendChild(style);
}
