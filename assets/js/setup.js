import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const $=s=>document.querySelector(s);
const MODEL="assets/models/iphone_17_pro_case_master.glb";
const COLORS=[["White","#efefed"],["Black","#17181b"],["Graphite","#4c5158"],["Navy","#263a5f"],["Sky","#8db9d5"],["Blue","#416ea6"],["Pink","#d7a6b3"],["Rose","#b66d7c"],["Purple","#776695"],["Lavender","#b7a9ce"],["Sage","#9eaa91"],["Green","#54725d"],["Mint","#a5c7b5"],["Sand","#c8b89c"],["Brown","#775c49"],["Orange","#d2763d"],["Red","#b53b43"],["Yellow","#ddc75d"]];
const FONTS=["Manrope","Inter","Poppins","Montserrat","DM Sans","Roboto","Space Grotesk","Playfair Display","Cormorant Garamond","Oswald","Bebas Neue","Anton","Dancing Script","Great Vibes","Pacifico","Caveat","Arial","Georgia","Verdana","Trebuchet MS","Impact","Courier New","Times New Roman"];

let scene,camera,renderer,controls,caseRoot,artMesh,artCanvas,artCtx,artTexture,raf;
let fsScene,fsCamera,fsRenderer,fsControls,fsCase,fsArt,fsRaf;
let caseColor="#efefed", layers=[], selectedId=null, mode="rotate", drag=null;

function toast(s){const t=$("#toast");t.textContent=s;t.classList.add("on");setTimeout(()=>t.classList.remove("on"),1500)}
function selected(){return layers.find(x=>x.id===selectedId)}
function id(){return "l"+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}

function buildUI(){
  $("#swatches").innerHTML=COLORS.map(([n,c],i)=>`<button class="swatch ${i===0?"on":""}" style="background:${c}" data-color="${c}" title="${n}"></button>`).join("")+`<label class="swatch custom" title="Any color"><input id="customColor" type="color" value="${caseColor}"></label>`;
  $("#fontSelect").innerHTML=FONTS.map(f=>`<option value="${f}" style="font-family:'${f}'">${f}</option>`).join("");
  document.querySelectorAll("[data-color]").forEach(b=>b.onclick=()=>setColor(b.dataset.color,b));
  $("#customColor").oninput=e=>setColor(e.target.value);
  $("#quickColor").oninput=e=>setColor(e.target.value);
  $("#photoInput").onchange=uploadPhoto;
  $("#textToggle").onclick=()=>$("#textForm").classList.toggle("open");
  $("#addText").onclick=addText;
  $("#textInput").onkeydown=e=>{if(e.key==="Enter")addText()};
  $("#rotateMode").onclick=()=>setMode("rotate");
  $("#editMode").onclick=()=>setMode("edit");
  $("#backView").onclick=()=>backView(false);
  $("#zoomIn").onclick=()=>zoomMain(.84);
  $("#zoomOut").onclick=()=>zoomMain(1.18);
  $("#openFull").onclick=openFull;
  $("#fullFromEdit").onclick=openFull;
  $("#closeFull").onclick=closeFull;
  $("#sizeRange").oninput=e=>changeScale(+e.target.value/100);
  $("#rotationRange").oninput=e=>changeRotation(+e.target.value);
  $("#fsSize").oninput=e=>changeScale(+e.target.value/100);
  $("#fsRotate").oninput=e=>changeRotation(+e.target.value);
  document.querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>{let [x,y]=b.dataset.move.split(",").map(Number);moveSelected(x,y)});
  $("#centerBtn").onclick=centerSelected; $("#fsCenter").onclick=centerSelected;
  $("#deleteBtn").onclick=deleteSelected; $("#fsDelete").onclick=deleteSelected;
  $("#fsZoomIn").onclick=()=>zoomFull(.86); $("#fsZoomOut").onclick=()=>zoomFull(1.16);
}

function setColor(c,btn){
  caseColor=c; $("#quickColor").value=c; const cc=$("#customColor"); if(cc)cc.value=c;
  document.querySelectorAll("[data-color]").forEach(x=>x.classList.toggle("on",x===btn));
  recolor(caseRoot); recolor(fsCase);
}
function recolor(root){
  if(!root)return; const c=new THREE.Color(caseColor);
  root.traverse(o=>{if(!o.isMesh)return; const n=(o.name||"").toLowerCase(); if(n.includes("camera control"))return;
    const arr=Array.isArray(o.material)?o.material:[o.material]; const cloned=arr.map(m=>{m=m.clone();if(m.color)m.color.copy(c);m.roughness=.76;m.metalness=.01;return m});o.material=Array.isArray(o.material)?cloned:cloned[0];
  });
}

function createArtwork(){
  artCanvas=document.createElement("canvas");artCanvas.width=900;artCanvas.height=1350;artCtx=artCanvas.getContext("2d");
  artTexture=new THREE.CanvasTexture(artCanvas);artTexture.colorSpace=THREE.SRGBColorSpace;artTexture.anisotropy=8;
  redraw();
}
function makeArtPlane(texture){
  const g=new THREE.PlaneGeometry(66,100);
  const m=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4});
  const p=new THREE.Mesh(g,m);
  // Exact master GLB: rear face is negative Z. Keep print below camera plateau.
  p.position.set(0,-22,7.58);p.renderOrder=20;p.name="CUSTOM_PRINT_SURFACE";
  return p;
}
async function loadMain(){
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(32,1,.01,1000);renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  $("#stage").innerHTML="";$("#stage").appendChild(renderer.domElement);lights(scene);
  try{caseRoot=(await new GLTFLoader().loadAsync(MODEL)).scene;normalize(caseRoot);scene.add(caseRoot);artMesh=makeArtPlane(artTexture);caseRoot.add(artMesh);recolor(caseRoot)}
  catch(e){console.error(e);$("#stage").innerHTML='<div class="loading">3D case file could not load.<br>Check assets/models/iphone_17_pro_case_master.glb</div>';return}
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.055;controls.enablePan=false;controls.rotateSpeed=.75;controls.zoomSpeed=.7;controls.minDistance=3;controls.maxDistance=8;controls.target.set(0,0,0);
  camera.position.set(0,0,5.1);controls.update();resizeMain();mainLoop();attachDrag(renderer.domElement,false);
}
function lights(s){s.add(new THREE.HemisphereLight(0xffffff,0x93a6c0,2.5));let a=new THREE.DirectionalLight(0xffffff,3);a.position.set(4,6,7);s.add(a);let b=new THREE.DirectionalLight(0xb8d9ff,1.5);b.position.set(-4,-2,5);s.add(b)}
function normalize(o){const b=new THREE.Box3().setFromObject(o),sz=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());o.position.sub(c);o.scale.setScalar(3.45/Math.max(sz.x,sz.y,sz.z))}
function resizeMain(){if(!renderer)return;let r=$("#stage").getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}
function mainLoop(){controls?.update();renderer?.render(scene,camera);raf=requestAnimationFrame(mainLoop)}
function zoomMain(f){if(!camera)return;const dir=Math.sign(camera.position.z)||1;const z=Math.min(6.4,Math.max(3.75,Math.abs(camera.position.z)*f));camera.position.z=dir*z;controls?.update()}
function backView(instant=true){if(!camera||!controls)return;camera.position.set(0,-.1,5.0);controls.target.set(0,-.25,0);controls.update();if(selectedId&&mode!=="edit")setMode("edit")}

async function openFull(){
  if(!selectedId && !layers.length){toast("Add a photo or text first");return}
  if(!selectedId && layers.length)selectLayer(layers[layers.length-1].id);
  $("#fullEditor").classList.add("open");document.body.style.overflow="hidden";
  fsScene=new THREE.Scene();fsCamera=new THREE.PerspectiveCamera(29,1,.01,1000);fsRenderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  fsRenderer.setPixelRatio(Math.min(devicePixelRatio,2));fsRenderer.outputColorSpace=THREE.SRGBColorSpace;fsRenderer.toneMapping=THREE.ACESFilmicToneMapping;fsRenderer.toneMappingExposure=1.08;
  $("#fsStage").innerHTML="";$("#fsStage").appendChild(fsRenderer.domElement);lights(fsScene);
  fsCase=caseRoot.clone(true); // cloned current model + artwork plane
  // Replace cloned artwork material with same live texture.
  fsCase.traverse(o=>{if(o.name==="CUSTOM_PRINT_SURFACE"){fsArt=o;o.material=o.material.clone();o.material.map=artTexture;o.material.needsUpdate=true}});
  fsScene.add(fsCase);recolor(fsCase);
  fsCamera.position.set(0,-.1,4.65);
  fsControls=new OrbitControls(fsCamera,fsRenderer.domElement);fsControls.enabled=false;fsControls.enableRotate=false;fsControls.enablePan=false;fsControls.enableZoom=false;fsControls.target.set(0,-.28,0);fsControls.update();
  resizeFull();fullLoop();attachDrag(fsRenderer.domElement,true);syncEditor();
}
function closeFull(){cancelAnimationFrame(fsRaf);fsControls?.dispose();fsRenderer?.dispose();fsScene=fsCamera=fsRenderer=fsControls=fsCase=fsArt=null;$("#fullEditor").classList.remove("open");document.body.style.overflow=""}
function resizeFull(){if(!fsRenderer)return;let r=$("#fsStage").getBoundingClientRect();fsRenderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);fsCamera.aspect=r.width/r.height;fsCamera.updateProjectionMatrix()}
function fullLoop(){fsRenderer?.render(fsScene,fsCamera);fsRaf=requestAnimationFrame(fullLoop)}
function zoomFull(f){if(!fsCamera)return;fsCamera.position.z=Math.min(5.9,Math.max(3.55,Math.abs(fsCamera.position.z)*f));fsCamera.position.x=0;fsCamera.position.y=-.1;fsCamera.lookAt(0,-.28,0)}

function setMode(m){mode=m;$("#rotateMode").classList.toggle("on",m==="rotate");$("#editMode").classList.toggle("on",m==="edit");if(controls)controls.enabled=m==="rotate";$("#viewerNote").textContent=m==="rotate"?"Drag to rotate • Pinch to zoom":"Drag selected design on the case • Full editor for precision";if(m==="edit"&&camera&&controls){camera.position.set(0,-.1,5.0);controls.target.set(0,-.25,0);controls.update()}}
function attachDrag(el,full){
  el.addEventListener("pointerdown",e=>{if((!full&&mode!=="edit")||!selected())return;drag={sx:e.clientX,sy:e.clientY,x:selected().x,y:selected().y,full};el.setPointerCapture?.(e.pointerId)});
  el.addEventListener("pointermove",e=>{if(!drag||drag.full!==full)return;let r=el.getBoundingClientRect(),l=selected();if(!l)return;l.x=Math.max(80,Math.min(820,drag.x+(e.clientX-drag.sx)*(artCanvas.width/r.width)*1.05));l.y=Math.max(100,Math.min(1250,drag.y+(e.clientY-drag.sy)*(artCanvas.height/r.height)*1.05));redraw()});
  const end=()=>drag=null;el.addEventListener("pointerup",end);el.addEventListener("pointercancel",end);
}

async function uploadPhoto(e){
  const f=e.target.files?.[0];if(!f)return;if(!/^image\/(jpeg|png|webp)$/.test(f.type)){toast("Use JPG, PNG or WEBP");return}
  if(f.size>10*1024*1024){toast("Image must be under 10 MB");return}
  try{
    let im=await createImageBitmap(f);
    let l={id:id(),type:"image",name:f.name,image:im,x:450,y:675,scale:1,rotation:0};layers.push(l);selectLayer(l.id);redraw();setMode("edit");backView();toast("Photo added to the back");
  }catch(err){console.error(err);toast("Could not open this image")}
  e.target.value="";
}
async function addText(){
  let text=$("#textInput").value.trim();if(!text){toast("Write your text first");return}
  const font=$("#fontSelect").value;
  try{await document.fonts.load(`700 105px "${font}"`);await document.fonts.ready}catch(e){}
  let l={id:id(),type:"text",name:text,text,font,color:$("#textColor").value,x:450,y:675,scale:1,rotation:0};
  layers.push(l);$("#textInput").value="";$("#textForm").classList.remove("open");selectLayer(l.id);redraw();setMode("edit");toast("Text added — drag it directly on the back")
}
function redraw(){
  if(!artCtx)return;artCtx.clearRect(0,0,900,1350);
  for(let l of layers){artCtx.save();artCtx.translate(l.x,l.y);artCtx.rotate(l.rotation*Math.PI/180);
    if(l.type==="image"){let fit=Math.min(650/l.image.width,900/l.image.height),w=l.image.width*fit*l.scale,h=l.image.height*fit*l.scale;artCtx.drawImage(l.image,-w/2,-h/2,w,h)}
    else{let size=145*l.scale;artCtx.font=`700 ${size}px "${l.font}"`;artCtx.textAlign="center";artCtx.textBaseline="middle";artCtx.fillStyle=l.color;artCtx.fillText(l.text,0,0,820)}
    artCtx.restore()}
  artTexture.needsUpdate=true;
}
function selectLayer(i){selectedId=i;renderLayers();syncEditor()}
function renderLayers(){
  let box=$("#layers");if(!layers.length){box.innerHTML='<span class="sub">No design added yet.</span>';return}
  box.innerHTML=layers.slice().reverse().map(l=>`<div class="layer ${l.id===selectedId?"on":""}"><span>${l.type==="text"?"T":"▧"} &nbsp;${escapeHtml(l.name)}</span><button data-layer="${l.id}">Edit</button></div>`).join("");
  box.querySelectorAll("[data-layer]").forEach(b=>b.onclick=()=>{selectLayer(b.dataset.layer);setMode("edit")});
}
function syncEditor(){
  let l=selected();$("#editor").classList.toggle("show",!!l);if(!l)return;$("#editorTitle").textContent=l.type==="text"?"Edit text":"Edit photo";$("#sizeRange").value=Math.round(l.scale*100);$("#rotationRange").value=l.rotation;$("#fsSize").value=Math.round(l.scale*100);$("#fsRotate").value=l.rotation;
}
function changeScale(v){let l=selected();if(!l)return;l.scale=v;$("#sizeRange").value=Math.round(v*100);$("#fsSize").value=Math.round(v*100);redraw()}
function changeRotation(v){let l=selected();if(!l)return;l.rotation=v;$("#rotationRange").value=v;$("#fsRotate").value=v;redraw()}
function moveSelected(dx,dy){let l=selected();if(!l)return;l.x=Math.max(80,Math.min(820,l.x+dx));l.y=Math.max(100,Math.min(1250,l.y+dy));redraw()}
function centerSelected(){let l=selected();if(!l)return;l.x=450;l.y=675;redraw()}
function deleteSelected(){if(!selectedId)return;layers=layers.filter(l=>l.id!==selectedId);selectedId=layers.at(-1)?.id||null;redraw();renderLayers();syncEditor()}

window.addEventListener("resize",()=>{resizeMain();resizeFull()});
window.addEventListener("keydown",e=>{
  if(!selected()||["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName))return;
  let n=e.shiftKey?20:6;
  if(e.key==="ArrowLeft"){e.preventDefault();moveSelected(-n,0)}
  if(e.key==="ArrowRight"){e.preventDefault();moveSelected(n,0)}
  if(e.key==="ArrowUp"){e.preventDefault();moveSelected(0,-n)}
  if(e.key==="ArrowDown"){e.preventDefault();moveSelected(0,n)}
  if(e.key==="Delete"){e.preventDefault();deleteSelected()}
  if(e.key==="Escape"&&$("#fullEditor").classList.contains("open"))closeFull();
});


function preventBrowserZoom(){
  const targets=[document.getElementById("stage"),document.getElementById("fsStage")].filter(Boolean);
  for(const el of targets){
    ["gesturestart","gesturechange","gestureend"].forEach(type=>el.addEventListener(type,e=>e.preventDefault(),{passive:false}));
    let lastTouchEnd=0;
    el.addEventListener("touchend",e=>{const now=Date.now();if(now-lastTouchEnd<=320)e.preventDefault();lastTouchEnd=now},{passive:false});
  }
}

buildUI();createArtwork();renderLayers();loadMain();preventBrowserZoom();
