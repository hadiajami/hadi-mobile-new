const CFG=window.HADI_CONFIG;
if(!CFG.SUPABASE_URL || CFG.SUPABASE_URL.startsWith("YOUR_")) location.href="login.html";
const sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
let products=[],categories=[],editingImage=null;
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const slugify=s=>s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

(async()=>{
 const {data:{session}}=await sb.auth.getSession(); if(!session){location.href="login.html";return;}
 const {data:admin}=await sb.from("admins").select("user_id").eq("user_id",session.user.id).maybeSingle();
 if(!admin){await sb.auth.signOut();alert("This account is not authorized as an admin.");location.href="login.html";return;}
 await reload();
})();
async function reload(){
 const [c,p]=await Promise.all([sb.from("categories").select("*").order("sort_order"),sb.from("products").select("*").order("created_at",{ascending:false})]);
 categories=c.data||[];products=p.data||[];render();
}
function render(){
 $("#stats").innerHTML=`<div class="stat"><strong>${products.length}</strong><span>PRODUCTS</span></div><div class="stat"><strong>${categories.filter(c=>!c.parent_id).length}</strong><span>MAIN CATEGORIES</span></div><div class="stat"><strong>${products.filter(p=>p.in_stock).length}</strong><span>IN STOCK</span></div>`;
 $("#productList").innerHTML=products.map(p=>`<div class="admin-row"><img src="${p.image_url||"../assets/img/hadi-mobile-logo.jpg"}"><div class="row-main"><strong>${esc(p.name)}</strong><span>$${Number(p.price).toFixed(2)} · ${esc(categories.find(c=>c.id===p.category_id)?.name||"No category")} ${p.featured?"· Featured":""}</span></div><div class="row-actions"><button class="mini-btn" data-editp="${p.id}">Edit</button><button class="mini-btn danger" data-delp="${p.id}">Delete</button></div></div>`).join("");
 $("#categoryAdminList").innerHTML=categories.map(c=>`<div class="admin-row"><div class="cat-icon">${c.parent_id?"↳":"# "}</div><div class="row-main"><strong>${esc(c.name)}</strong><span>${c.parent_id?"Subcategory of "+esc(categories.find(x=>x.id===c.parent_id)?.name||"Unknown"):"Main category"} · Order ${c.sort_order||0}</span></div><div class="row-actions"><button class="mini-btn" data-editc="${c.id}">Edit</button><button class="mini-btn danger" data-delc="${c.id}">Delete</button></div></div>`).join("");
 $("#productCategory").innerHTML=categoryOptions();
 bind();
}
function categoryOptions(exclude=""){return categories.filter(c=>c.id!==exclude).map(c=>`<option value="${c.id}">${c.parent_id?"↳ ":""}${esc(c.name)}</option>`).join("")}
function bind(){
 document.querySelectorAll("[data-editp]").forEach(b=>b.onclick=()=>editProduct(b.dataset.editp));
 document.querySelectorAll("[data-delp]").forEach(b=>b.onclick=()=>deleteProduct(b.dataset.delp));
 document.querySelectorAll("[data-editc]").forEach(b=>b.onclick=()=>editCategory(b.dataset.editc));
 document.querySelectorAll("[data-delc]").forEach(b=>b.onclick=()=>deleteCategory(b.dataset.delc));
}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("#productsTab").classList.toggle("hidden",b.dataset.tab!=="products");$("#categoriesTab").classList.toggle("hidden",b.dataset.tab!=="categories");});
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).classList.remove("open"));
$("#newProduct").onclick=()=>{editingImage=null;$("#productForm").reset();$("#productId").value="";$("#productStock").checked=true;$("#productActive").checked=true;$("#productEditorTitle").textContent="Add product";$("#currentImage").innerHTML="";$("#productEditor").classList.add("open");}
$("#newCategory").onclick=()=>{$("#categoryForm").reset();$("#categoryId").value="";$("#categoryEditorTitle").textContent="Add category";$("#categoryParent").innerHTML='<option value="">None — main category</option>'+categoryOptions();$("#categoryEditor").classList.add("open");}
function editProduct(id){const p=products.find(x=>String(x.id)===String(id));if(!p)return;editingImage=p.image_url||null;$("#productId").value=p.id;$("#productName").value=p.name;$("#productPrice").value=p.price;$("#productCategory").value=p.category_id||"";$("#productDescription").value=p.description||"";$("#productStock").checked=!!p.in_stock;$("#productFeatured").checked=!!p.featured;$("#productActive").checked=p.is_active!==false;$("#currentImage").innerHTML=p.image_url?`<img src="${p.image_url}">`:"";$("#productEditorTitle").textContent="Edit product";$("#productEditor").classList.add("open");}
function editCategory(id){const c=categories.find(x=>String(x.id)===String(id));if(!c)return;$("#categoryId").value=c.id;$("#categoryName").value=c.name;$("#categoryOrder").value=c.sort_order||0;$("#categoryParent").innerHTML='<option value="">None — main category</option>'+categoryOptions(c.id);$("#categoryParent").value=c.parent_id||"";$("#categoryEditorTitle").textContent="Edit category";$("#categoryEditor").classList.add("open");}
$("#productForm").addEventListener("submit",async e=>{
 e.preventDefault(); const msg=$("#productMsg");msg.textContent="Saving...";
 try{
   let image_url=editingImage; const file=$("#productImage").files[0];
   if(file){const ext=file.name.split(".").pop().toLowerCase();const name=`${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;const up=await sb.storage.from("product-images").upload(name,file,{cacheControl:"3600",upsert:false});if(up.error)throw up.error;image_url=sb.storage.from("product-images").getPublicUrl(name).data.publicUrl;}
   const payload={name:$("#productName").value.trim(),price:Number($("#productPrice").value),category_id:$("#productCategory").value||null,description:$("#productDescription").value.trim(),image_url,in_stock:$("#productStock").checked,featured:$("#productFeatured").checked,is_active:$("#productActive").checked};
   const id=$("#productId").value; const res=id?await sb.from("products").update(payload).eq("id",id):await sb.from("products").insert(payload); if(res.error)throw res.error;
   $("#productEditor").classList.remove("open");msg.textContent="";await reload();
 }catch(err){msg.textContent=err.message||"Could not save product.";}
});
$("#categoryForm").addEventListener("submit",async e=>{
 e.preventDefault();const msg=$("#categoryMsg");msg.textContent="Saving...";
 const id=$("#categoryId").value;const payload={name:$("#categoryName").value.trim(),slug:slugify($("#categoryName").value),parent_id:$("#categoryParent").value||null,sort_order:Number($("#categoryOrder").value||0)};
 const res=id?await sb.from("categories").update(payload).eq("id",id):await sb.from("categories").insert(payload);
 if(res.error){msg.textContent=res.error.message;return;}$("#categoryEditor").classList.remove("open");msg.textContent="";await reload();
});
async function deleteProduct(id){if(!confirm("Delete this product?"))return;const r=await sb.from("products").delete().eq("id",id);if(r.error)alert(r.error.message);else await reload();}
async function deleteCategory(id){if(!confirm("Delete this category? Products inside it must be moved or deleted first."))return;const r=await sb.from("categories").delete().eq("id",id);if(r.error)alert(r.error.message);else await reload();}
$("#logoutBtn").onclick=async()=>{await sb.auth.signOut();location.href="login.html";};