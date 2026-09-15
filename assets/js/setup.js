import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const $=s=>document.querySelector(s);
const CFG=window.HADI_CONFIG||{};
const sb=window.supabase?.createClient?.(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
const MASTER="assets/models/iphone_17_pro_case_master.glb";
const COLORS=[
["White","#f1f1ef"],["Black","#17181b"],["Navy","#233b64"],["Sage","#9daa91"],["Pink","#d9a9b4"],
["Red","#b72f35"],["Orange","#d86f35"],["Yellow","#e4c85a"],["Sky","#8ebbd8"],["Purple","#796a9e"],
["Brown","#795b48"],["Sand","#c7b79c"],["Gray","#7b8088"],["Mint","#9fc7b5"]
];
const FONTS=["Manrope","Inter","Poppins","Montserrat","DM Sans","Roboto","Space Grotesk","Playfair Display","Cormorant Garamond","Oswald","Bebas Neue","Anton","Dancing Script","Great Vibes","Pacifico","Caveat","Arial","Georgia","Times New Roman","Courier New","Verdana","Trebuchet MS"];
let devices=[], activeDevice=null, caseColor="#f1f1ef";
let renderer,scene,camera,controls,root,caseModel,artMesh,artTexture,canvas,ctx;
let layers=[],selectedId=null,mode="orbit",drag=null,modelScale=1;
const loader=new GLTFLoader();

function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1600)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function selected(){return layers.find(x=>x.id===selectedId)||null}
function uid(){return (crypto.randomUUID?.()||("l"+Date.now()+Math.random())).replaceAll("-","")}
function colorName(hex){return COLORS.find(x=>x[1].toLowerCase()===hex.toLowerCase())?.[0]||hex.toUpperCase()}

async function loadDevices(){
  try{
    if(sb){const {data,error}=await sb.from("setup_devices").select("*").eq("is_active",true).order("sort_order");if(!error&&data?.length)devices=data}
  }catch(e){console.warn(e)}
  if(!devices.length)devices=[{id:"iphone17pro",phone_model:"iPhone 17 Pro",base_model_url:MASTER}];
  const sel=$("#deviceSelect");
  sel.innerHTML=devices.map(d=>`<option value="${esc(d.id)}">${esc(d.phone_model)}</option>`).join("");
  const q=new URLSearchParams(location.search).get("phone");
  activeDevice=devices.find(d=>d.phone_model===q)||devices.find(d=>/iphone\\s*17\\s*pro/i.test(d.phone_model))||devices[0];
  sel.value=activeDevice.id;
  sel.onchange=()=>{activeDevice=devices.find(d=>String(d.id)===sel.value)||devices[0];loadCase();updateSummary()};
}

function initUI(){
  $("#swatches").innerHTML=COLORS.map(([n,c],i)=>`<button class="swatch ${i===0?"active":""}" data-color="${c}" style="background:${c}" title="${n}"></button>`).join("")+`<label class="swatch custom-swatch" style="background:conic-gradient(red,#ff0,lime,cyan,blue,#f0f,red)" title="Custom color"><input id="customColor" type="color" value="${caseColor}"></label>`;
  $("#fontSelect").innerHTML=FONTS.map(f=>`<option value="${esc(f)}" style="font-family:'${esc(f)}'">${esc(f)}</option>`).join("");
  document.querySelectorAll("[data-color]").forEach(b=>b.onclick=()=>setCaseColor(b.dataset.color,b));
  $("#customColor").oninput=e=>setCaseColor(e.target.value,null);
  $("#viewerColor").oninput=e=>setCaseColor(e.target.value,null);
  document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".pane").forEach(x=>x.classList.toggle("active",x.id===b.dataset.pane))});
  $("#imageUpload").addEventListener("change",handleImageUpload);
  $("#addText").onclick=addText;
  $("#textInput").addEventListener("keydown",e=>{if(e.key==="Enter")addText()});
  $("#sizeRange").oninput=e=>{const l=selected();if(l){l.scale=+e.target.value/100;drawArtwork();renderLayers()}};
  $("#rotateRange").oninput=e=>{const l=selected();if(l){l.rotation=+e.target.value;drawArtwork()}};
  document.querySelectorAll("[data-nudge]").forEach(b=>b.onclick=()=>{const l=selected();if(!l)return;const [dx,dy]=b.dataset.nudge.split(",").map(Number);l.x+=dx;l.y+=dy;drawArtwork()});
  $("#centerLayer").onclick=()=>{const l=selected();if(l){l.x=canvas.width/2;l.y=canvas.height/2;drawArtwork()}};
  $("#deleteLayer").onclick=deleteSelected;
  $("#duplicateLayer").onclick=duplicateSelected;
  $("#orbitTool").onclick=()=>setMode("orbit");
  $("#editTool").onclick=()=>setMode("edit");
  $("#fitView").onclick=resetView;
  $("#zoomIn").onclick=()=>dolly(.82);
  $("#zoomOut").onclick=()=>dolly(1.2);
  $("#addCart").onclick=saveCustomCase;
}

function setCaseColor(c,button){
  caseColor=c;$("#viewerColor").value=c;$("#customColor").value=c;
  document.querySelectorAll(".swatch[data-color]").forEach(x=>x.classList.toggle("active",x===button));
  applyCaseColor();updateSummary()
}
function applyCaseColor(){
  if(!caseModel)return;const c=new THREE.Color(caseColor);
  caseModel.traverse(ch=>{if(!ch.isMesh||ch===artMesh)return;const n=(ch.name||"").toLowerCase();if(n.includes("camera control"))return;
    const mats=Array.isArray(ch.material)?ch.material:[ch.material];
    ch.material=mats.map(m=>{const x=m.clone();if(x.color)x.color.copy(c);x.roughness=.78;x.metalness=.01;return x});
    if(ch.material.length===1)ch.material=ch.material[0];
  });
}

async function loadCase(){
  $("#stage").innerHTML="";dispose3D();
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(32,1,.01,100);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  $("#stage").appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff,0x8fa0b8,2.5));
  const key=new THREE.DirectionalLight(0xffffff,3.1);key.position.set(4,6,8);scene.add(key);
  const fill=new THREE.DirectionalLight(0xb8d7ff,1.6);fill.position.set(-5,-1,5);scene.add(fill);
  root=new THREE.Group();scene.add(root);
  const url=/iphone\\s*17\\s*pro/i.test(activeDevice?.phone_model||"")?MASTER:(activeDevice?.base_model_url||MASTER);
  try{
    const gltf=await loader.loadAsync(url);caseModel=gltf.scene;
    const box0=new THREE.Box3().setFromObject(caseModel),size0=box0.getSize(new THREE.Vector3()),center0=box0.getCenter(new THREE.Vector3());
    caseModel.position.sub(center0);modelScale=3.45/Math.max(size0.x,size0.y,size0.z);caseModel.scale.setScalar(modelScale);root.add(caseModel);
    applyCaseColor();createArtworkSurface(size0);
  }catch(e){console.error(e);toast("3D model could not load");return}
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.055;controls.enablePan=false;controls.enableZoom=true;controls.rotateSpeed=.75;controls.zoomSpeed=.7;controls.minDistance=3;controls.maxDistance=8;controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;
  resetView();resize();animate();setMode(mode);
  renderer.domElement.addEventListener("pointerdown",artPointerDown);
  renderer.domElement.addEventListener("pointermove",artPointerMove);
  renderer.domElement.addEventListener("pointerup",artPointerUp);
  renderer.domElement.addEventListener("pointercancel",artPointerUp);
}
function createArtworkSurface(rawSize){
  canvas=document.createElement("canvas");canvas.width=900;canvas.height=1350;ctx=canvas.getContext("2d");
  artTexture=new THREE.CanvasTexture(canvas);artTexture.colorSpace=THREE.SRGBColorSpace;artTexture.anisotropy=renderer.capabilities.getMaxAnisotropy();
  // Master GLB is X=width, Y=height, Z=depth. The printable back is the broad lower area under the camera plateau.
  const geo=new THREE.PlaneGeometry(69,101);
  const mat=new THREE.MeshBasicMaterial({map:artTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,side:THREE.DoubleSide});
  artMesh=new THREE.Mesh(geo,mat);artMesh.name="HADI_CUSTOM_PRINT_SURFACE";
  artMesh.position.set(0,-23.0,6.39);artMesh.renderOrder=20;caseModel.add(artMesh);drawArtwork();
}
function drawArtwork(){
  if(!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);
  for(const l of layers){
    ctx.save();ctx.translate(l.x,l.y);ctx.rotate(l.rotation*Math.PI/180);ctx.globalAlpha=l.opacity??1;
    if(l.type==="image"&&l.image){
      const base=Math.min(620/l.image.width,900/l.image.height);const w=l.image.width*base*l.scale,h=l.image.height*base*l.scale;ctx.drawImage(l.image,-w/2,-h/2,w,h)
    }else if(l.type==="text"){
      const size=110*l.scale;ctx.fillStyle=l.color;ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=`700 ${size}px "${l.font}"`;ctx.fillText(l.text,0,0,800)
    }
    ctx.restore()
  }
  artTexture.needsUpdate=true
}
async function handleImageUpload(e){
  const f=e.target.files?.[0];if(!f)return;
  if(!/^image\\/(jpeg|png|webp)$/.test(f.type)){toast("Please choose JPG, PNG or WEBP");return}
  try{
    let img;
    if("createImageBitmap" in window){img=await createImageBitmap(f)}
    else{img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=URL.createObjectURL(f)})}
    const l={id:uid(),type:"image",name:f.name,image:img,x:canvas.width/2,y:canvas.height/2,scale:1,rotation:0,opacity:1};
    layers.push(l);selectLayer(l.id);drawArtwork();setMode("edit");e.target.value="";toast("Image added — drag it on the case")
  }catch(err){console.error(err);toast("Could not read that image")}
}
function addText(){
  const text=$("#textInput").value.trim();if(!text){toast("Write your text first");return}
  const l={id:uid(),type:"text",name:text,text,font:$("#fontSelect").value,color:$("#textColor").value,x:canvas.width/2,y:canvas.height/2,scale:1,rotation:0,opacity:1};
  layers.push(l);$("#textInput").value="";selectLayer(l.id);drawArtwork();setMode("edit");toast("Text added — drag it on the case")
}
function selectLayer(id){
  selectedId=id;const l=selected();$("#editCard").classList.toggle("show",!!l);
  if(l){$("#editTitle").textContent=l.type==="text"?`Edit “${l.text.slice(0,22)}”`:"Edit image";$("#sizeRange").value=Math.round(l.scale*100);$("#rotateRange").value=l.rotation}
  renderLayers()
}
function renderLayers(){
  $("#layerCount").textContent=`${layers.length} ${layers.length===1?"ITEM":"ITEMS"}`;
  $("#layers").innerHTML=layers.length?layers.slice().reverse().map(l=>`<div class="layer ${l.id===selectedId?"active":""}"><span>${l.type==="text"?"T":"▧"} &nbsp;${esc(l.type==="text"?l.text:l.name)}</span><button data-layer="${l.id}">Edit</button></div>`).join(""):`<p style="font-size:.58rem;color:#7b8aa2;margin:0">Upload an image or add text to start.</p>`;
  document.querySelectorAll("[data-layer]").forEach(b=>b.onclick=()=>{selectLayer(b.dataset.layer);setMode("edit")})
}
function deleteSelected(){if(!selectedId)return;layers=layers.filter(x=>x.id!==selectedId);selectedId=layers.at(-1)?.id||null;drawArtwork();selectLayer(selectedId)}
function duplicateSelected(){const l=selected();if(!l)return;const c={...l,id:uid(),x:l.x+35,y:l.y+35};layers.push(c);selectLayer(c.id);drawArtwork()}
function setMode(m){mode=m;$("#orbitTool").classList.toggle("active",m==="orbit");$("#editTool").classList.toggle("active",m==="edit");if(controls)controls.enabled=m==="orbit";$("#hint").textContent=m==="orbit"?"Drag the case to rotate • pinch to zoom":"Drag selected artwork directly on the case"}
function artPointerDown(e){if(mode!=="edit"||!selected())return;drag={x:e.clientX,y:e.clientY,lx:selected().x,ly:selected().y};renderer.domElement.setPointerCapture?.(e.pointerId)}
function artPointerMove(e){if(!drag||mode!=="edit")return;const l=selected();if(!l)return;const r=renderer.domElement.getBoundingClientRect();l.x=drag.lx+(e.clientX-drag.x)*(canvas.width/r.width)*1.15;l.y=drag.ly+(e.clientY-drag.y)*(canvas.height/r.height)*1.15;drawArtwork()}
function artPointerUp(){drag=null}
function resetView(){if(!camera)return;camera.position.set(0,-.05,5.2);if(controls){controls.target.set(0,0,0);controls.update()}}
function dolly(f){if(!camera)return;camera.position.multiplyScalar(f);if(controls)controls.update()}
function resize(){if(!renderer)return;const r=$("#stage").getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=Math.max(1,r.width)/Math.max(1,r.height);camera.updateProjectionMatrix()}
function animate(){if(!renderer)return;controls?.update();renderer.render(scene,camera);requestAnimationFrame(animate)}
function dispose3D(){if(renderer){renderer.dispose();renderer.domElement?.remove()}renderer=scene=camera=controls=root=caseModel=artMesh=artTexture=null}
function updateSummary(){if(!activeDevice)return;$("#caseSummary").textContent=`${activeDevice.phone_model} • ${colorName(caseColor)}`}
function saveCustomCase(){
  if(!activeDevice)return;
  // Store a compact preview plus exact editable layer transforms. This is enough for cart/order handoff;
  // production upload/storage can be wired to Supabase Storage next.
  const preview=canvas?.toDataURL("image/jpeg",.72)||"";
  const safeLayers=layers.map(l=>({type:l.type,name:l.name,text:l.text||"",font:l.font||"",color:l.color||"",x:l.x,y:l.y,scale:l.scale,rotation:l.rotation}));
  const custom={kind:"custom_case",phone_model:activeDevice.phone_model,case_color:caseColor,preview,layers:safeLayers,created_at:new Date().toISOString()};
  localStorage.setItem("hadi_custom_case_draft",JSON.stringify(custom));
  toast("Custom case saved");
}

addEventListener("resize",resize);
initUI();await loadDevices();await loadCase();updateSummary();renderLayers();
