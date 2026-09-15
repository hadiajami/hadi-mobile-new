import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const $=s=>document.querySelector(s);
const CFG=window.HADI_CONFIG||{};
const sb=window.supabase?.createClient?.(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
const MASTER="assets/models/iphone_17_pro_case_master.glb";
const COLORS=[
 ["Black","#17181b"],["White","#f1f1ef"],["Graphite","#45474d"],["Silver","#c9ccd1"],["Navy","#233b64"],["Royal Blue","#356ed1"],["Sky","#8ebbd8"],["Sage","#9daa91"],["Mint","#9fc7b5"],["Forest","#315a4b"],["Pink","#d9a9b4"],["Red","#b72f35"],["Orange","#d86f35"],["Yellow","#e4c85a"],["Purple","#796a9e"],["Lavender","#b7add7"],["Brown","#795b48"],["Sand","#c7b79c"],["Cream","#eee5cf"],["Coral","#e98979"]
];
const FONTS=["Manrope","Inter","Poppins","Montserrat","DM Sans","Roboto","Space Grotesk","Playfair Display","Cormorant Garamond","Oswald","Bebas Neue","Anton","Dancing Script","Great Vibes","Pacifico","Caveat","Arial","Georgia","Times New Roman","Courier New","Verdana","Trebuchet MS"];
let devices=[],activeDevice=null,caseColor="#17181b";
let renderer,scene,camera,controls,caseModel,artMesh,artTexture,canvas,ctx,raf;
let layers=[],selectedId=null,mode="orbit",drag=null;
const loader=new GLTFLoader();

function toast(msg){const t=$("#toast");if(!t)return;t.textContent=msg;t.classList.add("show");clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove("show"),1800)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function uid(){return crypto.randomUUID?.()||`l${Date.now()}${Math.random()}`}
function selected(){return layers.find(l=>l.id===selectedId)||null}
function colorName(h){return COLORS.find(x=>x[1].toLowerCase()===h.toLowerCase())?.[0]||h.toUpperCase()}

async function loadDevices(){
 try{
  if(sb){const {data,error}=await sb.from("setup_devices").select("id,phone_model,base_model_url,is_active,sort_order").eq("is_active",true).order("sort_order");if(!error&&data?.length)devices=data;}
 }catch(e){console.warn("case models",e)}
 if(!devices.length)devices=[{id:"iphone17pro",phone_model:"iPhone 17 Pro",base_model_url:MASTER,is_active:true}];
 const sel=$("#deviceSelect");
 sel.innerHTML=devices.map(d=>`<option value="${esc(d.id)}">${esc(d.phone_model)} — Custom Silicone Case</option>`).join("");
 activeDevice=devices.find(d=>/iphone\s*17\s*pro/i.test(d.phone_model))||devices[0];
 sel.value=activeDevice.id;
 sel.onchange=async()=>{activeDevice=devices.find(d=>String(d.id)===sel.value)||devices[0];$("#caseChoice").textContent=`${activeDevice.phone_model} Case`;layers=[];selectedId=null;renderLayers();await loadCase();updateSummary()};
}

function initUI(){
 const sw=$("#swatches");
 sw.innerHTML=COLORS.map(([n,c],i)=>`<button class="swatch ${i===1?"active":""}" data-color="${c}" style="background:${c}" title="${n}" aria-label="${n}"></button>`).join("")+`<label class="swatch custom-swatch" title="Custom color"><input id="customColor" type="color" value="${caseColor}" aria-label="Custom case color"></label>`;
 $("#fontSelect").innerHTML=FONTS.map(f=>`<option value="${esc(f)}" style="font-family:'${esc(f)}'">${esc(f)}</option>`).join("");
 document.querySelectorAll(".swatch[data-color]").forEach(b=>b.onclick=()=>setCaseColor(b.dataset.color,b));
 $("#customColor").oninput=e=>setCaseColor(e.target.value,null);
 $("#viewerColor").oninput=e=>setCaseColor(e.target.value,null);
 document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".pane").forEach(x=>x.classList.toggle("active",x.id===b.dataset.pane))});
 $("#imageUpload").addEventListener("change",handleImageUpload);
 $("#addText").onclick=addText;
 $("#textInput").addEventListener("keydown",e=>{if(e.key==="Enter")addText()});
 $("#orbitTool").onclick=()=>setMode("orbit");$("#editTool").onclick=()=>setMode("edit");$("#fitView").onclick=resetView;
 $("#zoomIn").onclick=()=>dolly(.82);$("#zoomOut").onclick=()=>dolly(1.2);
 $("#addCart").onclick=saveCustomCase;
 $("#deleteLayer").onclick=deleteSelected;$("#duplicateLayer").onclick=duplicateSelected;$("#centerLayer").onclick=centerSelected;
 ["sizeRange","rotateRange","viewerSize","viewerRotate"].forEach(id=>$("#"+id)?.addEventListener("input",syncEditFromUI));
 document.querySelectorAll("[data-nudge]").forEach(b=>b.onclick=()=>{const l=selected();if(!l)return;const [dx,dy]=b.dataset.nudge.split(",").map(Number);l.x+=dx;l.y+=dy;syncEditUI();drawArtwork()});
}
function setCaseColor(c,b){caseColor=c;$("#viewerColor").value=c;$("#customColor").value=c;document.querySelectorAll(".swatch[data-color]").forEach(x=>x.classList.toggle("active",x===b));applyCaseColor();updateSummary()}
function applyCaseColor(){if(!caseModel)return;const c=new THREE.Color(caseColor);caseModel.traverse(ch=>{if(!ch.isMesh||ch===artMesh)return;const n=(ch.name||"").toLowerCase();if(n.includes("camera control"))return;const old=Array.isArray(ch.material)?ch.material:[ch.material];const mats=old.map(m=>{const x=m.clone();if(x.color)x.color.copy(c);x.roughness=.72;x.metalness=.015;return x});ch.material=mats.length===1?mats[0]:mats})}

async function loadCase(){
 const stage=$("#stage");stage.innerHTML=`<div class="loader-ui"><div class="spinner"></div><strong>Loading your case…</strong><small>Preparing the 3D preview</small></div>`;
 dispose3D();
 scene=new THREE.Scene();
 camera=new THREE.PerspectiveCamera(30,1,.01,100);
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;stage.appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xffffff,0x92a4bd,2.8));
 const key=new THREE.DirectionalLight(0xffffff,3.3);key.position.set(4,5,8);scene.add(key);
 const fill=new THREE.DirectionalLight(0xbad7ff,1.5);fill.position.set(-5,1,5);scene.add(fill);
 const rim=new THREE.DirectionalLight(0xffffff,1.1);rim.position.set(0,-5,-4);scene.add(rim);
 try{
  const url=/iphone\s*17\s*pro/i.test(activeDevice?.phone_model||"")?MASTER:(activeDevice?.base_model_url||MASTER);
  const buf=await fetch(`${url}${url.includes("?")?"&":"?"}v=14`,{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.arrayBuffer()});
  const gltf=await new Promise((resolve,reject)=>loader.parse(buf,"",resolve,reject));
  caseModel=gltf.scene;
  const box=new THREE.Box3().setFromObject(caseModel);const center=box.getCenter(new THREE.Vector3());const size=box.getSize(new THREE.Vector3());
  caseModel.position.sub(center);const maxDim=Math.max(size.x,size.y,size.z);caseModel.scale.setScalar(3.35/maxDim);scene.add(caseModel);
  applyCaseColor();createArtworkSurface();
  stage.querySelector(".loader-ui")?.remove();
 }catch(e){console.error("3D case load failed",e);stage.innerHTML=`<div class="load-error"><strong>3D preview couldn't load.</strong><small>Make sure the case GLB is uploaded at <b>assets/models/iphone_17_pro_case_master.glb</b>.</small><button id="retry3d">Retry</button></div>`;$("#retry3d")?.addEventListener("click",loadCase);return}
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.055;controls.enablePan=false;controls.enableZoom=true;controls.rotateSpeed=.7;controls.zoomSpeed=.7;controls.minDistance=3;controls.maxDistance=8;controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;
 resetView();resize();renderer.domElement.addEventListener("pointerdown",artPointerDown);renderer.domElement.addEventListener("pointermove",artPointerMove);renderer.domElement.addEventListener("pointerup",artPointerUp);renderer.domElement.addEventListener("pointercancel",artPointerUp);
 cancelAnimationFrame(raf);animate();setMode(mode);
}
function createArtworkSurface(){
 canvas=document.createElement("canvas");canvas.width=1000;canvas.height=1100;ctx=canvas.getContext("2d");
 artTexture=new THREE.CanvasTexture(canvas);artTexture.colorSpace=THREE.SRGBColorSpace;artTexture.anisotropy=renderer.capabilities.getMaxAnisotropy();
 // The master case is approximately 76.3mm wide x 154.2mm high. The printable area intentionally ends below the camera plateau.
 const geo=new THREE.PlaneGeometry(68,76);
 const mat=new THREE.MeshBasicMaterial({map:artTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-6,side:THREE.DoubleSide});
 artMesh=new THREE.Mesh(geo,mat);artMesh.name="CUSTOM_PRINT_SURFACE";artMesh.position.set(0,-34.5,6.335);artMesh.renderOrder=50;caseModel.add(artMesh);drawArtwork();
}
function drawArtwork(){if(!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);for(const l of layers){ctx.save();ctx.translate(l.x,l.y);ctx.rotate(l.rotation*Math.PI/180);ctx.globalAlpha=l.opacity??1;if(l.type==="image"&&l.image){const fit=Math.min(720/l.image.width,760/l.image.height);const w=l.image.width*fit*l.scale,h=l.image.height*fit*l.scale;ctx.drawImage(l.image,-w/2,-h/2,w,h)}else if(l.type==="text"){const size=105*l.scale;ctx.fillStyle=l.color;ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=`700 ${size}px "${l.font}"`;ctx.fillText(l.text,0,0,900)}ctx.restore()}artTexture.needsUpdate=true}
async function handleImageUpload(e){const f=e.target.files?.[0];if(!f)return;if(f.size>10*1024*1024){toast("Image must be under 10 MB");e.target.value="";return}if(!/^image\/(jpeg|png|webp)$/.test(f.type)){toast("Use JPG, PNG or WEBP");e.target.value="";return}try{const url=URL.createObjectURL(f);const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>{URL.revokeObjectURL(url);res(im)};im.onerror=rej;im.src=url});const l={id:uid(),type:"image",name:f.name,image:img,x:canvas.width/2,y:canvas.height/2,scale:1,rotation:0,opacity:1};layers.push(l);selectLayer(l.id);drawArtwork();setMode("edit");toast("Image added — drag it on the case")}catch(err){console.error(err);toast("Could not read that image")}finally{e.target.value=""}}
function addText(){const text=$("#textInput").value.trim();if(!text){toast("Write your text first");return}const l={id:uid(),type:"text",name:text,text,font:$("#fontSelect").value,color:$("#textColor").value,x:canvas.width/2,y:canvas.height/2,scale:1,rotation:0,opacity:1};layers.push(l);$("#textInput").value="";selectLayer(l.id);drawArtwork();setMode("edit");toast("Text added")}
function selectLayer(id){selectedId=id;const l=selected();$("#editCard").classList.toggle("show",!!l);if(l){$("#editTitle").textContent=l.type==="text"?`Edit “${l.text.slice(0,22)}”`:"Edit image";syncEditUI()}renderLayers()}
function syncEditUI(){const l=selected();if(!l)return;$("#sizeRange").value=Math.round(l.scale*100);$("#rotateRange").value=Math.round(l.rotation);$("#viewerSize").value=Math.round(l.scale*100);$("#viewerRotate").value=Math.round(l.rotation);drawArtwork()}
function syncEditFromUI(e){const l=selected();if(!l)return;const id=e?.target?.id||"";if(id.includes("Size"))l.scale=+e.target.value/100;else if(id.includes("Rotate"))l.rotation=+e.target.value;$("#sizeRange").value=Math.round(l.scale*100);$("#rotateRange").value=Math.round(l.rotation);$("#viewerSize").value=Math.round(l.scale*100);$("#viewerRotate").value=Math.round(l.rotation);drawArtwork()}
function renderLayers(){$("#layerCount").textContent=`${layers.length} ${layers.length===1?"ITEM":"ITEMS"}`;$("#layers").innerHTML=layers.length?layers.slice().reverse().map(l=>`<div class="layer ${l.id===selectedId?"active":""}"><span>${l.type==="text"?"T":"▧"} &nbsp;${esc(l.type==="text"?l.text:l.name)}</span><button data-layer="${l.id}">Edit</button></div>`).join(""):`<p style="font-size:.58rem;color:#7b8aa2;margin:0">Your image or text will appear here.</p>`;document.querySelectorAll("[data-layer]").forEach(b=>b.onclick=()=>{selectLayer(b.dataset.layer);setMode("edit")})}
function deleteSelected(){if(!selectedId)return;layers=layers.filter(x=>x.id!==selectedId);selectedId=layers.at(-1)?.id||null;drawArtwork();selectLayer(selectedId)}
function duplicateSelected(){const l=selected();if(!l)return;const c={...l,id:uid(),x:l.x+35,y:l.y+35};layers.push(c);selectLayer(c.id);drawArtwork()}
function centerSelected(){const l=selected();if(!l)return;l.x=canvas.width/2;l.y=canvas.height/2;drawArtwork()}
function setMode(m){mode=m;$("#orbitTool").classList.toggle("active",m==="orbit");$("#editTool").classList.toggle("active",m==="edit");if(controls)controls.enabled=m==="orbit";$("#editFloating").classList.toggle("show",m==="edit");$("#hint").textContent=m==="orbit"?"Drag to rotate • pinch to zoom":"Drag the selected design directly on the case"}
function artPointerDown(e){if(mode!=="edit"||!selected())return;drag={x:e.clientX,y:e.clientY,lx:selected().x,ly:selected().y};try{renderer.domElement.setPointerCapture(e.pointerId)}catch{}}
function artPointerMove(e){if(!drag||mode!=="edit")return;const l=selected();if(!l)return;const r=renderer.domElement.getBoundingClientRect();l.x=drag.lx+(e.clientX-drag.x)*(canvas.width/r.width)*1.05;l.y=drag.ly+(e.clientY-drag.y)*(canvas.height/r.height)*1.05;drawArtwork()}
function artPointerUp(){drag=null}
function resetView(){if(!camera)return;camera.position.set(0,0,5.45);controls?.target.set(0,0,0);controls?.update()}
function dolly(f){if(!camera)return;camera.position.multiplyScalar(f);controls?.update()}
function resize(){if(!renderer)return;const r=$("#stage").getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=Math.max(1,r.width)/Math.max(1,r.height);camera.updateProjectionMatrix()}
function animate(){if(!renderer)return;controls?.update();renderer.render(scene,camera);raf=requestAnimationFrame(animate)}
function dispose3D(){cancelAnimationFrame(raf);renderer?.dispose();renderer?.domElement?.remove();renderer=null;scene=null;camera=null;controls=null;caseModel=null;artMesh=null;artTexture=null}
function updateSummary(){if(!activeDevice)return;$("#caseSummary").textContent=`${activeDevice.phone_model} Case • ${colorName(caseColor)}`;$("#caseChoice").textContent=`${activeDevice.phone_model} Case`}
function saveCustomCase(){if(!activeDevice)return;const preview=canvas?.toDataURL("image/jpeg",.78)||"";const safe=layers.map(l=>({type:l.type,name:l.name,text:l.text||"",font:l.font||"",color:l.color||"",x:l.x,y:l.y,scale:l.scale,rotation:l.rotation}));localStorage.setItem("hadi_custom_case_draft",JSON.stringify({kind:"custom_case",phone_model:activeDevice.phone_model,case_color:caseColor,preview,layers:safe,created_at:new Date().toISOString()}));toast("Custom case saved")}
addEventListener("resize",resize);initUI();await loadDevices();await loadCase();updateSummary();renderLayers();
