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

      localStorage.removeItem("hadi_cart");
      const code=data?.order_code||data?.code||"received";
      root.innerHTML=`<div class="card empty-cart" style="max-width:620px;margin:30px auto;text-align:center"><div style="font-size:2.4rem">✓</div><div class="eyebrow" style="margin-top:8px">ORDER RECEIVED</div><h2 style="font-size:1.5rem">Thank you, ${esc(d.fullName)}.</h2><p>Your order <strong>${esc(code)}</strong> has been received by HADI MOBILE.</p><p>${pay==='Whish Money'?"Your Whish payment will be verified before the order is finalized.":"You selected Cash on Delivery."}</p><p>We’ll contact you if anything is needed and to confirm the delivery fee.</p><a href="index.html">Back to shop</a></div>`;
      window.scrollTo({top:0,behavior:"smooth"});
    }catch(err){
      console.error(err);
      toast("We couldn't place the order. Please try again.");
      btn.disabled=false;
      btn.textContent=original;
    }
  }

  $("#confirmOrder").addEventListener('click',placeOrder);
  updateButtonState();
})();
