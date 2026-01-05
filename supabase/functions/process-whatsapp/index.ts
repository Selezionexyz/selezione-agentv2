import{serve}from"https://deno.land/std@0.168.0/http/server.ts";
import{createClient}from"https://esm.sh/@supabase/supabase-js@2";
const supabase=createClient(Deno.env.get("SUPABASE_URL"),Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
const OWNER_PHONE="whatsapp:+33783732190";
const TWILIO_PHONE="whatsapp:+14155238886";
const SITES=["antonioli.eu","luisaviaroma.com","deliberti.it","giglio.com","baseblu.com","julian-fashion.com","nugnes1920.com","sugar.it"];
async function sendOwnerNotif(clientPhone:string,message:string){
try{
const accountSid=Deno.env.get("TWILIO_ACCOUNT_SID");
const authToken=Deno.env.get("TWILIO_AUTH_TOKEN");
const auth=btoa(accountSid+":"+authToken);
await fetch("https://api.twilio.com/2010-04-01/Accounts/"+accountSid+"/Messages.json",{
method:"POST",
headers:{"Authorization":"Basic "+auth,"Content-Type":"application/x-www-form-urlencoded"},
body:"From="+encodeURIComponent(TWILIO_PHONE)+"&To="+encodeURIComponent(OWNER_PHONE)+"&Body="+encodeURIComponent("🔔 SELEZIONE\nNouveau message de "+clientPhone+":\n\n"+message)
});
}catch(e){console.log("Notif error",e);}
}
async function searchGoogle(q){
const r=await fetch("https://google.serper.dev/search",{method:"POST",headers:{"X-API-KEY":Deno.env.get("SERPER_API_KEY"),"Content-Type":"application/json"},body:JSON.stringify({q,gl:"it",hl:"fr",num:5})});
const d=await r.json();
return(d.organic||[]).slice(0,3);
}
async function scrape(url){
try{
const r=await fetch("https://api.firecrawl.dev/v1/scrape",{method:"POST",headers:{"Authorization":"Bearer "+Deno.env.get("FIRECRAWL_API_KEY"),"Content-Type":"application/json"},body:JSON.stringify({url,formats:["markdown"]})});
const d=await r.json();
return d.success?(d.data?.markdown||"").substring(0,2000):"";
}catch(e){return"";}
}
async function getHist(p){const{data}=await supabase.from("chat_history").select("messages").eq("phone",p).single();return data?.messages||[];}
async function saveHist(p,m){await supabase.from("chat_history").upsert({phone:p,messages:m.slice(-20),updated_at:new Date().toISOString()},{onConflict:"phone"});}
async function smartSearch(brand,product){
let allData="PRODUITS TROUVES:\n";
const searches=await Promise.all(SITES.slice(0,5).map(s=>searchGoogle(brand+" "+product+" site:"+s+" EUR")));
const allResults=searches.flat();
let scraped=0;
for(const r of allResults){
if(scraped>=3)break;
if(r.title&&r.link){
allData+="\n- "+r.title+" | "+r.snippet;
const page=await scrape(r.link);
if(page.length>100){allData+="\nPRIX ET DETAILS:\n"+page.substring(0,1500);scraped++;}
}
}
return allData.length>100?allData:"Aucun resultat trouve";
}
serve(async(req)=>{
try{
const fd=await req.formData();
const from=fd.get("From")?.toString()||"";
const msg=fd.get("Body")?.toString()||"";
if(from!==OWNER_PHONE){await sendOwnerNotif(from,msg);}
const{data:brands}=await supabase.from("brands").select("name").eq("is_active",true);
const bl=brands?.map(b=>b.name)||[];
const hist=await getHist(from);
hist.push({role:"user",content:msg});
const full=hist.map(m=>m.content).join(" ").toLowerCase();
let brand="";
for(const b of bl){if(full.includes(b.toLowerCase())){brand=b;break;}}
let sd="";
if(brand&&msg.length>2){sd=await smartSearch(brand,msg);}
const sys="Tu es Selezione, expert sourcing luxe B2B italien. MARQUES:"+bl.join(",")+". CONDITIONS:5000EUR min,livraison mondiale,paiement immediat.\n\n"+sd+"\n\nREGLES:\n1)JAMAIS reveler fournisseurs-dis'nos sources italiennes'\n2)Donne les VRAIS prix trouves\n3)Francais,pro,chaleureux\n4)3-5 phrases max";
const cr=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":Deno.env.get("ANTHROPIC_API_KEY"),"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1024,system:sys,messages:hist.map(m=>({role:m.role==="user"?"user":"assistant",content:m.content}))})});
const cd=await cr.json();
const reply=cd.content?.[0]?.text||"Erreur";
hist.push({role:"assistant",content:reply});
await saveHist(from,hist);
return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Message>'+reply+'</Message></Response>',{headers:{"Content-Type":"text/xml"}});
}catch(e){
return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Message>Erreur, reessayez.</Message></Response>',{headers:{"Content-Type":"text/xml"}});
}
});
