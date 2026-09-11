(()=>{
  const CFG=window.HADI_CONFIG||{};
  const CURRENCY=CFG.CURRENCY||"USD";
  const $=s=>document.querySelector(s);
  const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:CURRENCY,maximumFractionDigits:2}).format(Number(n||0));
  const esc=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  let cart=[];
  try{cart=JSON.parse(localStorage.getItem("hadi_cart")||"[]")||[];}catch{cart=[];}
  const root=$("#checkoutRoot");
  const toast=msg=>{const t=$("#toast");if(!t)return;t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400)};

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
    const radio=label.querySelector('input[name="payment"]');
    if(radio)radio.checked=true;
    const isWhish=label.dataset.pay==='Whish Money';
    $("#whishPanel").classList.toggle('show',isWhish);
    updateButtonState();
  }));

  $("#whishPaid")?.addEventListener("change",updateButtonState);

  function details(){
    return Object.fromEntries(["fullName","phone","governorate","area","street","building","floor","landmark","note"].map(id=>[id,$("#"+id)?.value.trim()||""]));
  }


  function normalizeWhatsAppNumber(value){
    let n=String(value||"").replace(/\D/g,"");
    if(n.startsWith("00"))n=n.slice(2);
    if(n.startsWith("0"))n="961"+n.slice(1);
    return n;
  }

  function buildWhatsAppOrderMessage(code,d,pay){
    const lines=[
      `🛍️ *HADI MOBILE ORDER*`,
      `Order: *${code}*`,
      ``,
      `👤 *Customer*`,
      `${d.fullName}`,
      `📱 ${d.phone}`,
      ``,
      `📦 *Items*`
    ];
    cart.forEach((i,index)=>{
      lines.push(`${index+1}. ${i.name} ×${Number(i.qty||1)} — ${money(Number(i.price||0)*Number(i.qty||1))}`);
      if(i.phone_model)lines.push(`   Model: ${i.phone_model}`);
      if(i.color_name)lines.push(`   Color: ${i.color_name}`);
    });
    lines.push(``,`💰 *Subtotal:* ${money(total)}`);
    lines.push(`💳 *Payment:* ${pay}`);
    if(pay==='Whish Money'){
      lines.push(`✅ Customer confirmed Whish payment`);
      const ref=$("#whishRef")?.value.trim();
      if(ref)lines.push(`Reference: ${ref}`);
      lines.push(`⚠️ Payment pending HADI MOBILE verification`);
    }
    lines.push(``,`📍 *Delivery address*`,`Governorate: ${d.governorate}`,`Area: ${d.area}`,`Street: ${d.street}`,`Building: ${d.building}`);
    if(d.floor)lines.push(`Floor / Apartment: ${d.floor}`);
    if(d.landmark)lines.push(`Landmark: ${d.landmark}`);
    if(d.note)lines.push(`Delivery note: ${d.note}`);
    lines.push(``,`🚚 Delivery fee to be confirmed by HADI MOBILE.`);
    return lines.join("\n");
  }

  function updateButtonState(){
    const pay=document.querySelector('input[name="payment"]:checked')?.value||"Cash on Delivery";
    const btn=$("#confirmOrder");
    if(!btn)return;
    btn.textContent=pay==='Whish Money' ? 'Place paid order' : 'Place order';
  }

  function valid(){
    const d=details();
    const checks=[
      ["fullName","full name"],["phone","phone number"],["governorate","governorate"],
      ["area","city / area"],["street","street"],["building","building"]
    ];
    for(const [key,label] of checks){
      if(!d[key]){toast(`Please add ${label}.`);$("#"+key)?.focus();return false;}
    }
    const pay=document.querySelector('input[name="payment"]:checked')?.value||"Cash on Delivery";
    if(pay==='Whish Money'&&!$("#whishPaid").checked){toast("Complete the Whish payment and confirm it first.");return false;}
    return true;
  }

  async function placeOrder(){
    if(!valid())return;
    const btn=$("#confirmOrder");
    const d=details();
    localStorage.setItem("hadi_delivery_details",JSON.stringify(d));
    const pay=document.querySelector('input[name="payment"]:checked')?.value||"Cash on Delivery";

    if(!CFG.SUPABASE_URL||!CFG.SUPABASE_ANON_KEY){
      toast("Checkout is not connected yet. Please check the website configuration.");
      return;
    }

    // Open a blank customer-initiated tab now so iPhone/Safari does not block WhatsApp after the async save.
    let waWindow=null;
    try{waWindow=window.open("about:blank","_blank");}catch{}

    btn.disabled=true;
    const original=btn.textContent;
    btn.textContent="Placing order…";

    const order={
      full_name:d.fullName,
      phone:d.phone,
      governorate:d.governorate,
      area:d.area,
      street:d.street,
      building:d.building,
      floor:d.floor||null,
      landmark:d.landmark||null,
      note:d.note||null,
      payment_method:pay,
      whish_reference:pay==='Whish Money'?($("#whishRef")?.value.trim()||null):null,
      whish_paid_confirmed:pay==='Whish Money',
      subtotal:Number(total.toFixed(2))
    };

    const items=cart.map(i=>({
      product_id:i.id||null,
      product_name:i.name,
      phone_model:i.phone_model||null,
      color_name:i.color_name||null,
      unit_price:Number(i.price||0),
      quantity:Number(i.qty||1),
      image_url:i.image_url||null
    }));

    try{
      const res=await fetch(`${CFG.SUPABASE_URL}/rest/v1/rpc/place_hadi_order`,{
        method:"POST",
        headers:{
          "apikey":CFG.SUPABASE_ANON_KEY,
          "Authorization":`Bearer ${CFG.SUPABASE_ANON_KEY}`,
          "Content-Type":"application/json"
        },
        body:JSON.stringify({p_order:order,p_items:items})
      });
      const raw=await res.text();
      let data={};
      try{data=raw?JSON.parse(raw):{};}catch{}
      if(!res.ok)throw new Error(data?.message||data?.error||raw||"Could not place order");

      const code=data?.order_code||data?.code||"received";
      const hadiNumber=normalizeWhatsAppNumber(CFG.WHATSAPP_NUMBER||"96176150404");
      const waText=buildWhatsAppOrderMessage(code,d,pay);
      const waUrl=`https://wa.me/${hadiNumber}?text=${encodeURIComponent(waText)}`;
      localStorage.removeItem("hadi_cart");

      if(waWindow){
        try{waWindow.location.href=waUrl;}catch{}
      }

      root.innerHTML=`<div class="card empty-cart" style="max-width:650px;margin:30px auto;text-align:center"><div style="font-size:2.4rem">✓</div><div class="eyebrow" style="margin-top:8px">ORDER RECEIVED</div><h2 style="font-size:1.5rem">Thank you, ${esc(d.fullName)}.</h2><p>Your order <strong>${esc(code)}</strong> is saved in HADI MOBILE Admin.</p><p>${pay==='Whish Money'?"Your Whish payment is marked as customer-confirmed and will be verified by HADI MOBILE.":"You selected Cash on Delivery."}</p><p>WhatsApp has been prepared with your full order and delivery details. <strong>Tap Send in WhatsApp</strong> so HADI MOBILE also receives the confirmation directly from you.</p><a href="${waUrl}" target="_blank" rel="noopener" style="display:inline-block;margin:10px 6px 0;background:#20c96b">Send order on WhatsApp</a><a href="index.html" style="margin-left:6px">Back to shop</a></div>`;
      window.scrollTo({top:0,behavior:"smooth"});
    }catch(err){
      try{if(waWindow&&!waWindow.closed)waWindow.close();}catch{}
      console.error(err);
      toast("We couldn't place the order. Please try again.");
      btn.disabled=false;
      btn.textContent=original;
    }
  }

  $("#confirmOrder").addEventListener('click',placeOrder);
  updateButtonState();
})();
