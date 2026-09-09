const CFG=window.HADI_CONFIG;
const msg=document.getElementById("message");
if(!CFG.SUPABASE_URL || CFG.SUPABASE_URL.startsWith("YOUR_")){
  msg.textContent="Supabase is not configured yet. Follow SETUP.md first.";
}
const sb=(!CFG.SUPABASE_URL.startsWith("YOUR_"))?window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY):null;
(async()=>{ if(!sb)return; const {data}=await sb.auth.getSession(); if(data.session) location.href="index.html"; })();
document.getElementById("loginForm").addEventListener("submit",async e=>{
  e.preventDefault(); if(!sb)return;
  msg.textContent="Signing in...";
  const {error}=await sb.auth.signInWithPassword({email:document.getElementById("email").value.trim(),password:document.getElementById("password").value});
  if(error){msg.textContent=error.message;return;}
  location.href="index.html";
});