import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/controls/OrbitControls.js";

const CFG=window.HADI_CONFIG;
const sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
const $=s=>document.querySelector(s);
const esc=(s="")=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const money=n=>`$${Number(n||0).toFixed(2)}`;
let devices=[],renders=[],products=[],phoneOptions=[],images=[];
let activeDevice=null,activeSlot="case";
const selected={};
const slotLabels={case:"Cases",screen:"Screen",camera:"Camera",charger:"Charging",other:"More"};
let three=null,renderToken=0;

function mainImage(p){const rows=images.filter(i=>String(i.product_id)===String(p.id)).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));return rows.find(i=>i.is_primary)?.image_url||rows[0]?.image_url||p.image_url||"assets/img/hadi-mobile-logo.jpg";}
function compatible(p,model){if(!p.has_phone_options)return true;return phoneOptions.some(o=>String(o.product_id)===String(p.id)&&o.phone_model===model&&o.in_stock);}
function available(p){return p.is_active!==false&&(p.availability_status||"standard")==="standard"&&p.in_stock!==false;}
function selectedValues(){return Object.values(selected);}
function canUseFull3D(){return !!(activeDevice?.base_model_url && selectedValues().every(x=>x.render.model_url));}

async function load(){
  const [d,r,p,o,i]=await Promise.all([
    sb.from("setup_devices").select("*").eq("is_active",true).order("sort_order"),
    sb.from("setup_product_renders").select("*").eq("is_active",true),
    sb.from("products").select("*").eq("is_active",true),
    sb.from("product_phone_options").select("*"),
    sb.from("product_images").select("*").order("sort_order")
  ]);
  [d,r,p,o,i].forEach(x=>{if(x.error)console.error(x.error);});
  devices=d.data||[];renders=r.data||[];products=p.data||[];phoneOptions=o.data||[];images=i.data||[];
  renderDeviceSelect();
  const preferred=localStorage.getItem("hadi_preferred_phone")||"";
  const start=devices.find(x=>x.phone_model===preferred)||devices[0];
  if(start){$("#deviceSelect").value=start.id;chooseDevice(start.id);}else renderAll();
}
function renderDeviceSelect(){
  $("#deviceSelect").innerHTML='<option value="">Choose your phone</option>'+devices.map(d=>`<option value="${d.id}">${esc(d.phone_model)}</option>`).join("");
  $("#deviceSelect").onchange=e=>chooseDevice(e.target.value);
}
function chooseDevice(id){activeDevice=devices.find(d=>String(d.id)===String(id))||null;Object.keys(selected).forEach(k=>delete selected[k]);if(activeDevice)localStorage.setItem("hadi_preferred_phone",activeDevice.phone_model);renderAll();}
function deviceRenders(){return activeDevice?renders.filter(r=>String(r.device_id)===String(activeDevice.id)):[];}
function slots(){return [...new Set(deviceRenders().map(r=>r.slot))].filter(Boolean);}
function renderAll(){renderStage();renderTabs();renderAccessories();renderSelected();}

function disposeThree(){
  if(!three)return;
  cancelAnimationFrame(three.raf||0);
  three.controls?.dispose();three.renderer?.dispose();
  three=null;
}
function renderStage(){
  const stage=$("#phoneStage"); if(!stage)return;
  disposeThree();
  if(!activeDevice){stage.innerHTML='<div class="empty" id="stageEmpty">Choose a configured phone to start.</div>';setModeBadge("");return;}
  if(canUseFull3D()) render3DStage(stage); else render2DStage(stage);
}
function setModeBadge(mode){const b=$("#visualModeBadge");if(!b)return;b.textContent=mode;b.style.display=mode?"inline-flex":"none";}
function render2DStage(stage){
  const base=activeDevice.base_image_url?`<img class="visual-layer base-phone" src="${activeDevice.base_image_url}" alt="${esc(activeDevice.phone_model)}">`:`<div class="empty">Upload a phone image fallback in Admin for 2D preview.</div>`;
  const layers=[base];
  selectedValues().forEach(sel=>{const r=sel.render;if(!r.image_url)return;layers.push(`<img class="visual-layer accessory-layer" src="${r.image_url}" alt="${esc(sel.product.name)}" style="left:${Number(r.pos_x)||50}%;top:${Number(r.pos_y)||50}%;z-index:${Number(r.z_index)||10};transform:translate(-50%,-50%) scale(${(Number(r.scale)||100)/100}) translateZ(${Math.max(1,Number(r.z_index)||10)}px)">`);});
  stage.innerHTML=layers.join("");setModeBadge("REAL PRODUCT PREVIEW");
}
async function render3DStage(stage){
  const token=++renderToken;stage.innerHTML='<div class="three-loading">Loading real 3D…</div>';setModeBadge("TRUE 3D · DRAG TO ROTATE");
  const scene=new THREE.Scene();scene.background=null;
  const camera=new THREE.PerspectiveCamera(32,1,.01,100);camera.position.set(0,.15,5);
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;stage.innerHTML="";stage.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff,0x9bb1d1,2.2));const key=new THREE.DirectionalLight(0xffffff,3.0);key.position.set(4,6,5);scene.add(key);const fill=new THREE.DirectionalLight(0xbfd9ff,1.8);fill.position.set(-4,2,3);scene.add(fill);
  const root=new THREE.Group();scene.add(root);const loader=new GLTFLoader();
  const loadModel=url=>new Promise((resolve,reject)=>loader.load(url,g=>resolve(g.scene),undefined,reject));
  try{
    const phone=await loadModel(activeDevice.base_model_url);if(token!==renderToken)return;normalizePhone(phone);root.add(phone);
    for(const sel of selectedValues()){
      const r=sel.render;const obj=await loadModel(r.model_url);if(token!==renderToken)return;
      obj.position.set(Number(r.model_pos_x)||0,Number(r.model_pos_y)||0,Number(r.model_pos_z)||0);obj.scale.setScalar(Number(r.model_scale)||1);obj.rotation.set(THREE.MathUtils.degToRad(Number(r.model_rot_x)||0),THREE.MathUtils.degToRad(Number(r.model_rot_y)||0),THREE.MathUtils.degToRad(Number(r.model_rot_z)||0));root.add(obj);
    }
  }catch(err){console.error("3D load failed, falling back to image preview",err);if(token===renderToken)render2DStage(stage);return;}
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=2.6;controls.maxDistance=8;controls.target.set(0,0,0);
  const resize=()=>{const r=stage.getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=Math.max(1,r.width)/Math.max(1,r.height);camera.updateProjectionMatrix();};resize();
  let raf=0;const animate=()=>{controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(animate);};animate();three={renderer,controls,raf,resize};
}
function normalizePhone(obj){const box=new THREE.Box3().setFromObject(obj);const size=box.getSize(new THREE.Vector3());const center=box.getCenter(new THREE.Vector3());obj.position.sub(center);const max=Math.max(size.x,size.y,size.z)||1;obj.scale.setScalar(3.2/max);}

function renderTabs(){const s=slots();if(s.length&&!s.includes(activeSlot))activeSlot=s[0];$("#slotTabs").innerHTML=s.map(x=>`<button class="slot-tab ${x===activeSlot?"active":""}" data-slot="${x}">${slotLabels[x]||x}</button>`).join("");$("#slotTabs").querySelectorAll("[data-slot]").forEach(b=>b.onclick=()=>{activeSlot=b.dataset.slot;renderTabs();renderAccessories();});}
function renderAccessories(){
  const box=$("#accessoryList");if(!activeDevice){box.innerHTML='<div class="empty">Select your phone first.</div>';return;}
  const rows=deviceRenders().filter(r=>r.slot===activeSlot).map(r=>({render:r,product:products.find(p=>String(p.id)===String(r.product_id))})).filter(x=>x.product&&available(x.product)&&compatible(x.product,activeDevice.phone_model));
  if(!rows.length){box.innerHTML=`<div class="empty">No ${esc((slotLabels[activeSlot]||activeSlot).toLowerCase())} visuals are configured for this phone yet.</div>`;return;}
  box.innerHTML=rows.map(({render,product})=>{const chosen=selected[activeSlot]?.product.id===product.id;const tag=render.model_url?'3D + IMAGE':'REAL IMAGE';return `<article class="accessory-card ${chosen?"selected":""}"><img src="${mainImage(product)}" alt="${esc(product.name)}"><div class="acc-main"><strong>${esc(product.name)}</strong><span>${money(product.price)}</span><small>${chosen?"Shown on your phone":tag}</small></div><button class="choose-acc ${chosen?"remove":""}" data-render="${render.id}">${chosen?"Remove":"Try it"}</button></article>`;}).join("");
  box.querySelectorAll("[data-render]").forEach(b=>b.onclick=()=>{const r=renders.find(x=>String(x.id)===String(b.dataset.render));if(!r)return;const p=products.find(x=>String(x.id)===String(r.product_id));if(!p)return;if(selected[activeSlot]?.product.id===p.id)delete selected[activeSlot];else selected[activeSlot]={render:r,product:p};renderAll();});
}
function renderSelected(){const vals=selectedValues(),box=$("#selectedStack");box.innerHTML='<h3>Selected accessories</h3>'+(vals.length?vals.map(x=>`<div class="selected-row"><span>${esc(slotLabels[x.render.slot]||x.render.slot)} · ${esc(x.product.name)}</span><strong>${money(x.product.price)}</strong></div>`).join(""):'<div class="empty">Your setup is empty.</div>');const total=vals.reduce((s,x)=>s+Number(x.product.price||0),0);$("#setupCount").textContent=`${vals.length} ${vals.length===1?"accessory":"accessories"}`;$("#setupTotal").textContent=money(total);$("#addSetupBtn").disabled=!vals.length;}
function addToCart(){const vals=selectedValues();if(!vals.length)return;let cart=JSON.parse(localStorage.getItem("hadi_cart")||"[]")||[];vals.forEach(({product})=>{const phoneModel=product.has_phone_options?activeDevice.phone_model:"";const key=`${product.id}${phoneModel?`::${phoneModel}`:""}`;const existing=cart.find(x=>x.key===key);if(existing)existing.qty=(existing.qty||1)+1;else cart.push({key,id:product.id,name:product.name,phone_model:phoneModel,color_name:"",price:Number(product.price),image_url:mainImage(product),qty:1});});localStorage.setItem("hadi_cart",JSON.stringify(cart));const t=$("#toast");t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800);}
$("#addSetupBtn").onclick=addToCart;

const wrap=$("#stageWrap"),stage=$("#phoneStage");function tilt(clientX,clientY){if(canUseFull3D())return;const r=wrap.getBoundingClientRect();const x=(clientX-r.left)/r.width-.5,y=(clientY-r.top)/r.height-.5;stage.style.transform=`rotateX(${-y*8}deg) rotateY(${x*10}deg) scale(1.015)`;}wrap.addEventListener("pointermove",e=>{if(e.pointerType==="mouse"||e.buttons)tilt(e.clientX,e.clientY);});wrap.addEventListener("pointerdown",e=>{wrap.setPointerCapture?.(e.pointerId);tilt(e.clientX,e.clientY);});wrap.addEventListener("pointerup",()=>stage.style.transform="");wrap.addEventListener("pointerleave",()=>stage.style.transform="");
addEventListener("resize",()=>three?.resize?.());
load();
