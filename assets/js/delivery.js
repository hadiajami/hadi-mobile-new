(()=>{
  const CFG=window.HADI_CONFIG||{};
  const CURRENCY=CFG.CURRENCY||"USD";
  const $=s=>document.querySelector(s);
  const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:CURRENCY,maximumFractionDigits:2}).format(Number(n||0));
  const esc=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  let cart=[];
  try{cart=JSON.parse(localStorage.getItem("hadi_cart")||"[]")||[];}catch{cart=[];}
  const root=$("#checkoutRoot");
  const toast=msg=>{const t=$("#toast");if(!t)return;t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)};
  if(!cart.length){
    root.innerHTML=`<div class="card empty-cart"><div style="font-size:2rem">🛍</div><h2>Your cart is empty.</h2><p>Add something you love, then come back here to arrange delivery.</p><a href="index.html">Continue shopping</a></div>`;
    return;
  }
  const total=cart.reduce((sum,i)=>sum+Number(i.price||0)*Number(i.qty||1),0);
  const qty=cart.reduce((sum,i)=>sum+Number(i.qty||1),0);
  $("#itemCount").textContent=`${qty} ${qty===1?"item":"items"}`;
  $("#subtotal").textContent=money(total);
  $("#grandTotal").textContent=money(total);
  $("#whishAmount").textContent=money(total);
  $("#summaryList").innerHTML=cart.map(i=>`<div class="summary-item"><img class="summary-thumb" src="${esc(i.image_url||i.image||'assets/img/hadi-mobile-icon.jpg')}" alt=""><div><strong>${esc(i.name)}</strong><small>${i.phone_model?esc(i.phone_model)+" · ":""}${i.color_name?esc(i.color_name)+" · ":""}Qty ${Number(i.qty||1)}</small></div><div class="summary-price">${money(Number(i.price||0)*Number(i.qty||1))}</div></div>`).join("");

  const saved=(()=>{try{return JSON.parse(localStorage.getItem("hadi_delivery_details")||"{}")||{}}catch{return{}}})();
  ["fullName","phone","governorate","area","street","building","floor","landmark","note"].forEach(id=>{if(saved[id]&&$("#"+id))$("#"+id).value=saved[id]});

  document.querySelectorAll('.pay-option').forEach(label=>label.addEventListener('click',()=>{
    document.querySelectorAll('.pay-option').forEach(x=>x.classList.remove('active'));
    label.classList.add('active');
    const isWhish=label.dataset.pay==='Whish Money';
    $("#whishPanel").classList.toggle('show',isWhish);
  }));

  function details(){
    return Object.fromEntries(["fullName","phone","governorate","area","street","building","floor","landmark","note"].map(id=>[id,$("#"+id)?.value.trim()||""]));
  }
  function valid(){
    const d=details();
    const missing=[];
    if(!d.fullName)missing.push("full name");
    if(!d.phone)missing.push("phone number");
    if(!d.governorate)missing.push("governorate");
    if(!d.area)missing.push("city / area");
    if(!d.street)missing.push("street");
    if(!d.building)missing.push("building");
    if(missing.length){toast(`Please add ${missing[0]}.`);document.querySelector('#deliveryForm :invalid')?.focus();return false;}
    const pay=document.querySelector('input[name="payment"]:checked')?.value||"Cash on Delivery";
    if(pay==='Whish Money'&&!$("#whishPaid").checked){toast("Confirm the Whish transfer first.");return false;}
    return true;
  }

  $("#confirmOrder").addEventListener('click',()=>{
    if(!valid())return;
    const d=details();
    localStorage.setItem("hadi_delivery_details",JSON.stringify(d));
    const pay=document.querySelector('input[name="payment"]:checked')?.value||"Cash on Delivery";
    const lines=cart.map((i,n)=>`${n+1}. ${i.name}${i.phone_model?` — ${i.phone_model}`:""}${i.color_name?` — ${i.color_name}`:""} × ${Number(i.qty||1)} — ${money(Number(i.price||0)*Number(i.qty||1))}`).join("\n");
    const addr=[d.street,d.building,d.floor,d.area,d.governorate].filter(Boolean).join(", ");
    const payment=pay==='Whish Money'?`Whish Money — customer marked transfer as completed${$("#whishRef").value.trim()?`\nWhish reference: ${$("#whishRef").value.trim()}`:"\nWhish reference: not provided"}`:`Cash on Delivery`;
    const msg=`Hello HADI MOBILE 👋\n\nI'd like to confirm this order:\n\n${lines}\n\nSubtotal: ${money(total)}\nDelivery fee: to be confirmed by HADI MOBILE\n\nDELIVERY DETAILS\nName: ${d.fullName}\nPhone: ${d.phone}\nAddress: ${addr}${d.landmark?`\nLandmark: ${d.landmark}`:""}${d.note?`\nNote: ${d.note}`:""}\n\nPAYMENT\n${payment}\n\nPlease confirm availability, delivery fee, and final order total.`;
    window.open(`https://wa.me/${CFG.WHATSAPP_NUMBER||"96176150404"}?text=${encodeURIComponent(msg)}`,"_blank");
  });
})();
