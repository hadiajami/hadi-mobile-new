import * as THREE from "three";import{GLTFLoader}from"three/addons/loaders/GLTFLoader.js";import{OrbitControls}from"three/addons/controls/OrbitControls.js";
const $=s=>document.querySelector(s),MODEL="assets/models/iphone_17_pro_case_master.glb";
const COLORS=["#efefed","#17181b","#565b62","#293b5c","#8db7d0","#557ba9","#d8a9b6","#b66f7e","#7a6995","#a2ad94","#55735e","#c7b99e","#d17a42","#b64249"];
const FONTS=["Manrope","Inter","Poppins","Montserrat","DM Sans","Roboto","Space Grotesk","Playfair Display","Cormorant Garamond","Oswald","Bebas Neue","Anton","Dancing Script","Great Vibes","Pacifico","Caveat","Arial","Georgia","Verdana","Impact"];
let scene,camera,renderer,controls,root,printMesh,color="#efefed";let layers=[],selected=null,drag=null,pointers=new Map(),pinch=null;let activeTab="case";
const cv=$("#designCanvas"),ctx=cv.getContext("2d");const MASK_SRC="assets/img/iphone17_case_print_mask.png";let maskImg=null;const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
function toast(s){let t=$("#toast");t.textContent=s;t.classList.add("on");setTimeout(()=>t.classList.remove("on"),1300)}
function rounded(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath()}
function drawImageEffect(c,l,x,y,w,h){
 const e=l.effect||"original";
 if(e==="original"){c.drawImage(l.img,x,y,w,h);return}
 if(e==="bw"){c.filter="grayscale(1) contrast(1.08)";c.drawImage(l.img,x,y,w,h);c.filter="none";return}
 if(e==="vivid"){c.filter="saturate(1.65) contrast(1.12)";c.drawImage(l.img,x,y,w,h);c.filter="none";return}
 const oc=document.createElement("canvas"),ow=Math.max(1,Math.round(w)),oh=Math.max(1,Math.round(h));oc.width=ow;oc.height=oh;const o=oc.getContext("2d");o.drawImage(l.img,0,0,ow,oh);
 const im=o.getImageData(0,0,ow,oh),d=im.data;
 if(e==="cartoon"){for(let i=0;i<d.length;i+=4){d[i]=Math.round(d[i]/64)*64;d[i+1]=Math.round(d[i+1]/64)*64;d[i+2]=Math.round(d[i+2]/64)*64}o.putImageData(im,0,0)}
 if(e==="outline"){const src=new Uint8ClampedArray(d);for(let yy=1;yy<oh-1;yy++)for(let xx=1;xx<ow-1;xx++){let i=(yy*ow+xx)*4,ir=(yy*ow+xx+1)*4,id=((yy+1)*ow+xx)*4;let g=(src[i]+src[i+1]+src[i+2])/3,gr=(src[ir]+src[ir+1]+src[ir+2])/3,gd=(src[id]+src[id+1]+src[id+2])/3,v=Math.abs(g-gr)+Math.abs(g-gd),q=v>34?20:245;d[i]=d[i+1]=d[i+2]=q}o.putImageData(im,0,0)}
 c.drawImage(oc,x,y,w,h)
}
function redraw(){ctx.clearRect(0,0,1000,2021);for(const l of layers){ctx.save();ctx.translate(l.x,l.y);ctx.rotate(l.r*Math.PI/180);if(l.type==="image"){let f=Math.min(760/l.img.width,1150/l.img.height),w=l.img.width*f*l.s,h=l.img.height*f*l.s;drawImageEffect(ctx,l,-w/2,-h/2,w,h)}else{ctx.fillStyle=l.color;ctx.font=`700 ${145*l.s}px "${l.font}"`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(l.text,0,0,900)}ctx.restore()}
 // Exact printable mask derived from the SAME iPhone 17 Pro GLB as the 3D preview.
 if(maskImg&&maskImg.complete){ctx.save();ctx.globalCompositeOperation="destination-in";ctx.drawImage(maskImg,0,0,1000,2021);ctx.restore()}
 tex.needsUpdate=true}
function active(){return layers.find(l=>l.id===selected)}
function choose(id){
 selected=id;let l=active();
 $("#layerName").textContent=l?(l.type==="text"?"Text: ":"Photo: ")+l.name:"No layer selected";
 if(l){
   $("#scale").value=l.s*100;$("#rotation").value=l.r;
   $("#photoScale").value=l.s*100;$("#photoRotation").value=l.r;
   if(l.type==="text"){$("#textValue").value=l.text;$("#font").value=l.font;$("#textColor").value=l.color}
 }
 renderLayers();renderFontPreview();syncEffectButtons();
}
async function addImage(file){if(!file)return;try{let img=await createImageBitmap(file),l={id:crypto.randomUUID(),type:"image",name:file.name,img,x:500,y:1180,s:1,r:0,effect:"original"};layers.push(l);choose(l.id);redraw();openEditor();showTab("photo");updateReview()}catch(e){console.error(e);toast("Could not open image")}}
async function addText(){try{await document.fonts.ready}catch(e){}let l={id:crypto.randomUUID(),type:"text",name:"Text",text:"Your text",font:"Manrope",color:"#111111",x:500,y:1180,s:1,r:0};layers.push(l);choose(l.id);redraw();openEditor();showTab("text");updateReview();$("#textValue").focus();$("#textValue").select()}
function openEditor(){updateViewport();history.pushState({caseEditor:true},"");$("#editor").classList.add("open");document.body.style.overflow="hidden"}
function closeEditor(){if(!$("#editor").classList.contains("open"))return;updateReview();$("#editor").classList.remove("open");document.body.style.overflow="";backView();toast("Design applied to 3D")}
function backView(){camera.position.set(0,-.1,-6.1);controls.target.set(0,-.2,0);camera.lookAt(controls.target);controls.update()}
function fit(){camera.position.set(0,-.1,-6.4);controls.target.set(0,-.2,0);camera.lookAt(controls.target);controls.update()}
function setupUI(){
 document.documentElement.style.setProperty("--case-color",color);
 const sw=COLORS.map((c,i)=>`<button type="button" class="sw ${i?"":"on"}" data-c="${c}" style="background:${c}"></button>`).join("");
 $("#editorSwatches").innerHTML=sw;
 document.querySelectorAll("[data-c]").forEach(b=>b.addEventListener("click",()=>{color=b.dataset.c;document.documentElement.style.setProperty("--case-color",color);document.querySelectorAll("[data-c]").forEach(x=>x.classList.toggle("on",x===b));recolor();updateReview()}));
 $("#font").innerHTML=FONTS.map(f=>`<option value="${f}">${f}</option>`).join("");
 document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
 $("#newText").onclick=addText;$("#addPhotoInside").onclick=()=>$("#photoInside").click();
 $("#photoInside").onchange=e=>{addImage(e.target.files[0]);e.target.value=""};
 $("#editDesign").onclick=openEditor;$("#reviewEdit").onclick=openEditor;
 $("#closeEditor").onclick=closeEditor;$("#apply3d").onclick=closeEditor;$("#backView").onclick=backView;$("#fit").onclick=fit;
 $("#zin").onclick=()=>{camera.position.multiplyScalar(.88);controls.update()};$("#zout").onclick=()=>{camera.position.multiplyScalar(1.12);controls.update()};
 $("#scale").oninput=e=>setLayerScale(e.target.value);$("#photoScale").oninput=e=>setLayerScale(e.target.value);
 $("#rotation").oninput=e=>setLayerRotation(e.target.value);$("#photoRotation").oninput=e=>setLayerRotation(e.target.value);
 $("#center").onclick=centerLayer;$("#photoCenter").onclick=centerLayer;$("#del").onclick=deleteLayer;$("#photoDelete").onclick=deleteLayer;
 $("#textValue").oninput=e=>{let l=active();if(l?.type==="text"){l.text=e.target.value;l.name=e.target.value||"Text";redraw();choose(l.id);updateReview()}};
 $("#textColor").oninput=e=>{let l=active();if(l?.type==="text"){l.color=e.target.value;redraw()}};
 $("#removeBg").onclick=removeBg;
 document.querySelectorAll("[data-effect]").forEach(b=>b.onclick=()=>{let l=active();if(!l||l.type!=="image"){toast("Select a photo first");return}l.effect=b.dataset.effect;syncEffectButtons();redraw()});
 $("#caseAddCart").onclick=saveCustomDraft;
 renderFontPreview();renderLayers();updateReview();
 window.addEventListener("popstate",()=>{if($("#editor").classList.contains("open")){$("#editor").classList.remove("open");document.body.style.overflow="";backView()}});
}
function showTab(name){activeTab=name;document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("on",b.dataset.tab===name));document.querySelectorAll(".tabpane").forEach(p=>p.classList.toggle("on",p.id==="pane-"+name))}
function setLayerScale(v){let l=active();if(l){l.s=+v/100;$("#scale").value=v;$("#photoScale").value=v;redraw()}}
function setLayerRotation(v){let l=active();if(l){l.r=+v;$("#rotation").value=v;$("#photoRotation").value=v;redraw()}}
function centerLayer(){let l=active();if(l){l.x=500;l.y=1180;redraw()}}
function deleteLayer(){if(!selected)return;layers=layers.filter(l=>l.id!==selected);selected=layers.at(-1)?.id||null;choose(selected);redraw();updateReview()}
function renderLayers(){let box=$("#layerList");if(!box)return;box.innerHTML=layers.length?layers.map(l=>`<button type="button" class="layer-pill ${l.id===selected?"on":""}" data-layer="${l.id}">${l.type==="text"?"T":"▧"} ${l.type==="text"?(l.text||"Text"):l.name}</button>`).join(""):"<span>No design added yet.</span>";box.querySelectorAll("[data-layer]").forEach(b=>b.onclick=()=>{choose(b.dataset.layer);showTab(active()?.type==="text"?"text":"photo")})}
function renderFontPreview(){let box=$("#fontPreview");if(!box)return;let l=active(),cur=l?.type==="text"?l.font:"Manrope";box.innerHTML=FONTS.map(f=>`<button type="button" class="font-chip ${f===cur?"on":""}" data-font="${f}" style="font-family:'${f}'">${l?.type==="text"?(l.text||"Text"):"Aa"}</button>`).join("");box.querySelectorAll("[data-font]").forEach(b=>b.onclick=async()=>{let x=active();if(!x||x.type!=="text"){toast("Add or select text first");return}x.font=b.dataset.font;$("#font").value=x.font;try{await document.fonts.load(`700 145px "${x.font}"`)}catch{}redraw();renderFontPreview()})}
function syncEffectButtons(){let l=active();document.querySelectorAll("[data-effect]").forEach(b=>b.classList.toggle("on",l?.type==="image"&&(l.effect||"original")===b.dataset.effect))}
function updateReview(){let names={"#efefed":"White","#17181b":"Black","#565b62":"Gray","#293b5c":"Navy","#8db7d0":"Sky","#557ba9":"Blue","#d8a9b6":"Pink","#b66f7e":"Rose","#7a6995":"Purple","#a2ad94":"Sage","#55735e":"Green","#c7b99e":"Sand","#d17a42":"Orange","#b64249":"Red"};$("#reviewColor").style.background=color;$("#reviewColorName").textContent=names[color]||color;let photos=layers.filter(x=>x.type==="image").length,texts=layers.filter(x=>x.type==="text").length;$("#reviewDesign").textContent=!layers.length?"No artwork yet":[photos?`${photos} photo${photos>1?"s":""}`:"",texts?`${texts} text layer${texts>1?"s":""}`:""].filter(Boolean).join(" + ")}
function saveCustomDraft(){let preview=cv.toDataURL("image/jpeg",.88);localStorage.setItem("hadi_custom_case_draft",JSON.stringify({kind:"custom_case",phone_model:"iPhone 17 Pro",case_color:color,preview,layers:layers.map(l=>({type:l.type,name:l.name,text:l.text||"",font:l.font||"",color:l.color||"",x:l.x,y:l.y,s:l.s,r:l.r,effect:l.effect||"original"})),updated_at:new Date().toISOString()}));toast("Custom case saved — ready for cart integration")}
function recolor(){if(!root)return;let c=new THREE.Color(color);root.traverse(o=>{if(!o.isMesh||o===printMesh)return;let a=Array.isArray(o.material)?o.material:[o.material];let n=a.map(m=>{m=m.clone();if(m.color)m.color.copy(c);m.roughness=.78;return m});o.material=Array.isArray(o.material)?n:n[0]})}
async function init3d(){scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(31,1,.01,100);renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;$("#stage").innerHTML="";$("#stage").appendChild(renderer.domElement);scene.add(new THREE.HemisphereLight(0xffffff,0x94a5bb,2.6));let d=new THREE.DirectionalLight(0xffffff,3);d.position.set(4,6,7);scene.add(d);
 root=(await new GLTFLoader().loadAsync(MODEL)).scene;let b=new THREE.Box3().setFromObject(root),sz=b.getSize(new THREE.Vector3()),ce=b.getCenter(new THREE.Vector3());root.position.sub(ce);root.scale.setScalar(3.45/Math.max(sz.x,sz.y,sz.z));scene.add(root);
 let g=new THREE.PlaneGeometry(76.30,154.1946),m=new THREE.MeshBasicMaterial({map:tex,transparent:true,alphaTest:0.01,depthTest:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});printMesh=new THREE.Mesh(g,m);printMesh.position.set(0,0,-7.555);printMesh.rotation.y=Math.PI;printMesh.renderOrder=10;root.add(printMesh);recolor();
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
