import React,{useState,useEffect} from 'react'
import {createRoot} from 'react-dom/client'
import {createClient} from '@supabase/supabase-js'

const supabase=createClient('https://illosocrmbioyefvqjae.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsbG9zb2NybWJpb3llZnZxamFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc1NTc1MzIsImV4cCI6MjA1MzEzMzUzMn0.Tt3Fd7imyaPKyOBNpLDiHgWh5xY7NPSkvDgaWr3c0Yk')

function App(){
const[convs,setConvs]=useState([])
const[stats,setStats]=useState({clients:0,messages:0,today:0})
const[selected,setSelected]=useState(null)
const[loading,setLoading]=useState(true)
const[tab,setTab]=useState('all')

const loadData=async()=>{
setLoading(true)
const{data}=await supabase.from('conversations').select('*').order('updated_at',{ascending:false})
if(data){
setConvs(data)
const totalMsgs=data.reduce((a,c)=>a+(c.messages?.length||0),0)
const today=data.filter(c=>new Date(c.updated_at).toDateString()===new Date().toDateString()).length
setStats({clients:data.length,messages:totalMsgs,today})
}
setLoading(false)
}

useEffect(()=>{
loadData()
const channel=supabase.channel('changes').on('postgres_changes',{event:'*',schema:'public',table:'conversations'},()=>loadData()).subscribe()
return()=>supabase.removeChannel(channel)
},[])

const formatPhone=(p)=>p?.replace('whatsapp:','').replace(/(\+33)(\d)(\d{2})(\d{2})(\d{2})(\d{2})/,'$1 $2 $3 $4 $5 $6')||'Inconnu'
const formatTime=(t)=>{
const d=new Date(t)
const now=new Date()
if(d.toDateString()===now.toDateString())return d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})
}
const getLastMsg=(c)=>c.messages?.[c.messages.length-1]?.content||'Pas de message'
const getBrand=(c)=>{
const brands=['Asics','Moncler','Stone Island','Golden Goose','Prada','Gucci','Nike','Adidas']
const full=c.messages?.map(m=>m.content).join(' ').toLowerCase()||''
return brands.find(b=>full.includes(b.toLowerCase()))||null
}

if(selected){
const conv=convs.find(c=>c.phone===selected)
return(
<div className="detail-view active">
<div className="detail-header">
<button className="back-btn" onClick={()=>setSelected(null)}>←</button>
<div className="detail-info">
<h2>{formatPhone(conv?.phone)}</h2>
<p>{conv?.messages?.length||0} messages • {formatTime(conv?.updated_at)}</p>
</div>
</div>
<div className="messages">
{conv?.messages?.map((m,i)=>(
<div key={i} className={`msg ${m.role}`}>
{m.content}
<div className="msg-time">{m.role==='user'?'Client':'Selezione IA'}</div>
</div>
))}
</div>
</div>
)
}

return(
<>
<div className="header">
<h1>�� Selezione Dashboard</h1>
<p>Agent WhatsApp Intelligent</p>
</div>
<div className="stats">
<div className="stat"><div className="stat-value">{stats.clients}</div><div className="stat-label">Clients</div></div>
<div className="stat"><div className="stat-value">{stats.messages}</div><div className="stat-label">Messages</div></div>
<div className="stat"><div className="stat-value">{stats.today}</div><div className="stat-label">Aujourd'hui</div></div>
</div>
<div className="tabs">
<button className={`tab ${tab==='all'?'active':''}`} onClick={()=>setTab('all')}>Tous</button>
<button className={`tab ${tab==='today'?'active':''}`} onClick={()=>setTab('today')}>Aujourd'hui</button>
<button className={`tab ${tab==='brands'?'active':''}`} onClick={()=>setTab('brands')}>Marques</button>
</div>
{loading?<div className="loader"></div>:
<div className="conversations">
{convs.filter(c=>{
if(tab==='today')return new Date(c.updated_at).toDateString()===new Date().toDateString()
if(tab==='brands')return getBrand(c)
return true
}).map(c=>(
<div key={c.phone} className="conv-card" onClick={()=>setSelected(c.phone)}>
<div className="conv-header">
<span className="conv-phone">{formatPhone(c.phone)}</span>
<span className="conv-time">{formatTime(c.updated_at)}</span>
</div>
<div className="conv-preview">{getLastMsg(c)}</div>
<div className="conv-meta">
<span className="conv-tag">💬 {c.messages?.length||0}</span>
{getBrand(c)&&<span className="conv-tag">🏷️ {getBrand(c)}</span>}
</div>
</div>
))}
{convs.length===0&&<div className="empty"><div className="empty-icon">📭</div><p>Aucune conversation</p></div>}
</div>
}
<button className="refresh-btn" onClick={loadData}>🔄</button>
</>
)
}

createRoot(document.getElementById('app')).render(<App/>)
