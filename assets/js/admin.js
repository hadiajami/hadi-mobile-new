const CFG=window.HADI_CONFIG;
if(!CFG.SUPABASE_URL || CFG.SUPABASE_URL.startsWith("YOUR_")) location.href="login.html";
const sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);

let products=[],categories=[],phoneOptions=[],editingImage=null;
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const slugify=s=>s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

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
  const [c,p,o]=await Promise.all([
    sb.from("categories").select("*").order("sort_order"),
    sb.from("products").select("*").order("created_at",{ascending:false}),
    sb.from("product_phone_options").select("*").order("sort_order")
  ]);

  if(c.error) console.error("Categories:",c.error);
  if(p.error) console.error("Products:",p.error);
  if(o.error) console.error("Phone options:",o.error);

  categories=c.data||[];
  products=p.data||[];
  phoneOptions=o.data||[];
  render();
}

function optionsFor(productId){
  return phoneOptions.filter(o=>String(o.product_id)===String(productId));
}

function render(){
  $("#stats").innerHTML=`
    <div class="stat"><strong>${products.length}</strong><span>PRODUCTS</span></div>
    <div class="stat"><strong>${categories.filter(c=>!c.parent_id).length}</strong><span>MAIN CATEGORIES</span></div>
    <div class="stat"><strong>${products.filter(p=>p.in_stock).length}</strong><span>IN STOCK</span></div>`;

  $("#productList").innerHTML=products.map(p=>{
    const opts=optionsFor(p.id);
    const optionSummary=p.has_phone_options
      ? ` · ${opts.filter(o=>o.in_stock).length}/${opts.length} phones available`
      : (p.in_stock?" · In stock":" · Out of stock");

    return `<div class="admin-row">
      <img src="${p.image_url||"../assets/img/hadi-mobile-logo.jpg"}">
      <div class="row-main">
        <strong>${esc(p.name)}</strong>
        <span>$${Number(p.price).toFixed(2)} · ${esc(categories.find(c=>c.id===p.category_id)?.name||"No category")}${p.featured?" · Featured":""}${optionSummary}</span>
      </div>
      <div class="row-actions">
        <button class="mini-btn" data-editp="${p.id}">Edit</button>
        <button class="mini-btn danger" data-delp="${p.id}">Delete</button>
      </div>
    </div>`;
  }).join("");

  $("#categoryAdminList").innerHTML=categories.map(c=>`<div class="admin-row">
    <div class="cat-icon">${c.parent_id?"↳":"# "}</div>
    <div class="row-main">
      <strong>${esc(c.name)}</strong>
      <span>${c.parent_id?"Subcategory of "+esc(categories.find(x=>x.id===c.parent_id)?.name||"Unknown"):"Main category"} · Order ${c.sort_order||0}</span>
    </div>
    <div class="row-actions">
      <button class="mini-btn" data-editc="${c.id}">Edit</button>
      <button class="mini-btn danger" data-delc="${c.id}">Delete</button>
    </div>
  </div>`).join("");

  $("#productCategory").innerHTML=categoryOptions();
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
}

document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  $("#productsTab").classList.toggle("hidden",b.dataset.tab!=="products");
  $("#categoriesTab").classList.toggle("hidden",b.dataset.tab!=="categories");
});

document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).classList.remove("open"));

$("#newProduct").onclick=()=>{
  editingImage=null;
  $("#productForm").reset();
  $("#productId").value="";
  $("#productStock").checked=true;
  $("#productActive").checked=true;
  $("#productHasPhoneOptions").checked=false;
  $("#productEditorTitle").textContent="Add product";
  $("#currentImage").innerHTML="";
  $("#phoneOptionsRows").innerHTML="";
  togglePhoneOptionsDrawer();
  $("#productEditor").classList.add("open");
};

$("#newCategory").onclick=()=>{
  $("#categoryForm").reset();
  $("#categoryId").value="";
  $("#categoryEditorTitle").textContent="Add category";
  $("#categoryParent").innerHTML='<option value="">None — main category</option>'+categoryOptions();
  $("#categoryEditor").classList.add("open");
};

function editProduct(id){
  const p=products.find(x=>String(x.id)===String(id));
  if(!p)return;

  editingImage=p.image_url||null;
  $("#productId").value=p.id;
  $("#productName").value=p.name;
  $("#productPrice").value=p.price;
  $("#productCategory").value=p.category_id||"";
  $("#productDescription").value=p.description||"";
  $("#productStock").checked=!!p.in_stock;
  $("#productFeatured").checked=!!p.featured;
  $("#productActive").checked=p.is_active!==false;
  $("#productHasPhoneOptions").checked=!!p.has_phone_options;
  $("#currentImage").innerHTML=p.image_url?`<img src="${p.image_url}">`:"";
  $("#productEditorTitle").textContent="Edit product";

  $("#phoneOptionsRows").innerHTML="";
  optionsFor(p.id).forEach(o=>addPhoneRow(o.phone_model,o.in_stock));
  togglePhoneOptionsDrawer();

  $("#productEditor").classList.add("open");
}

function editCategory(id){
  const c=categories.find(x=>String(x.id)===String(id));
  if(!c)return;
  $("#categoryId").value=c.id;
  $("#categoryName").value=c.name;
  $("#categoryOrder").value=c.sort_order||0;
  $("#categoryParent").innerHTML='<option value="">None — main category</option>'+categoryOptions(c.id);
  $("#categoryParent").value=c.parent_id||"";
  $("#categoryEditorTitle").textContent="Edit category";
  $("#categoryEditor").classList.add("open");
}

$("#productHasPhoneOptions").addEventListener("change",()=>{
  if($("#productHasPhoneOptions").checked && !$("#phoneOptionsRows").children.length){
    addPhoneRow("",true);
  }
  togglePhoneOptionsDrawer();
});

$("#addPhoneOption").addEventListener("click",()=>addPhoneRow("",true));

function addPhoneRow(model="",inStock=true){
  const row=document.createElement("div");
  row.className="phone-option-row";
  row.innerHTML=`
    <input class="phone-model-input" type="text" placeholder="e.g. iPhone 16 Pro" value="${esc(model)}">
    <label class="phone-stock-switch"><input class="phone-stock-input" type="checkbox" ${inStock?"checked":""}><span>In stock</span></label>
    <button class="phone-remove-btn" type="button" aria-label="Remove phone model">×</button>
  `;
  row.querySelector(".phone-remove-btn").onclick=()=>row.remove();
  $("#phoneOptionsRows").appendChild(row);
}

function togglePhoneOptionsDrawer(){
  const enabled=$("#productHasPhoneOptions").checked;
  $("#phoneOptionsDrawer").classList.toggle("hidden",!enabled);
  $("#productStock").disabled=enabled;
  const label=$("#productStock").closest("label");
  if(label) label.style.opacity=enabled?".45":"1";
}

function getPhoneRows(){
  return [...document.querySelectorAll(".phone-option-row")].map((row,index)=>({
    phone_model:row.querySelector(".phone-model-input").value.trim(),
    in_stock:row.querySelector(".phone-stock-input").checked,
    sort_order:index
  })).filter(r=>r.phone_model);
}

$("#productForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const msg=$("#productMsg");
  msg.textContent="Saving...";

  try{
    let image_url=editingImage;
    const file=$("#productImage").files[0];

    if(file){
      const ext=file.name.split(".").pop().toLowerCase();
      const name=`${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const up=await sb.storage.from("product-images").upload(name,file,{cacheControl:"3600",upsert:false});
      if(up.error)throw up.error;
      image_url=sb.storage.from("product-images").getPublicUrl(name).data.publicUrl;
    }

    const hasPhoneOptions=$("#productHasPhoneOptions").checked;
    const rows=hasPhoneOptions?getPhoneRows():[];

    if(hasPhoneOptions && !rows.length){
      throw new Error("Add at least one phone model, or turn off phone-model availability.");
    }

    const normalized=[...new Set(rows.map(r=>r.phone_model.toLowerCase()))];
    if(normalized.length!==rows.length){
      throw new Error("The same phone model was added more than once.");
    }

    const calculatedStock=hasPhoneOptions ? rows.some(r=>r.in_stock) : $("#productStock").checked;

    const payload={
      name:$("#productName").value.trim(),
      price:Number($("#productPrice").value),
      category_id:$("#productCategory").value||null,
      description:$("#productDescription").value.trim(),
      image_url,
      in_stock:calculatedStock,
      featured:$("#productFeatured").checked,
      is_active:$("#productActive").checked,
      has_phone_options:hasPhoneOptions
    };

    const existingId=$("#productId").value;
    let productId=existingId;

    if(existingId){
      const res=await sb.from("products").update(payload).eq("id",existingId).select("id").single();
      if(res.error)throw res.error;
      productId=res.data.id;
    }else{
      const res=await sb.from("products").insert(payload).select("id").single();
      if(res.error)throw res.error;
      productId=res.data.id;
    }

    const del=await sb.from("product_phone_options").delete().eq("product_id",productId);
    if(del.error)throw del.error;

    if(hasPhoneOptions && rows.length){
      const insertRows=rows.map(r=>({...r,product_id:productId}));
      const add=await sb.from("product_phone_options").insert(insertRows);
      if(add.error)throw add.error;
    }

    $("#productEditor").classList.remove("open");
    msg.textContent="";
    await reload();
  }catch(err){
    console.error(err);
    msg.textContent=err.message||"Could not save product.";
  }
});

$("#categoryForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const msg=$("#categoryMsg");
  msg.textContent="Saving...";

  const id=$("#categoryId").value;
  const payload={
    name:$("#categoryName").value.trim(),
    slug:slugify($("#categoryName").value),
    parent_id:$("#categoryParent").value||null,
    sort_order:Number($("#categoryOrder").value||0)
  };

  const res=id
    ? await sb.from("categories").update(payload).eq("id",id)
    : await sb.from("categories").insert(payload);

  if(res.error){msg.textContent=res.error.message;return;}
  $("#categoryEditor").classList.remove("open");
  msg.textContent="";
  await reload();
});

async function deleteProduct(id){
  if(!confirm("Delete this product?"))return;
  const r=await sb.from("products").delete().eq("id",id);
  if(r.error)alert(r.error.message);else await reload();
}

async function deleteCategory(id){
  if(!confirm("Delete this category? Products inside it must be moved or deleted first."))return;
  const r=await sb.from("categories").delete().eq("id",id);
  if(r.error)alert(r.error.message);else await reload();
}

$("#logoutBtn").onclick=async()=>{
  await sb.auth.signOut();
  location.href="login.html";
};

function injectAdminEnhancementStyles(){
  const style=document.createElement("style");
  style.textContent=`
    .phone-options-toggle{margin:16px 0 8px;padding:14px;border:1px solid rgba(22,119,255,.12);background:linear-gradient(145deg,#f7fbff,#f4efff);border-radius:16px}
    .phone-toggle-label{display:flex!important;align-items:flex-start;gap:11px;margin:0!important;cursor:pointer}
    .phone-toggle-label>input{width:auto!important;margin:3px 0 0!important}
    .phone-toggle-label span{display:block}
    .phone-toggle-label strong{display:block;font-size:.79rem;color:var(--text)}
    .phone-toggle-label small{display:block;margin-top:4px!important;line-height:1.45}
    .phone-options-drawer{margin:10px 0 18px;padding:14px;border:1px solid var(--line);border-radius:17px;background:#f9fbff}
    .phone-options-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px}
    .phone-options-head strong{display:block;font-size:.8rem}
    .phone-options-head small{display:block;color:var(--muted);font-size:.65rem;line-height:1.4;margin-top:4px}
    .phone-options-head .mini-btn{flex:0 0 auto}
    #phoneOptionsRows{display:grid;gap:8px}
    .phone-option-row{display:grid;grid-template-columns:minmax(0,1fr) auto 34px;gap:7px;align-items:center;padding:8px;border-radius:13px;background:#fff;border:1px solid var(--line)}
    .phone-model-input{margin:0!important;padding:10px!important}
    .phone-stock-switch{display:flex!important;align-items:center;gap:5px;margin:0!important;white-space:nowrap;font-size:.64rem!important}
    .phone-stock-switch input{width:auto!important;margin:0!important}
    .phone-remove-btn{width:32px;height:32px;border:1px solid #f0c9c9;background:#fff6f6;color:#d85252;border-radius:9px;font-size:1.1rem}
    .phone-options-note{margin-top:10px;font-size:.62rem;color:var(--muted);line-height:1.45}
    @media(max-width:480px){.phone-option-row{grid-template-columns:1fr auto}.phone-remove-btn{grid-column:2}.phone-stock-switch{grid-column:1;grid-row:2}}
  `;
  document.head.appendChild(style);
}
