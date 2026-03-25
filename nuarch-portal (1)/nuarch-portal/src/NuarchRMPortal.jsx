import { useState, useEffect, useMemo, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";

// ════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUAKPgjmE0gbc2oO4jC7P9-5G8sie2w39Xgqfcl7zdrzapemk4-4mJBEP-jEP03oiY7AGEJTQ_Gqqd/pub?output=csv";

const MONTH_ORDER = ["Apr-2024","May-2024","Jun-2024","Jul-2024","Aug-2024","Sep-2024","Oct-2024","Nov-2024","Dec-2024","Jan-2025","Feb-2025","Mar-2025","Apr-2025","May-2025","Jun-2025","Jul-2025","Aug-2025","Sep-2025","Oct-2025","Nov-2025","Dec-2025","Jan-2026","Feb-2026","Mar-2026"];

// Code → keyword in RM name (case-insensitive match)
const RM_CODE_KEYS = { ABHIJEET:"abhijeet", ADITYA:"aditya", GANESH:"ganesh", KIRAN:"kiran", PRATHAP:"prathap", CHAKRI:"chakri", UDAY:"uday" };
const RM_INITIALS_MAP = { ABHIJEET:"AS", ADITYA:"AP", GANESH:"GN", KIRAN:"KJ", PRATHAP:"SP", CHAKRI:"SC", UDAY:"UK", ADMIN:"AD" };

const CAT_COLORS = { "Mutual Fund":"#00d4aa", PMS:"#a78bfa", AIF:"#f5a623", "Fixed Income":"#60a5fa", Insurance:"#f472b6", Alternate:"#fb923c", SIF:"#34d399" };
const CAT_EMOJI  = { "Mutual Fund":"📈", PMS:"💼", AIF:"🏦", "Fixed Income":"📊", Insurance:"🛡️", Alternate:"🔄", SIF:"📋" };
const RM_COLORS  = ["#00d4aa","#a78bfa","#f5a623","#60a5fa","#f472b6","#fb923c","#34d399","#818cf8"];

// ════════════════════════════════════════════════════════════
// THEME
// ════════════════════════════════════════════════════════════
const TH = {
  dark:  { bg:"#060d18", bg2:"#0a1628", bg3:"#0f1f35", bg4:"#162844", bg5:"#1c3354", border:"rgba(255,255,255,0.05)", border2:"rgba(255,255,255,0.10)", border3:"rgba(255,255,255,0.18)", text:"#e2eaf4", dim:"#5a7a9a", faint:"#2a4a6a", header:"rgba(6,13,24,0.94)", ttBg:"#0a1628", ttBorder:"rgba(255,255,255,0.10)", ttTitle:"#e2eaf4", ttBody:"#8aaccc", grid:"rgba(255,255,255,0.03)" },
  light: { bg:"#f0f4f8", bg2:"#ffffff", bg3:"#f8fafc", bg4:"#e8eef5", bg5:"#dde6f0", border:"rgba(0,0,0,0.06)", border2:"rgba(0,0,0,0.11)", border3:"rgba(0,0,0,0.20)", text:"#0d1f35", dim:"#4a6278", faint:"#8ba3bb", header:"rgba(240,244,248,0.95)", ttBg:"#ffffff", ttBorder:"rgba(0,0,0,0.10)", ttTitle:"#0d1f35", ttBody:"#4a6278", grid:"rgba(0,0,0,0.05)" }
};

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════
const pN = s => { if (!s || s==="-"||s==="") return 0; return parseFloat(String(s).replace(/,/g,""))||0; };
const mIdx = m => { const i=MONTH_ORDER.indexOf(m); return i===-1?999:i; };
const sortM = (a,b) => mIdx(a)-mIdx(b);

const parseCSV = txt => {
  const lines = txt.split("\n").filter(l=>l.trim());
  if (!lines.length) return [];
  const hdrs = lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,""));
  return lines.slice(1).map(line=>{
    const flds=[]; let cur=""; let inQ=false;
    for(let i=0;i<line.length;i++){
      if(line[i]==='"'){inQ=!inQ;}
      else if(line[i]===','&&!inQ){flds.push(cur.trim());cur="";}
      else cur+=line[i];
    }
    flds.push(cur.trim());
    const obj={}; hdrs.forEach((h,i)=>{obj[h]=flds[i]||"";});
    return obj;
  }).filter(r=>r["RM Name"]?.trim()&&r["Client Name"]?.trim());
};

const fmt    = v => { if(!v||isNaN(v))return "₹0"; if(v>=1e7)return "₹"+(v/1e7).toFixed(2)+"Cr"; if(v>=1e5)return "₹"+(v/1e5).toFixed(2)+"L"; if(v>=1e3)return "₹"+(v/1e3).toFixed(1)+"K"; return "₹"+Math.round(v).toLocaleString("en-IN"); };
const fmtF   = v => "₹"+Math.round(v||0).toLocaleString("en-IN");
const fmtAUM = v => (!v||isNaN(v)||v===0)?"—":v>=1e7?"₹"+(v/1e7).toFixed(2)+" Cr":v>=1e5?"₹"+(v/1e5).toFixed(2)+" L":fmt(v);
const fmtY   = y => (y>0&&y<2000)?y.toFixed(2)+"%":"—";
const pct    = (v,t) => t?((v/t)*100).toFixed(1):"0.0";
const getInit = name => { if(!name)return"--"; const p=name.split(" "); return p.length>=2?(p[0][0]+p[p.length-1][0]).toUpperCase():name.slice(0,2).toUpperCase(); };

// ════════════════════════════════════════════════════════════
// DATA PROCESSING
// ════════════════════════════════════════════════════════════
const processData = rows => {
  if(!rows.length) return { data:{}, rmByCode:{} };
  const data={}, rmByCode={};

  // Build rmByCode: code → rmName (fuzzy match from real RM names)
  const rmNames=[...new Set(rows.map(r=>r["RM Name"]?.trim()).filter(Boolean))];
  rmNames.forEach(rm=>{
    Object.entries(RM_CODE_KEYS).forEach(([code,key])=>{
      if(rm.toLowerCase().includes(key)) rmByCode[code]=rm;
    });
  });

  rmNames.forEach(rm=>{
    const rmR=rows.filter(r=>r["RM Name"]?.trim()===rm);
    const months=[...new Set(rmR.map(r=>r["Month"]?.trim()).filter(Boolean))].sort(sortM);
    data[rm]={ months_present:months, months:{} };

    months.forEach((month,mi)=>{
      const mR=rmR.filter(r=>r["Month"]?.trim()===month);
      const totIR  =mR.reduce((s,r)=>s+pN(r["IR Generated"]),0);
      const totPay =mR.reduce((s,r)=>s+pN(r["Partner Payout"]),0);
      const totAUM =mR.reduce((s,r)=>s+pN(r["Average AUM"]),0);
      const totY   =totAUM>0?((totIR/totAUM)*100)*12:0;
      const prevIR =mi>0?(data[rm].months[months[mi-1]]?.ir||0):0;
      const growth =prevIR>0?((totIR-prevIR)/prevIR)*100:0;
      const absChg =prevIR>0?totIR-prevIR:0;

      // ── Products → SFCs → Clients → Schemes ──────────────
      const cats=[...new Set(mR.map(r=>r["Catageory"]?.trim()).filter(Boolean))];
      const products={};
      cats.forEach(cat=>{
        const cR=mR.filter(r=>r["Catageory"]?.trim()===cat);
        const cIR=cR.reduce((s,r)=>s+pN(r["IR Generated"]),0);
        const cPay=cR.reduce((s,r)=>s+pN(r["Partner Payout"]),0);
        const cAUM=cR.reduce((s,r)=>s+pN(r["Average AUM"]),0);
        const cY  =cAUM>0?((cIR/cAUM)*100)*12:0;

        const sfcCodes=[...new Set(cR.map(r=>r["SFC Code"]?.trim()).filter(Boolean))];
        const sfcs={};
        sfcCodes.forEach(sfc=>{
          const sR=cR.filter(r=>r["SFC Code"]?.trim()===sfc);
          const sIR=sR.reduce((s,r)=>s+pN(r["IR Generated"]),0);
          const sPay=sR.reduce((s,r)=>s+pN(r["Partner Payout"]),0);
          const sAUM=sR.reduce((s,r)=>s+pN(r["Average AUM"]),0);
          const sY  =sAUM>0?((sIR/sAUM)*100)*12:0;

          const clNames=[...new Set(sR.map(r=>r["Client Name"]?.trim()).filter(Boolean))];
          const clients={};
          clNames.forEach(cl=>{
            const clR=sR.filter(r=>r["Client Name"]?.trim()===cl);
            const clIR =clR.reduce((s,r)=>s+pN(r["IR Generated"]),0);
            const clPay=clR.reduce((s,r)=>s+pN(r["Partner Payout"]),0);
            const clAUM=clR.reduce((s,r)=>s+pN(r["Average AUM"]),0);
            const clY  =clAUM>0?((clIR/clAUM)*100)*12:0;
            const schMap={};
            clR.forEach(r=>{
              const k=(r["Scheme Name"]||"Unknown")+"|||"+(r["AMC Name"]||"");
              if(!schMap[k]) schMap[k]={name:r["Scheme Name"]||"Unknown",amc:r["AMC Name"]||"",irType:r["IR Type"]||"",cat,ir:0,payout:0,anchorPay:0,aum:0};
              schMap[k].ir       +=pN(r["IR Generated"]);
              schMap[k].payout   +=pN(r["Partner Payout"]);
              schMap[k].anchorPay+=pN(r["Anchor Partner Payout"]);
              schMap[k].aum      +=pN(r["Average AUM"]);
            });
            clients[cl]={ ir:clIR, payout:clPay, aum:clAUM, yield:clY,
              schemes:Object.values(schMap).map(s=>({...s,yield:s.aum>0?((s.ir/s.aum)*100)*12:0})).sort((a,b)=>b.ir-a.ir) };
          });
          sfcs[sfc]={ ir:sIR, payout:sPay, aum:sAUM, yield:sY, clients:clNames.length, clients_data:clients };
        });
        products[cat]={ ir:cIR, payout:cPay, aum:cAUM, yield:cY, sfcs };
      });

      // ── All SFCs (Partner Ranking) ────────────────────────
      const allSFCs=[...new Set(mR.map(r=>r["SFC Code"]?.trim()).filter(Boolean))];
      const sfcs={};
      allSFCs.forEach(sfc=>{
        const sR=mR.filter(r=>r["SFC Code"]?.trim()===sfc);
        const sIR=sR.reduce((s,r)=>s+pN(r["IR Generated"]),0);
        const sPay=sR.reduce((s,r)=>s+pN(r["Partner Payout"]),0);
        const sAUM=sR.reduce((s,r)=>s+pN(r["Average AUM"]),0);
        const prods={};
        cats.forEach(c=>{const p=sR.filter(r=>r["Catageory"]?.trim()===c);if(p.length)prods[c]={ir:p.reduce((s,r)=>s+pN(r["IR Generated"]),0)};});
        sfcs[sfc]={ ir:sIR, payout:sPay, aum:sAUM, yield:sAUM>0?((sIR/sAUM)*100)*12:0,
          clients:[...new Set(sR.map(r=>r["Client Name"]?.trim()).filter(Boolean))].length, products:prods };
      });

      // ── All Clients (Client Ranking) ──────────────────────
      const allCl=[...new Set(mR.map(r=>r["Client Name"]?.trim()).filter(Boolean))];
      const clients={};
      allCl.forEach(cl=>{
        const clR=mR.filter(r=>r["Client Name"]?.trim()===cl);
        const clIR=clR.reduce((s,r)=>s+pN(r["IR Generated"]),0);
        const clPay=clR.reduce((s,r)=>s+pN(r["Partner Payout"]),0);
        const clAUM=clR.reduce((s,r)=>s+pN(r["Average AUM"]),0);
        clients[cl]={ ir:clIR, payout:clPay, aum:clAUM, yield:clAUM>0?((clIR/clAUM)*100)*12:0,
          sfc:clR[0]?.["SFC Code"]||"", cat:clR[0]?.["Catageory"]||"", schemes:clR.length };
      });

      // ── All Schemes (Scheme Flow) ─────────────────────────
      const schMap={};
      mR.forEach(r=>{
        const k=(r["Scheme Name"]||"Unknown")+"||"+(r["AMC Name"]||"");
        if(!schMap[k]) schMap[k]={name:r["Scheme Name"]||"Unknown",amc:r["AMC Name"]||"",cat:r["Catageory"]||"",irType:r["IR Type"]||"",ir:0,payout:0,anchorPay:0,aum:0};
        schMap[k].ir       +=pN(r["IR Generated"]);
        schMap[k].payout   +=pN(r["Partner Payout"]);
        schMap[k].anchorPay+=pN(r["Anchor Partner Payout"]);
        schMap[k].aum      +=pN(r["Average AUM"]);
      });

      data[rm].months[month]={ ir:totIR, payout:totPay, aum:totAUM, yield:totY, growth, abs_change:absChg,
        products, sfcs, clients,
        schemes:Object.values(schMap).map(s=>({...s,yield:s.aum>0?((s.ir/s.aum)*100)*12:0})).sort((a,b)=>b.ir-a.ir) };
    });
  });
  return { data, rmByCode };
};

// ════════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ════════════════════════════════════════════════════════════
const YChip = ({y,t}) => {
  if(!y||y<=0||y>=2000) return <span style={{fontSize:10,color:t.dim}}>—</span>;
  const col=y>=1.5?"#10b981":y>=0.5?"#00d4aa":t.dim;
  const bg =y>=1.5?"rgba(16,185,129,0.12)":y>=0.5?"rgba(0,212,170,0.10)":t.bg3;
  return <span style={{background:bg,color:col,padding:"2px 9px",borderRadius:20,fontSize:10,fontWeight:700,fontFamily:"JetBrains Mono,monospace",border:`1px solid ${col}33`}}>{y.toFixed(2)}%</span>;
};

const MiniBar = ({v,max,color="#00d4aa"}) => {
  const w=max>0?Math.min(100,(v/max)*100):0;
  return <div style={{width:60,height:4,background:"rgba(255,255,255,0.08)",borderRadius:4,overflow:"hidden"}}>
    <div style={{width:w+"%",height:"100%",background:color,borderRadius:4,transition:"width 0.4s ease"}}/>
  </div>;
};

const GrowthBadge = ({g}) => {
  if(g===0) return <span style={{fontSize:10,color:"#5a7a9a"}}>—</span>;
  const up=g>0; const col=up?"#10b981":"#ff6b6b";
  return <span style={{color:col,fontSize:10,fontWeight:700,fontFamily:"JetBrains Mono,monospace"}}>{up?"▲":"▼"} {Math.abs(g).toFixed(1)}%</span>;
};

const TblHeader = ({cols}) => <thead><tr>{cols.map((c,i)=><th key={i} style={{padding:"10px 14px",textAlign:"left",fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"#5a7a9a",whiteSpace:"nowrap",background:"inherit",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>{c}</th>)}</tr></thead>;

const CTooltip = ({active,payload,label,t}) => {
  if(!active||!payload?.length) return null;
  return <div style={{background:t.ttBg,border:`1px solid ${t.ttBorder}`,borderRadius:10,padding:"10px 14px",fontSize:11}}>
    <div style={{color:t.ttTitle,fontWeight:700,marginBottom:6,fontSize:12}}>{label}</div>
    {payload.map((p,i)=><div key={i} style={{color:t.ttBody,display:"flex",gap:6,alignItems:"center",marginBottom:2}}>
      <div style={{width:7,height:7,borderRadius:"50%",background:p.color||p.fill,flexShrink:0}}/>
      <span>{p.name}: </span><span style={{color:p.color||p.fill,fontWeight:600}}>{fmt(p.value)}</span>
    </div>)}
  </div>;
};

const Section = ({children,t}) => <div style={{background:t.bg2,border:`1px solid ${t.border}`,borderRadius:14,overflow:"hidden",marginBottom:20}}>{children}</div>;

const DMetaBox = ({label,val,col,t}) => <div style={{background:t.bg3,border:`1px solid ${t.border2}`,borderRadius:10,padding:"10px 15px",flex:"0 0 auto"}}>
  <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:t.dim,marginBottom:4}}>{label}</div>
  <div style={{fontFamily:"Syne,sans-serif",fontSize:15,fontWeight:800,color:col||"#00d4aa"}}>{val}</div>
</div>;

const SearchBox = ({val,onChange,placeholder,t}) => <input value={val} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{background:t.bg3,border:`1px solid ${t.border2}`,borderRadius:8,padding:"7px 12px",color:t.text,fontSize:12,outline:"none",width:220,fontFamily:"inherit",transition:"border-color 0.2s"}} onFocus={e=>e.target.style.borderColor="#00d4aa"} onBlur={e=>e.target.style.borderColor=t.border2}/>;

const CatPill = ({label,active,onClick,t,color}) => <button onClick={onClick} style={{padding:"4px 12px",borderRadius:20,border:`1px solid ${active?(color||"#00d4aa"):t.border2}`,background:active?`${color||"#00d4aa"}20`:t.bg3,color:active?(color||"#00d4aa"):t.dim,fontSize:11,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>{label}</button>;

// ════════════════════════════════════════════════════════════
// LOGIN VIEW
// ════════════════════════════════════════════════════════════
function LoginView({theme,t,step,code,otp,genOTP,channel,codeErr,otpErr,loginCodes,setCode,setOtp,setChannel,setStep,setCodeErr,setOtpErr,onSend,onVerify,toggleTheme}) {
  const codeHints = Object.keys(loginCodes).filter(c=>c!=="ADMIN").join("  ");
  return (
    <div style={{position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:t.bg,zIndex:200}}>
      <div style={{position:"absolute",width:600,height:600,background:"radial-gradient(circle,rgba(0,212,170,0.07) 0%,transparent 65%)",borderRadius:"50%",transform:"translate(-50%,-50%)",top:"50%",left:"50%",pointerEvents:"none"}}/>
      <div style={{position:"relative",width:430}}>
        {/* Theme toggle */}
        <button onClick={toggleTheme} style={{position:"absolute",top:-10,right:0,width:34,height:34,borderRadius:9,background:t.bg3,border:`1px solid ${t.border2}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,zIndex:10}}>
          {theme==="dark"?"☀️":"🌙"}
        </button>
        <div style={{background:t.bg2,border:`1px solid ${t.border2}`,borderRadius:20,padding:"42px 40px 38px",boxShadow:"0 40px 120px rgba(0,0,0,0.6),0 0 0 1px rgba(0,212,170,0.06)"}}>
          {/* Brand */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:34}}>
            <div style={{width:40,height:40,borderRadius:11,background:"linear-gradient(135deg,#00d4aa,#0284c7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:"0 6px 20px rgba(0,212,170,0.35)"}}>🚀</div>
            <div>
              <div style={{fontFamily:"Syne,sans-serif",fontSize:17,fontWeight:700,color:t.text}}>Nuarch Fintech Pvt Ltd</div>
              <div style={{fontSize:10,color:t.dim,letterSpacing:"0.12em",textTransform:"uppercase"}}>RM Yield Portal · FY 2025-26</div>
            </div>
          </div>

          {step===1 && <>
            <div style={{fontFamily:"Syne,sans-serif",fontSize:25,fontWeight:800,color:t.text,marginBottom:5}}>Access Portal</div>
            <div style={{fontSize:13,color:t.dim,marginBottom:26,lineHeight:1.5}}>Enter your RM code to receive a secure OTP</div>
            <div style={{marginBottom:18}}>
              <label style={{display:"block",fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:t.dim,marginBottom:8}}>RM / Admin Code</label>
              <input value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setCodeErr("");}} onKeyDown={e=>e.key==="Enter"&&onSend()} placeholder="e.g. KIRAN or ADMIN" style={{width:"100%",background:t.bg3,border:`1px solid ${codeErr?t.border2+" red":t.border2}`,borderRadius:10,padding:"13px 15px",color:t.text,fontFamily:"JetBrains Mono,monospace",fontSize:14,fontWeight:500,letterSpacing:"0.06em",outline:"none"}} onFocus={e=>e.target.style.boxShadow="0 0 0 3px rgba(0,212,170,0.12)"} onBlur={e=>e.target.style.boxShadow=""}/>
              {codeErr && <div style={{fontSize:11,color:"#ff6b6b",marginTop:5}}>{codeErr}</div>}
            </div>
            <div style={{marginBottom:18}}>
              <label style={{display:"block",fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:t.dim,marginBottom:8}}>Send OTP via</label>
              <div style={{display:"flex",gap:8}}>
                {["whatsapp","telegram"].map(ch=><label key={ch} style={{flex:1,display:"flex",alignItems:"center",gap:8,background:t.bg3,border:`1px solid ${channel===ch?"#00d4aa":t.border2}`,borderRadius:10,padding:"11px 13px",cursor:"pointer",transition:"all 0.2s",background:channel===ch?"rgba(0,212,170,0.05)":t.bg3}}>
                  <input type="radio" name="ch" checked={channel===ch} onChange={()=>setChannel(ch)} style={{accentColor:"#00d4aa"}}/>
                  <span style={{fontSize:12,fontWeight:500,color:t.text}}>{ch==="whatsapp"?"💬 WhatsApp":"✈️ Telegram"}</span>
                </label>)}
              </div>
            </div>
            <button onClick={onSend} style={{width:"100%",padding:14,background:"linear-gradient(135deg,#00d4aa,#0284c7)",border:"none",borderRadius:10,color:"#fff",fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:700,letterSpacing:"0.06em",cursor:"pointer",marginTop:4}}>Send OTP →</button>
            <div style={{fontSize:10,color:t.faint,textAlign:"center",marginTop:14,lineHeight:1.8}}>
              RM Codes: {codeHints.split("  ").map(c=><code key={c} style={{color:"#00d4aa",fontFamily:"JetBrains Mono,monospace",fontSize:10,marginRight:6}}>{c}</code>)}
            </div>
            <div style={{fontSize:10,color:t.faint,textAlign:"center",marginTop:4}}>Admin: <code style={{color:"#f5a623",fontFamily:"JetBrains Mono,monospace"}}>ADMIN</code></div>
          </>}

          {step===2 && <>
            <div style={{fontFamily:"Syne,sans-serif",fontSize:25,fontWeight:800,color:t.text,marginBottom:5}}>Verify OTP</div>
            <div style={{fontSize:13,color:t.dim,marginBottom:20,lineHeight:1.5}}>OTP dispatched via {channel==="whatsapp"?"💬 WhatsApp":"✈️ Telegram"}</div>
            <div style={{background:"rgba(0,212,170,0.06)",border:"1px solid rgba(0,212,170,0.2)",borderRadius:11,padding:15,marginBottom:18,textAlign:"center"}}>
              <div style={{fontSize:11,color:t.dim,marginBottom:4}}>Demo OTP</div>
              <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:28,fontWeight:700,letterSpacing:"0.3em",color:"#00d4aa",margin:"4px 0"}}>{genOTP}</div>
              <div style={{fontSize:11,color:t.dim}}>In production, delivered to registered number only</div>
            </div>
            <div style={{marginBottom:18}}>
              <label style={{display:"block",fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:t.dim,marginBottom:8}}>Enter 6-Digit OTP</label>
              <input value={otp} onChange={e=>{setOtp(e.target.value);setOtpErr("");}} onKeyDown={e=>e.key==="Enter"&&onVerify()} placeholder="_ _ _ _ _ _" maxLength={6} style={{width:"100%",background:t.bg3,border:`1px solid ${t.border2}`,borderRadius:10,padding:"13px 15px",color:"#00d4aa",fontFamily:"JetBrains Mono,monospace",fontSize:22,fontWeight:700,letterSpacing:"0.3em",outline:"none",textAlign:"center"}}/>
              {otpErr && <div style={{fontSize:11,color:"#ff6b6b",marginTop:5}}>{otpErr}</div>}
            </div>
            <button onClick={onVerify} style={{width:"100%",padding:14,background:"linear-gradient(135deg,#00d4aa,#0284c7)",border:"none",borderRadius:10,color:"#fff",fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:700,letterSpacing:"0.06em",cursor:"pointer"}}>Verify & Enter →</button>
            <button onClick={()=>{setStep(1);setOtp("");setOtpErr("");}} style={{width:"100%",padding:12,background:"transparent",border:`1px solid ${t.border2}`,borderRadius:10,color:t.dim,fontFamily:"inherit",fontSize:12,cursor:"pointer",marginTop:8}}>← Change Code</button>
          </>}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// HEADER
// ════════════════════════════════════════════════════════════
function Header({t,theme,session,pageTitle,toggleTheme,logout}) {
  const initials=session.isAdmin?"AD":getInit(session.rmName);
  return (
    <div style={{position:"sticky",top:0,zIndex:50,background:t.header,backdropFilter:"blur(24px)",borderBottom:`1px solid ${t.border}`,height:60,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 28px"}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#00d4aa,#0284c7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,boxShadow:"0 4px 12px rgba(0,212,170,0.3)"}}>🚀</div>
          <div>
            <div style={{fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,color:t.text}}>Nuarch Fintech</div>
          </div>
        </div>
        <div style={{width:1,height:22,background:t.border2}}/>
        <div style={{fontSize:12,color:t.dim,fontWeight:500,letterSpacing:"0.04em"}}>{pageTitle}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:9,background:t.bg3,border:`1px solid ${t.border2}`,borderRadius:10,padding:"5px 12px 5px 5px"}}>
          <div style={{width:28,height:28,borderRadius:7,background:session.isAdmin?"linear-gradient(135deg,#f5a623,#fb923c)":"linear-gradient(135deg,#00d4aa,#0284c7)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Syne,sans-serif",fontSize:11,fontWeight:800,color:"#fff"}}>{initials}</div>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:t.text}}>{session.isAdmin?"Administrator":session.rmName?.split(" ")[0]}</div>
            <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:10,color:t.dim}}>{session.code}</div>
          </div>
        </div>
        <button onClick={toggleTheme} style={{width:34,height:34,borderRadius:9,background:t.bg3,border:`1px solid ${t.border2}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:t.dim,transition:"all 0.2s"}}>{theme==="dark"?"☀️":"🌙"}</button>
        <button onClick={logout} style={{width:34,height:34,borderRadius:9,background:t.bg3,border:`1px solid ${t.border2}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:t.dim,transition:"all 0.2s"}} title="Logout">🚪</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// KPI GRID
// ════════════════════════════════════════════════════════════
function KPIGrid({ir,payout,aum,yld,growth,absChg,t}) {
  const kpis=[
    {label:"IR Generated",val:fmt(ir),sub:fmtF(ir),col:"#00d4aa",grad:"linear-gradient(90deg,#00d4aa,#0284c7)"},
    {label:"Partner Payout",val:fmt(payout),sub:fmtF(payout),col:"#f5a623",grad:"linear-gradient(90deg,#f5a623,#fb923c)"},
    {label:"Avg AUM",val:fmtAUM(aum),sub:aum>0?fmtF(aum):"No AUM data",col:"#a78bfa",grad:"linear-gradient(90deg,#a78bfa,#818cf8)"},
    {label:"Yield (Ann.)",val:fmtY(yld),sub:"((IR÷AUM)×100)×12",col:"#10b981",grad:"linear-gradient(90deg,#10b981,#059669)"},
    {label:"MoM Growth",val:(growth>0?"+":"")+growth.toFixed(1)+"%",sub:"vs previous month",col:growth>=0?"#60a5fa":"#ff6b6b",grad:growth>=0?"linear-gradient(90deg,#60a5fa,#3b82f6)":"linear-gradient(90deg,#ff6b6b,#ef4444)"},
    {label:"Absolute Change",val:(absChg>=0?"+":"")+fmt(absChg),sub:"IR vs last month",col:absChg>=0?"#00d4aa":"#ff6b6b",grad:absChg>=0?"linear-gradient(90deg,#00d4aa,#059669)":"linear-gradient(90deg,#ff6b6b,#f472b6)"},
  ];
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:12,marginBottom:20}}>
      {kpis.map((k,i)=><div key={i} style={{background:t.bg2,border:`1px solid ${t.border}`,borderRadius:14,padding:18,position:"relative",overflow:"hidden",transition:"all 0.2s",cursor:"default"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:k.grad}}/>
        <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:t.dim,marginBottom:8}}>{k.label}</div>
        <div style={{fontFamily:"Syne,sans-serif",fontSize:19,fontWeight:800,color:k.col,letterSpacing:"-0.02em",marginBottom:3}}>{k.val}</div>
        <div style={{fontSize:10,color:t.dim}}>{k.sub}</div>
      </div>)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// PRODUCT TAB — Product → SFC → Client → Scheme
// ════════════════════════════════════════════════════════════
function ProductTab({md,t,rmName,month}) {
  const [selProd,setSelProd]=useState(null);
  const [selSFC,setSelSFC]=useState(null);
  const [selClient,setSelClient]=useState(null);
  const [sfcSearch,setSfcSearch]=useState("");
  const [clientSearch,setClientSearch]=useState("");

  const prods=useMemo(()=>md?Object.entries(md.products).sort((a,b)=>b[1].ir-a[1].ir):[], [md]);
  const totIR=md?.ir||0;

  const sfcEntries=useMemo(()=>{
    if(!selProd||!md) return [];
    return Object.entries(md.products[selProd]?.sfcs||{}).sort((a,b)=>b[1].ir-a[1].ir)
      .filter(([c])=>!sfcSearch||c.toLowerCase().includes(sfcSearch.toLowerCase()));
  },[selProd,md,sfcSearch]);

  const clientEntries=useMemo(()=>{
    if(!selProd||!selSFC||!md) return [];
    const sfc=md.products[selProd]?.sfcs?.[selSFC];
    return Object.entries(sfc?.clients_data||{}).sort((a,b)=>b[1].ir-a[1].ir)
      .filter(([n])=>!clientSearch||n.toLowerCase().includes(clientSearch.toLowerCase()));
  },[selProd,selSFC,md,clientSearch]);

  const clientData=selClient&&selProd&&selSFC&&md?md.products[selProd]?.sfcs?.[selSFC]?.clients_data?.[selClient]:null;

  const drillProd=(cat)=>{setSelProd(cat);setSelSFC(null);setSelClient(null);setSfcSearch("");setClientSearch("");};
  const drillSFC=(sfc)=>{setSelSFC(sfc);setSelClient(null);setClientSearch("");};

  const maxY=prods.length>0?Math.max(...prods.map(([,v])=>v.yield||0),0.001):1;

  return <div>
    {/* Product Table */}
    <div style={{marginBottom:14}}>
      <div style={{fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,color:t.text,marginBottom:4}}>Product-wise Yield Breakdown</div>
      <div style={{fontSize:11,color:t.dim,marginBottom:14}}>Click a product to drill into SFC partners → Clients → Schemes</div>
    </div>
    <Section t={t}>
      <div style={{display:"grid",gridTemplateColumns:"1.8fr 1fr 1fr 1fr 1.2fr 0.8fr",padding:"10px 18px",background:t.bg3,borderBottom:`1px solid ${t.border2}`}}>
        {["Product","IR Generated","Partner Payout","Avg AUM","Yield (Ann.)","Share"].map((h,i)=><div key={i} style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:t.dim}}>{h}</div>)}
      </div>
      {prods.map(([cat,v])=>{
        const share=pct(v.ir,totIR); const yp=maxY>0?(v.yield/maxY)*100:0; const isAct=selProd===cat; const col=CAT_COLORS[cat]||"#94a3b8";
        return <div key={cat} onClick={()=>drillProd(cat)} style={{display:"grid",gridTemplateColumns:"1.8fr 1fr 1fr 1fr 1.2fr 0.8fr",padding:"13px 18px",borderBottom:`1px solid ${t.border}`,cursor:"pointer",background:isAct?"rgba(0,212,170,0.05)":t.bg2,borderLeft:isAct?"3px solid #00d4aa":"3px solid transparent",transition:"background 0.15s",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>{CAT_EMOJI[cat]||"📦"}</span>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:t.text}}>{cat}</div>
              <div style={{fontSize:10,color:t.dim}}>{Object.keys(v.sfcs||{}).length} SFCs</div>
            </div>
          </div>
          <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600,color:"#00d4aa"}}>{fmt(v.ir)}</div>
          <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600,color:"#f5a623"}}>{fmt(v.payout)}</div>
          <div style={{fontSize:11,color:t.text}}>{v.aum>0?fmtAUM(v.aum):"—"}</div>
          <div>
            <YChip y={v.yield} t={t}/>
            <div style={{width:80,height:3,background:t.bg4,borderRadius:3,marginTop:6,overflow:"hidden"}}>
              <div style={{width:yp.toFixed(0)+"%",height:"100%",background:"linear-gradient(90deg,#10b981,#059669)",borderRadius:3}}/>
            </div>
          </div>
          <div style={{fontSize:10,color:t.dim}}>{share}%</div>
        </div>;
      })}
    </Section>

    {/* SFC Drill */}
    {selProd && <div style={{animation:"slideIn 0.25s ease"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        <button onClick={()=>{setSelProd(null);setSelSFC(null);setSelClient(null);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#00d4aa",fontWeight:600,padding:0,fontFamily:"inherit"}}>Products</button>
        <span style={{color:t.faint}}>›</span>
        <span style={{fontSize:11,color:t.dim}}>{CAT_EMOJI[selProd]||""} {selProd}</span>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap"}}>
        <DMetaBox label="IR Generated" val={fmt(md.products[selProd]?.ir||0)} col="#00d4aa" t={t}/>
        <DMetaBox label="Payout" val={fmt(md.products[selProd]?.payout||0)} col="#f5a623" t={t}/>
        <DMetaBox label="AUM" val={md.products[selProd]?.aum>0?fmtAUM(md.products[selProd].aum):"—"} col="#a78bfa" t={t}/>
        <DMetaBox label="Yield" val={fmtY(md.products[selProd]?.yield||0)} col="#10b981" t={t}/>
        <DMetaBox label="SFCs" val={String(sfcEntries.length)} col="#f472b6" t={t}/>
      </div>
      <Section t={t}>
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${t.border}`,display:"flex",gap:10}}>
          <SearchBox val={sfcSearch} onChange={setSfcSearch} placeholder="🔍 Search SFCs…" t={t}/>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <TblHeader cols={["#","SFC Code","IR Generated","Payout","AUM","Yield","Clients","Share"]}/>
            <tbody>{sfcEntries.map(([sfc,v],i)=>{
              const isAct=selSFC===sfc; const prodTotIR=md.products[selProd]?.ir||1;
              return <tr key={sfc} onClick={()=>drillSFC(sfc)} style={{cursor:"pointer",background:isAct?"rgba(0,212,170,0.06)":i%2===0?t.bg2:t.bg2}}>
                <td style={{padding:"10px 14px",fontSize:10,color:t.dim,fontFamily:"JetBrains Mono,monospace",fontWeight:700}}>{i+1}</td>
                <td style={{padding:"10px 14px"}}><span style={{background:t.bg3,padding:"2px 9px",borderRadius:5,fontFamily:"JetBrains Mono,monospace",fontSize:10,fontWeight:600,color:isAct?"#00d4aa":t.text}}>{sfc}</span></td>
                <td style={{padding:"10px 14px",color:"#00d4aa",fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600}}>{fmt(v.ir)}</td>
                <td style={{padding:"10px 14px",color:"#f5a623",fontFamily:"JetBrains Mono,monospace",fontSize:11}}>{fmt(v.payout)}</td>
                <td style={{padding:"10px 14px",fontSize:11,color:t.text}}>{v.aum>0?fmtAUM(v.aum):"—"}</td>
                <td style={{padding:"10px 14px"}}><YChip y={v.yield} t={t}/></td>
                <td style={{padding:"10px 14px",fontSize:11,color:t.dim}}>{v.clients}</td>
                <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><MiniBar v={v.ir} max={prodTotIR}/><span style={{fontSize:10,color:t.dim}}>{pct(v.ir,prodTotIR)}%</span></div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </Section>

      {/* Client Drill */}
      {selSFC && <div style={{animation:"slideIn 0.25s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,flexWrap:"wrap"}}>
          <button onClick={()=>{setSelProd(null);setSelSFC(null);setSelClient(null);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#00d4aa",fontWeight:600,padding:0,fontFamily:"inherit"}}>Products</button>
          <span style={{color:t.faint}}>›</span>
          <button onClick={()=>{setSelSFC(null);setSelClient(null);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#00d4aa",fontWeight:600,padding:0,fontFamily:"inherit"}}>{CAT_EMOJI[selProd]||""} {selProd}</button>
          <span style={{color:t.faint}}>›</span>
          <span style={{fontSize:11,color:t.dim}}>{selSFC}</span>
        </div>
        <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap"}}>
          {(()=>{const s=md.products[selProd]?.sfcs?.[selSFC]; return s?<>
            <DMetaBox label="SFC IR" val={fmt(s.ir)} col="#00d4aa" t={t}/>
            <DMetaBox label="Payout" val={fmt(s.payout)} col="#f5a623" t={t}/>
            {s.aum>0&&<DMetaBox label="AUM" val={fmtAUM(s.aum)} col="#a78bfa" t={t}/>}
            <DMetaBox label="Yield" val={fmtY(s.yield)} col="#10b981" t={t}/>
            <DMetaBox label="Clients" val={String(s.clients)} col="#f472b6" t={t}/>
          </>:null;})()}
        </div>
        <Section t={t}>
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${t.border}`}}>
            <SearchBox val={clientSearch} onChange={setClientSearch} placeholder="🔍 Search clients…" t={t}/>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <TblHeader cols={["#","Client Name","IR Generated","Payout","AUM","Yield","Schemes","Share"]}/>
              <tbody>{clientEntries.map(([name,v],i)=>{
                const sfcIR=md.products[selProd]?.sfcs?.[selSFC]?.ir||1; const isAct=selClient===name;
                return <tr key={name} onClick={()=>setSelClient(isAct?null:name)} style={{cursor:"pointer",background:isAct?"rgba(0,212,170,0.07)":t.bg2,transition:"background 0.12s"}}>
                  <td style={{padding:"10px 14px",fontSize:10,color:t.dim,fontWeight:700}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</td>
                  <td style={{padding:"10px 14px"}}><div style={{fontSize:12,fontWeight:600,color:isAct?"#00d4aa":t.text}}>{name}</div></td>
                  <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"#00d4aa",fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600}}>{fmt(v.ir)}</span><MiniBar v={v.ir} max={sfcIR}/></div></td>
                  <td style={{padding:"10px 14px",color:"#f5a623",fontFamily:"JetBrains Mono,monospace",fontSize:11}}>{fmt(v.payout)}</td>
                  <td style={{padding:"10px 14px",fontSize:11,color:t.text}}>{v.aum>0?fmtAUM(v.aum):"—"}</td>
                  <td style={{padding:"10px 14px"}}><YChip y={v.yield} t={t}/></td>
                  <td style={{padding:"10px 14px",fontSize:11,color:t.dim}}>{v.schemes?.length||0}</td>
                  <td style={{padding:"10px 14px",fontSize:10,color:t.dim}}>{pct(v.ir,sfcIR)}%</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </Section>

        {/* Scheme Drill */}
        {selClient&&clientData&&<div style={{animation:"slideIn 0.25s ease"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:t.dim,fontWeight:600}}>📋 Scheme Breakdown for</span>
            <span style={{fontSize:11,color:"#00d4aa",fontWeight:700}}>{selClient}</span>
          </div>
          <Section t={t}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <TblHeader cols={["#","Scheme Name","AMC","IR Type","IR Generated","Payout","AUM","Yield"]}/>
                <tbody>{clientData.schemes.map((s,i)=><tr key={i} style={{background:t.bg2}}>
                  <td style={{padding:"10px 14px",fontSize:10,color:t.dim,fontWeight:700}}>{i+1}</td>
                  <td style={{padding:"10px 14px",fontSize:11,fontWeight:600,color:t.text,maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={s.name}>{s.name}</td>
                  <td style={{padding:"10px 14px",fontSize:11,color:t.dim}}>{s.amc}</td>
                  <td style={{padding:"10px 14px"}}><span style={{fontSize:9,fontWeight:700,background:`${CAT_COLORS[selProd]||"#00d4aa"}22`,color:CAT_COLORS[selProd]||"#00d4aa",padding:"2px 7px",borderRadius:10}}>{s.irType||selProd}</span></td>
                  <td style={{padding:"10px 14px",color:"#00d4aa",fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600}}>{fmt(s.ir)}</td>
                  <td style={{padding:"10px 14px",color:"#f5a623",fontFamily:"JetBrains Mono,monospace",fontSize:11}}>{fmt(s.payout)}</td>
                  <td style={{padding:"10px 14px",fontSize:11,color:t.text}}>{s.aum>0?fmtAUM(s.aum):"—"}</td>
                  <td style={{padding:"10px 14px"}}><YChip y={s.yield} t={t}/></td>
                </tr>)}
                </tbody>
              </table>
            </div>
          </Section>
        </div>}
      </div>}
    </div>}
    <style>{`@keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
  </div>;
}

// ════════════════════════════════════════════════════════════
// PARTNER RANKING TAB
// ════════════════════════════════════════════════════════════
function PartnerTab({md,t}) {
  const [q,setQ]=useState("");
  const rows=useMemo(()=>md?Object.entries(md.sfcs).sort((a,b)=>b[1].ir-a[1].ir).filter(([c])=>!q||c.toLowerCase().includes(q.toLowerCase())):[], [md,q]);
  const totIR=md?.ir||1;
  return <div>
    <div style={{fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,color:t.text,marginBottom:4}}>Partner (SFC) Ranking</div>
    <div style={{fontSize:11,color:t.dim,marginBottom:14}}>Sorted highest to lowest by IR Generated</div>
    <Section t={t}>
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${t.border}`}}><SearchBox val={q} onChange={setQ} placeholder="🔍 Search SFC codes…" t={t}/></div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <TblHeader cols={["#","SFC Code","IR Generated","Partner Payout","AUM","Yield","Clients","Share"]}/>
          <tbody>{rows.map(([sfc,v],i)=><tr key={sfc} style={{background:t.bg2,transition:"background 0.12s"}} onMouseEnter={e=>e.currentTarget.style.background=t.bg3} onMouseLeave={e=>e.currentTarget.style.background=t.bg2}>
            <td style={{padding:"10px 14px",fontSize:10,color:t.dim,fontWeight:700}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</td>
            <td style={{padding:"10px 14px"}}><span style={{background:t.bg3,padding:"2px 9px",borderRadius:5,fontFamily:"JetBrains Mono,monospace",fontSize:10,fontWeight:600,color:t.text}}>{sfc}</span></td>
            <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"#00d4aa",fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600}}>{fmt(v.ir)}</span><MiniBar v={v.ir} max={totIR}/></div></td>
            <td style={{padding:"10px 14px",color:"#f5a623",fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600}}>{fmt(v.payout)}</td>
            <td style={{padding:"10px 14px",fontSize:11,color:t.text}}>{v.aum>0?fmtAUM(v.aum):"—"}</td>
            <td style={{padding:"10px 14px"}}><YChip y={v.yield} t={t}/></td>
            <td style={{padding:"10px 14px",fontSize:11,color:t.dim}}>{v.clients}</td>
            <td style={{padding:"10px 14px",fontSize:10,color:t.dim}}>{pct(v.ir,totIR)}%</td>
          </tr>)}
          </tbody>
        </table>
      </div>
    </Section>
  </div>;
}

// ════════════════════════════════════════════════════════════
// CLIENT RANKING TAB
// ════════════════════════════════════════════════════════════
function ClientRankTab({md,t}) {
  const [q,setQ]=useState("");
  const rows=useMemo(()=>md?Object.entries(md.clients).sort((a,b)=>b[1].ir-a[1].ir).filter(([n])=>!q||n.toLowerCase().includes(q.toLowerCase())):[], [md,q]);
  const totIR=md?.ir||1;
  return <div>
    <div style={{fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,color:t.text,marginBottom:4}}>Client Ranking</div>
    <div style={{fontSize:11,color:t.dim,marginBottom:14}}>Sorted highest to lowest by IR Generated</div>
    <Section t={t}>
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${t.border}`}}><SearchBox val={q} onChange={setQ} placeholder="🔍 Search clients…" t={t}/></div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <TblHeader cols={["#","Client Name","SFC","Category","IR Generated","Payout","AUM","Yield","Share"]}/>
          <tbody>{rows.map(([name,v],i)=><tr key={name} style={{background:t.bg2}} onMouseEnter={e=>e.currentTarget.style.background=t.bg3} onMouseLeave={e=>e.currentTarget.style.background=t.bg2}>
            <td style={{padding:"10px 14px",fontSize:10,color:t.dim,fontWeight:700}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</td>
            <td style={{padding:"10px 14px",fontSize:12,fontWeight:600,color:t.text}}>{name}</td>
            <td style={{padding:"10px 14px"}}><span style={{fontFamily:"JetBrains Mono,monospace",fontSize:10,background:t.bg3,padding:"2px 6px",borderRadius:4,color:t.dim}}>{v.sfc}</span></td>
            <td style={{padding:"10px 14px"}}><span style={{fontSize:10,color:CAT_COLORS[v.cat]||t.dim}}>{CAT_EMOJI[v.cat]||""} {v.cat}</span></td>
            <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"#00d4aa",fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600}}>{fmt(v.ir)}</span><MiniBar v={v.ir} max={rows[0]?.[1]?.ir||1}/></div></td>
            <td style={{padding:"10px 14px",color:"#f5a623",fontFamily:"JetBrains Mono,monospace",fontSize:11}}>{fmt(v.payout)}</td>
            <td style={{padding:"10px 14px",fontSize:11,color:t.text}}>{v.aum>0?fmtAUM(v.aum):"—"}</td>
            <td style={{padding:"10px 14px"}}><YChip y={v.yield} t={t}/></td>
            <td style={{padding:"10px 14px",fontSize:10,color:t.dim}}>{pct(v.ir,totIR)}%</td>
          </tr>)}
          </tbody>
        </table>
      </div>
    </Section>
  </div>;
}

// ════════════════════════════════════════════════════════════
// SCHEME FLOW TAB
// ════════════════════════════════════════════════════════════
function SchemeTab({md,t}) {
  const [q,setQ]=useState(""); const [catF,setCatF]=useState("");
  const cats=useMemo(()=>md?[...new Set(md.schemes.map(s=>s.cat).filter(Boolean))]:[], [md]);
  const rows=useMemo(()=>md?md.schemes.filter(s=>(!q||s.name.toLowerCase().includes(q.toLowerCase())||s.amc.toLowerCase().includes(q.toLowerCase()))&&(!catF||s.cat===catF)):[], [md,q,catF]);
  const totIR=md?.ir||1;
  return <div>
    <div style={{fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,color:t.text,marginBottom:4}}>Scheme-wise Flow</div>
    <div style={{fontSize:11,color:t.dim,marginBottom:14}}>All schemes sorted by IR Generated · Click column headers to sort</div>
    <Section t={t}>
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${t.border}`,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <SearchBox val={q} onChange={setQ} placeholder="🔍 Search schemes or AMC…" t={t}/>
        <CatPill label="All" active={!catF} onClick={()=>setCatF("")} t={t} color="#00d4aa"/>
        {cats.map(c=><CatPill key={c} label={`${CAT_EMOJI[c]||""} ${c}`} active={catF===c} onClick={()=>setCatF(catF===c?"":c)} t={t} color={CAT_COLORS[c]}/>)}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <TblHeader cols={["#","Scheme Name","AMC","Category","IR Type","IR Generated","Payout","AUM","Yield"]}/>
          <tbody>{rows.map((s,i)=><tr key={i} style={{background:t.bg2}} onMouseEnter={e=>e.currentTarget.style.background=t.bg3} onMouseLeave={e=>e.currentTarget.style.background=t.bg2}>
            <td style={{padding:"10px 14px",fontSize:10,color:t.dim,fontWeight:700}}>{i+1}</td>
            <td style={{padding:"10px 14px",fontSize:11,fontWeight:600,color:t.text,maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={s.name}>{s.name}</td>
            <td style={{padding:"10px 14px",fontSize:11,color:t.dim}}>{s.amc}</td>
            <td style={{padding:"10px 14px"}}><span style={{fontSize:9,fontWeight:700,background:`${CAT_COLORS[s.cat]||"#94a3b8"}22`,color:CAT_COLORS[s.cat]||t.dim,padding:"2px 7px",borderRadius:10}}>{CAT_EMOJI[s.cat]||""} {s.cat}</span></td>
            <td style={{padding:"10px 14px",fontSize:10,color:t.dim}}>{s.irType||"—"}</td>
            <td style={{padding:"10px 14px",color:"#00d4aa",fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600}}>{fmt(s.ir)}</td>
            <td style={{padding:"10px 14px",color:"#f5a623",fontFamily:"JetBrains Mono,monospace",fontSize:11}}>{fmt(s.payout)}</td>
            <td style={{padding:"10px 14px",fontSize:11,color:t.text}}>{s.aum>0?fmtAUM(s.aum):"—"}</td>
            <td style={{padding:"10px 14px"}}><YChip y={s.yield} t={t}/></td>
          </tr>)}
          </tbody>
        </table>
      </div>
    </Section>
  </div>;
}

// ════════════════════════════════════════════════════════════
// TREND TAB
// ════════════════════════════════════════════════════════════
function TrendTab({rmData,curMonth,t}) {
  const months=rmData.months_present;
  const irData=months.map(m=>({month:m,ir:rmData.months[m]?.ir||0,payout:rmData.months[m]?.payout||0}));
  const yData=months.map(m=>({month:m,yield:+(rmData.months[m]?.yield||0).toFixed(2)}));
  const prodData=useMemo(()=>{
    const md=rmData.months[curMonth]; if(!md) return [];
    return Object.entries(md.products).filter(([,v])=>v.ir>0).sort((a,b)=>b[1].ir-a[1].ir);
  },[rmData,curMonth]);
  const totIR=prodData.reduce((s,[,v])=>s+v.ir,0);

  return <div>
    <div style={{fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,color:t.text,marginBottom:4}}>Monthly IR Trend</div>
    <div style={{fontSize:11,color:t.dim,marginBottom:16}}>IR Generated across all months</div>
    <div style={{background:t.bg2,border:`1px solid ${t.border}`,borderRadius:14,padding:22,marginBottom:20}}>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={irData} margin={{top:10,right:20,left:0,bottom:5}}>
          <defs>
            <linearGradient id="irGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.25}/>
              <stop offset="95%" stopColor="#00d4aa" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f5a623" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#f5a623" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="month" tick={{fill:t.dim,fontSize:10}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fill:t.dim,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={fmt}/>
          <Tooltip content={<CTooltip t={t}/>}/>
          <Legend wrapperStyle={{fontSize:11,color:t.dim}}/>
          <Area type="monotone" dataKey="ir" name="IR Generated" stroke="#00d4aa" strokeWidth={2.5} fill="url(#irGrad)" dot={{fill:"#00d4aa",r:3}} activeDot={{r:5}}/>
          <Area type="monotone" dataKey="payout" name="Partner Payout" stroke="#f5a623" strokeWidth={2} fill="url(#payGrad)" dot={{fill:"#f5a623",r:3}} activeDot={{r:5}}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <div style={{background:t.bg2,border:`1px solid ${t.border}`,borderRadius:14,padding:22}}>
        <div style={{fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:700,color:t.text,marginBottom:4}}>Yield Trend (%)</div>
        <div style={{fontSize:11,color:t.dim,marginBottom:14}}>Annualised yield per month</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={yData} margin={{top:5,right:20,left:0,bottom:5}}>
            <XAxis dataKey="month" tick={{fill:t.dim,fontSize:9}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:t.dim,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>v.toFixed(2)+"%"}/>
            <Tooltip content={({active,payload,label})=>active&&payload?.length?<div style={{background:t.ttBg,border:`1px solid ${t.ttBorder}`,borderRadius:8,padding:"8px 12px",fontSize:11}}><div style={{color:t.ttTitle,fontWeight:700,marginBottom:4}}>{label}</div><div style={{color:"#10b981",fontWeight:600}}>Yield: {payload[0]?.value?.toFixed(2)}%</div></div>:null}/>
            <Line type="monotone" dataKey="yield" stroke="#10b981" strokeWidth={2.5} dot={{fill:"#10b981",r:3}} activeDot={{r:5}}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{background:t.bg2,border:`1px solid ${t.border}`,borderRadius:14,padding:22}}>
        <div style={{fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:700,color:t.text,marginBottom:4}}>Product Mix — {curMonth}</div>
        <div style={{fontSize:11,color:t.dim,marginBottom:14}}>IR split by product</div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <PieChart width={160} height={160}>
            <Pie data={prodData.map(([cat,v])=>({name:cat,value:v.ir,fill:CAT_COLORS[cat]||"#94a3b8"}))} cx={75} cy={75} innerRadius={45} outerRadius={72} dataKey="value" stroke="none">
              {prodData.map(([cat],i)=><Cell key={i} fill={CAT_COLORS[cat]||"#94a3b8"}/>)}
            </Pie>
            <Tooltip formatter={(v,n)=>[fmtF(v),n]}/>
          </PieChart>
          <div style={{flex:1}}>
            {prodData.map(([cat,v],i)=><div key={cat} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 6px",borderRadius:7,marginBottom:2}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:CAT_COLORS[cat]||"#94a3b8",flexShrink:0}}/>
              <span style={{fontSize:11,flex:1,color:t.dim}}>{CAT_EMOJI[cat]||""} {cat}</span>
              <span style={{fontFamily:"JetBrains Mono,monospace",fontSize:10,fontWeight:600,color:CAT_COLORS[cat]||t.dim}}>{totIR>0?(v.ir/totIR*100).toFixed(1):0}%</span>
            </div>)}
          </div>
        </div>
      </div>
    </div>
    <div style={{background:t.bg2,border:`1px solid ${t.border}`,borderRadius:14,padding:22,marginTop:16}}>
      <div style={{fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:700,color:t.text,marginBottom:4}}>Month-over-Month Summary</div>
      <div style={{fontSize:11,color:t.dim,marginBottom:16}}>Growth % and absolute change per month</div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <TblHeader cols={["Month","IR Generated","MoM Growth","Absolute Change","AUM","Yield"]}/>
          <tbody>{months.map((m,i)=>{const md=rmData.months[m]; if(!md) return null;
            return <tr key={m} style={{background:m===curMonth?"rgba(0,212,170,0.05)":t.bg2}} onMouseEnter={e=>e.currentTarget.style.background=t.bg3} onMouseLeave={e=>e.currentTarget.style.background=m===curMonth?"rgba(0,212,170,0.05)":t.bg2}>
              <td style={{padding:"10px 14px",fontFamily:"JetBrains Mono,monospace",fontSize:11,color:m===curMonth?"#00d4aa":t.text,fontWeight:m===curMonth?700:400}}>{m}</td>
              <td style={{padding:"10px 14px",color:"#00d4aa",fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600}}>{fmt(md.ir)}</td>
              <td style={{padding:"10px 14px"}}><GrowthBadge g={md.growth}/></td>
              <td style={{padding:"10px 14px",fontFamily:"JetBrains Mono,monospace",fontSize:11,color:md.abs_change>=0?"#00d4aa":"#ff6b6b"}}>{md.abs_change===0?"—":(md.abs_change>0?"+":"")+fmt(md.abs_change)}</td>
              <td style={{padding:"10px 14px",fontSize:11,color:t.text}}>{md.aum>0?fmtAUM(md.aum):"—"}</td>
              <td style={{padding:"10px 14px"}}><YChip y={md.yield} t={t}/></td>
            </tr>;})}
          </tbody>
        </table>
      </div>
    </div>
  </div>;
}

// ════════════════════════════════════════════════════════════
// RM VIEW
// ════════════════════════════════════════════════════════════
function RMView({DATA,rmName,t,theme}) {
  const rmData=DATA[rmName];
  const months=rmData?.months_present||[];
  const [selMonth,setSelMonth]=useState(months[months.length-1]||"");
  const [tab,setTab]=useState("products");
  const md=rmData?.months?.[selMonth];
  const h=new Date().getHours();
  const greet=h<12?"Good Morning":h<17?"Good Afternoon":"Good Evening";
  const tabs=[{id:"products",label:"📊 Product Yield"},{id:"partners",label:"🤝 Partner Ranking"},{id:"clients",label:"👥 Client Ranking"},{id:"schemes",label:"📋 Scheme Flow"},{id:"trend",label:"📈 Trend"}];

  return <div>
    <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
      <div>
        <div style={{fontFamily:"Syne,sans-serif",fontSize:21,fontWeight:800,letterSpacing:"-0.03em",color:t.text}}>{greet}, {rmName?.split(" ")[0]} 👋</div>
        <div style={{fontSize:12,color:t.dim,marginTop:3}}>Brokerage performance · {selMonth}</div>
      </div>
    </div>
    {/* Month selector */}
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20,flexWrap:"wrap"}}>
      <span style={{fontSize:10,color:t.faint,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>Month</span>
      {months.map(m=><button key={m} onClick={()=>setSelMonth(m)} style={{padding:"5px 14px",borderRadius:20,border:`1px solid ${m===selMonth?"#00d4aa":t.border2}`,background:m===selMonth?"rgba(0,212,170,0.12)":t.bg3,color:m===selMonth?"#00d4aa":t.dim,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"JetBrains Mono,monospace",letterSpacing:"0.04em",transition:"all 0.2s"}}>{m}</button>)}
    </div>
    {md?<KPIGrid ir={md.ir} payout={md.payout} aum={md.aum} yld={md.yield} growth={md.growth} absChg={md.abs_change} t={t}/>:<div style={{padding:40,textAlign:"center",color:t.dim}}>No data for {selMonth}</div>}
    {/* Tabs */}
    <div style={{display:"flex",gap:2,background:t.bg3,borderRadius:10,padding:3,marginBottom:20,border:`1px solid ${t.border}`}}>
      {tabs.map(tb=><button key={tb.id} onClick={()=>setTab(tb.id)} style={{flex:1,padding:"8px 10px",borderRadius:8,border:"none",background:tab===tb.id?t.bg2:"transparent",color:tab===tb.id?"#00d4aa":t.dim,fontFamily:"Syne,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.04em",cursor:"pointer",transition:"all 0.2s",boxShadow:tab===tb.id?"0 2px 8px rgba(0,0,0,0.2)":"none"}}>{tb.label}</button>)}
    </div>
    {md&&<>
      {tab==="products"&&<ProductTab md={md} t={t} rmName={rmName} month={selMonth}/>}
      {tab==="partners"&&<PartnerTab md={md} t={t}/>}
      {tab==="clients"&&<ClientRankTab md={md} t={t}/>}
      {tab==="schemes"&&<SchemeTab md={md} t={t}/>}
      {tab==="trend"&&rmData&&<TrendTab rmData={rmData} curMonth={selMonth} t={t}/>}
    </>}
  </div>;
}

// ════════════════════════════════════════════════════════════
// ADMIN VIEW
// ════════════════════════════════════════════════════════════
function AdminView({DATA,allRMs,rmByCode,t,theme}) {
  const [adminTab,setAdminTab]=useState("rm-overview");
  const [drillRM,setDrillRM]=useState(null);
  const [q,setQ]=useState("");

  const rmStats=useMemo(()=>allRMs.map(rm=>{
    const months=DATA[rm].months_present;
    const lastM=months[months.length-1];
    const md=DATA[rm].months[lastM]||{ir:0,payout:0,aum:0,yield:0,growth:0,abs_change:0,products:{},sfcs:{},clients:{}};
    const code=Object.entries(rmByCode).find(([,n])=>n===rm)?.[0]||getInit(rm);
    return {rm,month:lastM,code,...md};
  }).sort((a,b)=>b.ir-a.ir), [DATA,allRMs,rmByCode]);

  const totIR  =rmStats.reduce((s,r)=>s+r.ir,0);
  const totPay =rmStats.reduce((s,r)=>s+r.payout,0);
  const totAUM =rmStats.reduce((s,r)=>s+r.aum,0);
  const totYield=totAUM>0?((totIR/totAUM)*100)*12:0;

  // Aggregate products, SFCs, clients across all RMs
  const globalProds={}, globalSFCs={}, globalClients={};
  rmStats.forEach(r=>{
    Object.entries(r.products||{}).forEach(([cat,v])=>{
      if(!globalProds[cat]) globalProds[cat]={ir:0,payout:0,aum:0};
      globalProds[cat].ir+=v.ir; globalProds[cat].payout+=v.payout; if(v.aum>0) globalProds[cat].aum+=v.aum;
    });
    Object.entries(r.sfcs||{}).forEach(([sfc,v])=>{
      if(!globalSFCs[sfc]) globalSFCs[sfc]={ir:0,payout:0,aum:0,clients:0,rm:r.rm};
      globalSFCs[sfc].ir+=v.ir; globalSFCs[sfc].payout+=v.payout; if(v.aum>0) globalSFCs[sfc].aum+=v.aum; globalSFCs[sfc].clients+=v.clients;
    });
    Object.entries(r.clients||{}).forEach(([cl,v])=>{
      if(!globalClients[cl]) globalClients[cl]={ir:0,payout:0,aum:0,rm:r.rm};
      globalClients[cl].ir+=v.ir; globalClients[cl].payout+=v.payout; if(v.aum>0) globalClients[cl].aum+=v.aum;
    });
  });
  const sfcRank=Object.entries(globalSFCs).sort((a,b)=>b[1].ir-a[1].ir);
  const clientRank=Object.entries(globalClients).sort((a,b)=>b[1].ir-a[1].ir);
  const prodRank=Object.entries(globalProds).sort((a,b)=>b[1].ir-a[1].ir);

  if(drillRM) return <div>
    <button onClick={()=>setDrillRM(null)} style={{marginBottom:20,display:"flex",alignItems:"center",gap:8,background:t.bg3,border:`1px solid ${t.border2}`,borderRadius:9,padding:"8px 16px",color:"#00d4aa",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>← Back to Admin Overview</button>
    <RMView DATA={DATA} rmName={drillRM} t={t} theme={theme}/>
  </div>;

  const tabs=[{id:"rm-overview",label:"📋 RM Overview"},{id:"product-yield",label:"📊 Product Yield"},{id:"partner-rank",label:"🤝 Partner Ranking"},{id:"client-rank",label:"👥 Client Ranking"}];

  return <div>
    <div style={{background:"linear-gradient(135deg,rgba(245,166,35,0.08),rgba(251,146,60,0.05))",border:"1px solid rgba(245,166,35,0.2)",borderRadius:14,padding:"14px 20px",marginBottom:20,display:"flex",alignItems:"center",gap:14}}>
      <span style={{fontSize:24}}>🔐</span>
      <div><div style={{fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,color:"#f5a623"}}>Admin Overview</div><div style={{fontSize:11,color:t.dim}}>Company-wide brokerage · Latest month per RM · <b style={{color:t.text}}>FY 2025-26</b></div></div>
    </div>
    <KPIGrid ir={totIR} payout={totPay} aum={totAUM} yld={totYield} growth={0} absChg={0} t={t}/>
    {/* Tab bar */}
    <div style={{display:"flex",gap:2,background:t.bg3,borderRadius:10,padding:3,marginBottom:20,border:`1px solid ${t.border}`}}>
      {tabs.map(tb=><button key={tb.id} onClick={()=>setAdminTab(tb.id)} style={{flex:1,padding:"8px 12px",borderRadius:8,border:"none",background:adminTab===tb.id?t.bg2:"transparent",color:adminTab===tb.id?"#00d4aa":t.dim,fontFamily:"Syne,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.04em",cursor:"pointer",transition:"all 0.2s",boxShadow:adminTab===tb.id?"0 2px 8px rgba(0,0,0,0.2)":"none"}}>{tb.label}</button>)}
    </div>

    {adminTab==="rm-overview"&&<div>
      {/* Charts row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <div style={{background:t.bg2,border:`1px solid ${t.border}`,borderRadius:14,padding:22}}>
          <div style={{fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:700,color:t.text,marginBottom:4}}>IR Split by Product</div>
          <div style={{fontSize:11,color:t.dim,marginBottom:14}}>Across all RMs</div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <PieChart width={160} height={160}>
              <Pie data={prodRank.map(([cat,v])=>({name:cat,value:v.ir}))} cx={75} cy={75} innerRadius={45} outerRadius={72} dataKey="value" stroke="none">
                {prodRank.map(([cat],i)=><Cell key={i} fill={CAT_COLORS[cat]||"#94a3b8"}/>)}
              </Pie>
              <Tooltip formatter={(v,n)=>[fmtF(v),n]}/>
            </PieChart>
            <div style={{flex:1}}>{prodRank.map(([cat,v],i)=><div key={cat} style={{display:"flex",alignItems:"center",gap:8,padding:"3px 4px",marginBottom:2}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:CAT_COLORS[cat]||"#94a3b8",flexShrink:0}}/>
              <span style={{fontSize:11,flex:1,color:t.dim}}>{CAT_EMOJI[cat]||""} {cat}</span>
              <span style={{fontFamily:"JetBrains Mono,monospace",fontSize:10,fontWeight:600,color:CAT_COLORS[cat]||t.dim}}>{totIR>0?(v.ir/totIR*100).toFixed(1):0}%</span>
            </div>)}</div>
          </div>
        </div>
        <div style={{background:t.bg2,border:`1px solid ${t.border}`,borderRadius:14,padding:22}}>
          <div style={{fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:700,color:t.text,marginBottom:4}}>IR by RM — Latest Month</div>
          <div style={{fontSize:11,color:t.dim,marginBottom:14}}>Click to open RM dashboard</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={rmStats} margin={{top:5,right:10,left:0,bottom:5}}>
              <XAxis dataKey={r=>r.rm.split(" ")[0]} tick={{fill:t.dim,fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:t.dim,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={fmt}/>
              <Tooltip content={<CTooltip t={t}/>}/>
              <Bar dataKey="ir" name="IR Generated" radius={[5,5,0,0]} barSize={28} onClick={(d)=>setDrillRM(d.rm)} style={{cursor:"pointer"}}>
                {rmStats.map((_,i)=><Cell key={i} fill={RM_COLORS[i%RM_COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* RM Cards */}
      <div style={{fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,color:t.text,marginBottom:14}}>RM Portfolio Details</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(310px,1fr))",gap:14}}>
        {rmStats.map((r,i)=>{const col=RM_COLORS[i%RM_COLORS.length]; const initials=getInit(r.rm);
          return <div key={r.rm} onClick={()=>setDrillRM(r.rm)} style={{background:t.bg2,border:`1px solid ${t.border}`,borderRadius:14,padding:20,cursor:"pointer",transition:"all 0.2s",borderTop:`2px solid ${col}`}} onMouseEnter={e=>{e.currentTarget.style.borderColor=col;e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.transform="none";}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{width:38,height:38,borderRadius:10,background:`linear-gradient(135deg,${col},${col}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:800,color:"#fff"}}>{initials}</div>
              <div><div style={{fontSize:13,fontWeight:700,color:t.text}}>{r.rm}</div><div style={{fontFamily:"JetBrains Mono,monospace",fontSize:10,color:t.dim}}>{r.code} · {r.month}</div></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[{l:"IR Generated",v:fmt(r.ir),c:col},{l:"Yield",v:fmtY(r.yield),c:"#10b981"},{l:"Payout",v:fmt(r.payout),c:"#f5a623"},{l:"MoM Growth",v:(r.growth>0?"+":"")+r.growth.toFixed(1)+"%",c:r.growth>=0?"#60a5fa":"#ff6b6b"}].map(({l,v,c},j)=><div key={j} style={{background:t.bg3,borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:t.dim,marginBottom:3}}>{l}</div>
                <div style={{fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:800,color:c}}>{v}</div>
              </div>)}
            </div>
            <div style={{fontSize:11,color:"#00d4aa",marginTop:12,fontWeight:600}}>Open RM Dashboard →</div>
          </div>;
        })}
      </div>
    </div>}

    {adminTab==="product-yield"&&<div>
      <div style={{fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,color:t.text,marginBottom:14}}>Product-wise Yield — All RMs</div>
      <Section t={t}>
        <div style={{display:"grid",gridTemplateColumns:"1.8fr 1fr 1fr 1fr 1.2fr 0.8fr",padding:"10px 18px",background:t.bg3,borderBottom:`1px solid ${t.border2}`}}>
          {["Product","Total IR","Total Payout","Total AUM","Yield (Ann.)","Share"].map((h,i)=><div key={i} style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:t.dim}}>{h}</div>)}
        </div>
        {prodRank.map(([cat,v])=>{const y=v.aum>0?((v.ir/v.aum)*100)*12:0; const col=CAT_COLORS[cat]||"#94a3b8";
          return <div key={cat} style={{display:"grid",gridTemplateColumns:"1.8fr 1fr 1fr 1fr 1.2fr 0.8fr",padding:"13px 18px",borderBottom:`1px solid ${t.border}`,alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:18}}>{CAT_EMOJI[cat]||"📦"}</span><div style={{fontSize:12,fontWeight:700,color:t.text}}>{cat}</div></div>
            <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600,color:"#00d4aa"}}>{fmt(v.ir)}</div>
            <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:11,color:"#f5a623"}}>{fmt(v.payout)}</div>
            <div style={{fontSize:11,color:t.text}}>{v.aum>0?fmtAUM(v.aum):"—"}</div>
            <div><YChip y={y} t={t}/></div>
            <div style={{fontSize:10,color:t.dim}}>{pct(v.ir,totIR)}%</div>
          </div>;
        })}
      </Section>
    </div>}

    {adminTab==="partner-rank"&&<div>
      <div style={{fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,color:t.text,marginBottom:14}}>Partner (SFC) Ranking — All RMs</div>
      <Section t={t}>
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${t.border}`}}><SearchBox val={q} onChange={setQ} placeholder="🔍 Search SFC codes…" t={t}/></div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <TblHeader cols={["#","SFC Code","IR Generated","Payout","AUM","Yield","Clients","Share"]}/>
            <tbody>{sfcRank.filter(([c])=>!q||c.toLowerCase().includes(q.toLowerCase())).map(([sfc,v],i)=><tr key={sfc} style={{background:t.bg2}} onMouseEnter={e=>e.currentTarget.style.background=t.bg3} onMouseLeave={e=>e.currentTarget.style.background=t.bg2}>
              <td style={{padding:"10px 14px",fontSize:10,color:t.dim,fontWeight:700}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</td>
              <td style={{padding:"10px 14px"}}><span style={{background:t.bg3,padding:"2px 9px",borderRadius:5,fontFamily:"JetBrains Mono,monospace",fontSize:10,fontWeight:600,color:t.text}}>{sfc}</span></td>
              <td style={{padding:"10px 14px",color:"#00d4aa",fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600}}>{fmt(v.ir)}</td>
              <td style={{padding:"10px 14px",color:"#f5a623",fontFamily:"JetBrains Mono,monospace",fontSize:11}}>{fmt(v.payout)}</td>
              <td style={{padding:"10px 14px",fontSize:11,color:t.text}}>{v.aum>0?fmtAUM(v.aum):"—"}</td>
              <td style={{padding:"10px 14px"}}><YChip y={v.aum>0?((v.ir/v.aum)*100)*12:0} t={t}/></td>
              <td style={{padding:"10px 14px",fontSize:11,color:t.dim}}>{v.clients}</td>
              <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><MiniBar v={v.ir} max={totIR}/><span style={{fontSize:10,color:t.dim}}>{pct(v.ir,totIR)}%</span></div></td>
            </tr>)}
            </tbody>
          </table>
        </div>
      </Section>
    </div>}

    {adminTab==="client-rank"&&<div>
      <div style={{fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,color:t.text,marginBottom:14}}>Client Ranking — All RMs (Latest Month)</div>
      <Section t={t}>
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${t.border}`}}><SearchBox val={q} onChange={setQ} placeholder="🔍 Search clients…" t={t}/></div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <TblHeader cols={["#","Client Name","RM","IR Generated","Payout","AUM","Yield","Share"]}/>
            <tbody>{clientRank.filter(([n])=>!q||n.toLowerCase().includes(q.toLowerCase())).slice(0,200).map(([name,v],i)=><tr key={name} style={{background:t.bg2}} onMouseEnter={e=>e.currentTarget.style.background=t.bg3} onMouseLeave={e=>e.currentTarget.style.background=t.bg2}>
              <td style={{padding:"10px 14px",fontSize:10,color:t.dim,fontWeight:700}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</td>
              <td style={{padding:"10px 14px",fontSize:12,fontWeight:600,color:t.text}}>{name}</td>
              <td style={{padding:"10px 14px",fontSize:11,color:t.dim}}>{v.rm?.split(" ")[0]}</td>
              <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"#00d4aa",fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600}}>{fmt(v.ir)}</span><MiniBar v={v.ir} max={clientRank[0]?.[1]?.ir||1}/></div></td>
              <td style={{padding:"10px 14px",color:"#f5a623",fontFamily:"JetBrains Mono,monospace",fontSize:11}}>{fmt(v.payout)}</td>
              <td style={{padding:"10px 14px",fontSize:11,color:t.text}}>{v.aum>0?fmtAUM(v.aum):"—"}</td>
              <td style={{padding:"10px 14px"}}><YChip y={v.aum>0?((v.ir/v.aum)*100)*12:0} t={t}/></td>
              <td style={{padding:"10px 14px",fontSize:10,color:t.dim}}>{pct(v.ir,totIR)}%</td>
            </tr>)}
            </tbody>
          </table>
        </div>
        {clientRank.length>200&&<div style={{textAlign:"center",padding:"12px",fontSize:11,color:t.dim}}>Showing top 200 of {clientRank.length} clients</div>}
      </Section>
    </div>}
  </div>;
}

// ════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════
export default function NuarchPortal() {
  const [rawRows,setRawRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [fetchErr,setFetchErr]=useState("");
  const [theme,setTheme]=useState("dark");
  const [step,setStep]=useState(1);
  const [code,setCode]=useState(""); const [otp,setOtp]=useState(""); const [genOTP,setGenOTP]=useState("");
  const [channel,setChannel]=useState("whatsapp");
  const [codeErr,setCodeErr]=useState(""); const [otpErr,setOtpErr]=useState("");
  const [session,setSession]=useState(null);
  const t=TH[theme];

  useEffect(()=>{
    const lnk=document.createElement("link");
    lnk.href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap";
    lnk.rel="stylesheet"; document.head.appendChild(lnk);
    return ()=>{ try{document.head.removeChild(lnk);}catch(e){} };
  },[]);

  useEffect(()=>{
    fetch(CSV_URL)
      .then(r=>{ if(!r.ok) throw new Error("HTTP "+r.status+" — Check sheet is published publicly"); return r.text(); })
      .then(txt=>{ setRawRows(parseCSV(txt)); setLoading(false); })
      .catch(e=>{ setFetchErr(e.message); setLoading(false); });
  },[]);

  const {data:DATA,rmByCode}=useMemo(()=>processData(rawRows),[rawRows]);
  const allRMs=useMemo(()=>Object.keys(DATA).sort(),[DATA]);

  // Build login codes
  const loginCodes=useMemo(()=>{
    const codes={}; Object.entries(rmByCode).forEach(([c,n])=>codes[c]=n); codes["ADMIN"]="__ADMIN__"; return codes;
  },[rmByCode]);

  const onSend=()=>{
    const c=code.trim().toUpperCase();
    if(!loginCodes[c]){setCodeErr(`Invalid code. Use one of the RM codes shown below or ADMIN.`);return;}
    setCodeErr(""); const generated=String(Math.floor(100000+Math.random()*900000)); setGenOTP(generated); setStep(2);
  };
  const onVerify=()=>{
    if(otp.trim()!==genOTP){setOtpErr("Incorrect OTP. Please try again.");return;}
    setOtpErr(""); const c=code.trim().toUpperCase();
    const isAdmin=c==="ADMIN"; const rmName=isAdmin?"":loginCodes[c];
    setSession({code:c,rmName,isAdmin});
  };
  const logout=()=>{ setSession(null);setStep(1);setCode("");setOtp("");setCodeErr("");setOtpErr(""); };
  const toggleTheme=()=>setTheme(th=>th==="dark"?"light":"dark");
  const pageTitle=session?.isAdmin?"Admin Dashboard":session?.rmName?`${session.rmName} · Dashboard`:"Dashboard";

  const base={minHeight:"100vh",background:t.bg,color:t.text,fontFamily:"'DM Sans',system-ui,sans-serif",position:"relative"};

  if(loading) return <div style={{...base,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
    <div style={{fontSize:40,animation:"spin 1.2s linear infinite"}}>🚀</div>
    <div style={{fontFamily:"Syne,sans-serif",fontSize:15,color:"#00d4aa",fontWeight:700}}>Loading Nuarch Portal…</div>
    <div style={{fontSize:11,color:t.dim}}>Fetching live data from Google Sheets</div>
    <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
  </div>;

  if(fetchErr) return <div style={{...base,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,padding:40}}>
    <div style={{fontSize:40}}>⚠️</div>
    <div style={{fontFamily:"Syne,sans-serif",color:"#ff6b6b",fontSize:16,fontWeight:700,textAlign:"center"}}>Failed to load data</div>
    <div style={{fontSize:12,color:t.dim,maxWidth:420,textAlign:"center",lineHeight:1.6}}>{fetchErr}</div>
    <div style={{fontSize:11,color:t.faint,maxWidth:380,textAlign:"center"}}>Ensure the Google Sheet is published as CSV (File → Share → Publish to web → CSV) and is publicly accessible.</div>
    <button onClick={()=>window.location.reload()} style={{background:"#00d4aa",color:"#060d18",border:"none",borderRadius:9,padding:"10px 24px",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"Syne,sans-serif",letterSpacing:"0.06em"}}>↺ Retry</button>
  </div>;

  if(!session) return <LoginView theme={theme} t={t} step={step} code={code} otp={otp} genOTP={genOTP} channel={channel} codeErr={codeErr} otpErr={otpErr} loginCodes={loginCodes} setCode={setCode} setOtp={setOtp} setChannel={setChannel} setStep={setStep} setCodeErr={setCodeErr} setOtpErr={setOtpErr} onSend={onSend} onVerify={onVerify} toggleTheme={toggleTheme}/>;

  return <div style={base}>
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,background:"radial-gradient(ellipse 70% 45% at 15% 0%,rgba(0,212,170,0.05) 0%,transparent 60%),radial-gradient(ellipse 50% 40% at 85% 100%,rgba(245,166,35,0.04) 0%,transparent 60%)"}}/>
    <Header t={t} theme={theme} session={session} pageTitle={pageTitle} toggleTheme={toggleTheme} logout={logout}/>
    <div style={{maxWidth:1320,margin:"0 auto",padding:"24px 20px 60px",position:"relative",zIndex:1}}>
      {session.isAdmin
        ?<AdminView DATA={DATA} allRMs={allRMs} rmByCode={rmByCode} t={t} theme={theme}/>
        :<RMView DATA={DATA} rmName={session.rmName} t={t} theme={theme}/>
      }
    </div>
    <style>{`* { box-sizing: border-box; } ::-webkit-scrollbar{width:4px;height:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:${t.bg4};border-radius:4px} @keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
  </div>;
}
