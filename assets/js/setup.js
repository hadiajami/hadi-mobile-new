import * as THREE from "three";import{GLTFLoader}from"three/addons/loaders/GLTFLoader.js";import{OrbitControls}from"three/addons/controls/OrbitControls.js";
const $=s=>document.querySelector(s),MODEL="assets/models/iphone_17_pro_case_master.glb";
const COLORS=["#efefed","#17181b","#565b62","#293b5c","#8db7d0","#557ba9","#d8a9b6","#b66f7e","#7a6995","#a2ad94","#55735e","#c7b99e","#d17a42","#b64249"];
const FONTS=["Manrope","Inter","Poppins","Montserrat","DM Sans","Roboto","Space Grotesk","Playfair Display","Cormorant Garamond","Oswald","Bebas Neue","Anton","Dancing Script","Great Vibes","Pacifico","Caveat","Arial","Georgia","Verdana","Impact"];
let scene,camera,renderer,controls,root,printMesh,color="#efefed";let layers=[],selected=null,drag=null,pointers=new Map(),pinch=null;
const cv=$("#designCanvas"),ctx=cv.getContext("2d");const MASK_SRC="assets/img/iphone17_case_print_mask.png";let maskImg=null;const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
function toast(s){let t=$("#toast");t.textContent=s;t.classList.add("on");setTimeout(()=>t.classList.remove("on"),1300)}
function rounded(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath()}
function redraw(){ctx.clearRect(0,0,1000,2021);for(const l of layers){ctx.save();ctx.translate(l.x,l.y);ctx.rotate(l.r*Math.PI/180);if(l.type==="image"){let f=Math.min(760/l.img.width,1150/l.img.height),w=l.img.width*f*l.s,h=l.img.height*f*l.s;ctx.drawImage(l.img,-w/2,-h/2,w,h)}else{ctx.fillStyle=l.color;ctx.font=`700 ${145*l.s}px "${l.font}"`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(l.text,0,0,900)}ctx.restore()}
 // Exact printable mask derived from the SAME iPhone 17 Pro GLB as the 3D preview.
 if(maskImg&&maskImg.complete){ctx.save();ctx.globalCompositeOperation="destination-in";ctx.drawImage(maskImg,0,0,1000,2021);ctx.restore()}
 tex.needsUpdate=true}
function active(){return layers.find(l=>l.id===selected)}
function choose(id){selected=id;let l=active();$("#layerName").textContent=l?(l.type==="text"?"Text: ":"Photo: ")+l.name:"No layer selected";if(l){$("#scale").value=l.s*100;$("#rotation").value=l.r;if(l.type==="text"){$("#textValue").value=l.text;$("#font").value=l.font;$("#textColor").value=l.color}}}
async function addImage(file){if(!file)return;try{let img=await createImageBitmap(file),l={id:crypto.randomUUID(),type:"image",name:file.name,img,x:500,y:1180,s:1,r:0};layers.push(l);choose(l.id);redraw();openEditor()}catch(e){console.error(e);toast("Could not open image")}}
async function addText(){try{await document.fonts.ready}catch(e){}let l={id:crypto.randomUUID(),type:"text",name:"Text",text:"Your text",font:"Manrope",color:"#111111",x:500,y:1180,s:1,r:0};layers.push(l);choose(l.id);redraw();openEditor();$("#textValue").focus();$("#textValue").select()}
function openEditor(){updateViewport();history.pushState({caseEditor:true},"");$("#editor").classList.add("open");document.body.style.overflow="hidden"}
function closeEditor(){if(!$("#editor").classList.contains("open"))return;$("#editor").classList.remove("open");document.body.style.overflow="";backView();toast("Design applied to 3D")}
function backView(){camera.position.set(0,-.1,-6.1);controls.target.set(0,-.2,0);camera.lookAt(controls.target);controls.update()}
function fit(){camera.position.set(0,-.1,-6.4);controls.target.set(0,-.2,0);camera.lookAt(controls.target);controls.update()}
function setupUI(){$("#swatches").innerHTML=COLORS.map((c,i)=>`<button type="button" class="sw ${i?"":"on"}" data-c="${c}" style="background:${c}"></button>`).join("");document.querySelectorAll("[data-c]").forEach(b=>b.addEventListener("click",()=>{color=b.dataset.c;document.querySelectorAll(".sw").forEach(x=>x.classList.toggle("on",x===b));recolor()}));
 $("#font").innerHTML=FONTS.map(f=>`<option value="${f}">${f}</option>`).join("");
 $("#photo").onchange=e=>{addImage(e.target.files[0]);e.target.value=""};$("#photoInside").onchange=e=>{addImage(e.target.files[0]);e.target.value=""};
 $("#addTextQuick").onclick=addText;$("#newText").onclick=addText;$("#addPhotoInside").onclick=()=>$("#photoInside").click();$("#editDesign").onclick=openEditor;
 $("#closeEditor").onclick=closeEditor;$("#apply3d").onclick=closeEditor;$("#backView").onclick=backView;$("#fit").onclick=fit;
 $("#zin").onclick=()=>{camera.position.multiplyScalar(.88);controls.update()};$("#zout").onclick=()=>{camera.position.multiplyScalar(1.12);controls.update()};
 $("#scale").oninput=e=>{let l=active();if(l){l.s=+e.target.value/100;redraw()}};$("#rotation").oninput=e=>{let l=active();if(l){l.r=+e.target.value;redraw()}};
 $("#center").onclick=()=>{let l=active();if(l){l.x=500;l.y=1180;redraw()}};
 $("#del").onclick=()=>{if(!selected)return;layers=layers.filter(l=>l.id!==selected);selected=layers.at(-1)?.id||null;choose(selected);redraw()};
 $("#textValue").oninput=e=>{let l=active();if(l?.type==="text"){l.text=e.target.value;l.name=e.target.value||"Text";redraw();choose(l.id)}};
 $("#font").onchange=async e=>{let l=active();if(l?.type==="text"){l.font=e.target.value;try{await document.fonts.load(`700 145px "${l.font}"`)}catch{}redraw()}};
 $("#textColor").oninput=e=>{let l=active();if(l?.type==="text"){l.color=e.target.value;redraw()}};
 $("#removeBg").onclick=removeBg;
 window.addEventListener("popstate",()=>{if($("#editor").classList.contains("open")){$("#editor").classList.remove("open");document.body.style.overflow="";backView()}});
}
function recolor(){if(!root)return;let c=new THREE.Color(color);root.traverse(o=>{if(!o.isMesh||o===printMesh)return;let a=Array.isArray(o.material)?o.material:[o.material];let n=a.map(m=>{m=m.clone();if(m.color)m.color.copy(c);m.roughness=.78;return m});o.material=Array.isArray(o.material)?n:n[0]})}
async function init3d(){scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(31,1,.01,100);renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;$("#stage").innerHTML="";$("#stage").appendChild(renderer.domElement);scene.add(new THREE.HemisphereLight(0xffffff,0x94a5bb,2.6));let d=new THREE.DirectionalLight(0xffffff,3);d.position.set(4,6,7);scene.add(d);
 root=(await new GLTFLoader().loadAsync(MODEL)).scene;let b=new THREE.Box3().setFromObject(root),sz=b.getSize(new THREE.Vector3()),ce=b.getCenter(new THREE.Vector3());root.position.sub(ce);root.scale.setScalar(3.45/Math.max(sz.x,sz.y,sz.z));scene.add(root);
 let g=new THREE.PlaneGeometry(76.30,154.1946),m=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});printMesh=new THREE.Mesh(g,m);printMesh.position.set(0,0,-7.555);printMesh.rotation.y=Math.PI;printMesh.renderOrder=10;root.add(printMesh);recolor();
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=3.6;controls.maxDistance=9;fit();resize();(function loop(){controls.update();renderer.render(scene,camera);requestAnimationFrame(loop)})()}
function resize(){if(!renderer)return;let r=$("#stage").getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}
function canvasPoint(e){let r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*1000/r.width,y:(e.clientY-r.top)*2021/r.height}}
cv.addEventListener("pointerdown",e=>{if(!active())return;e.preventDefault();cv.setPointerCapture?.(e.pointerId);let p=canvasPoint(e);pointers.set(e.pointerId,p);if(pointers.size===1){let l=active();drag={px:p.x,py:p.y,x:l.x,y:l.y}}else if(pointers.size===2){let a=[...pointers.values()],l=active();pinch={d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),s:l.s};drag=null}},{passive:false});
cv.addEventListener("pointermove",e=>{if(!pointers.has(e.pointerId)||!active())return;e.preventDefault();let p=canvasPoint(e);pointers.set(e.pointerId,p);let l=active();if(pointers.size>=2&&pinch){let a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);l.s=Math.max(.1,Math.min(4,pinch.s*d/pinch.d));$("#scale").value=l.s*100;redraw()}else if(drag){l.x=Math.max(25,Math.min(975,drag.x+p.x-drag.px));l.y=Math.max(25,Math.min(1996,drag.y+p.y-drag.py));redraw()}},{passive:false});
function pend(e){pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;if(!pointers.size)drag=null}cv.addEventListener("pointerup",pend);cv.addEventListener("pointercancel",pend);
async function removeBg(){let l=active();if(!l||l.type!=="image"){toast("Select a photo first");return}toast("Removing background…");try{let mod=await import("https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm"),c=document.createElement("canvas");c.width=l.img.width;c.height=l.img.height;c.getContext("2d").drawImage(l.img,0,0);let blob=await new Promise(r=>c.toBlob(r,"image/png")),res=await mod.removeBackground(blob,{output:{format:"image/png"}});l.img=await createImageBitmap(res);redraw();toast("Background removed")}catch(e){console.error(e);toast("Could not remove background")}}
["gesturestart","gesturechange","gestureend"].forEach(t=>document.addEventListener(t,e=>{if($("#editor").classList.contains("open"))e.preventDefault()},{passive:false}));
function updateViewport(){const h=window.visualViewport?.height||window.innerHeight;document.documentElement.style.setProperty("--vvh",h+"px")}
window.visualViewport?.addEventListener("resize",updateViewport);window.visualViewport?.addEventListener("scroll",updateViewport);window.addEventListener("orientationchange",()=>setTimeout(updateViewport,120));updateViewport();
maskImg=new Image();maskImg.onload=()=>redraw();maskImg.src=MASK_SRC;
setupUI();redraw();init3d().catch(e=>{console.error(e);$("#stage").innerHTML='<div class="loading">Could not load 3D case.</div>'});window.addEventListener("resize",resize);
