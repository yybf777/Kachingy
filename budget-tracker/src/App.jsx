import { useState, useEffect } from "react";

const STORAGE_KEY = "budget-tracker-v2";

const DETAILED_CATEGORIES = {
  expense: ["餐饮", "交通", "购物", "娱乐", "医疗", "居住", "教育", "储蓄", "其他"],
  income: ["工资", "兼职", "红包", "退款", "其他收入"],
};
const SIMPLE_CATEGORIES = {
  expense: ["必需品", "非必需品"],
  income: ["收入"],
};
const ICONS = {
  餐饮:"🍜", 交通:"🚇", 购物:"🛍", 娱乐:"🎬", 医疗:"💊", 居住:"🏠",
  教育:"📚", 储蓄:"🏦", 其他:"📦", 工资:"💼", 兼职:"💻", 红包:"🧧",
  退款:"↩️", 其他收入:"💰", 必需品:"✅", 非必需品:"✨", 收入:"💰",
};
const THEMES = [
  { name:"奶茶", bg:"#fdf8f3", surface:"#ffffff", accent:"#c17f5a", text:"#3d2b1f" },
  { name:"深夜", bg:"#0f0f12", surface:"#1a1a20", accent:"#6b6b6b", text:"#e8e8f0" },
  { name:"抹茶", bg:"#f4f7f2", surface:"#ffffff", accent:"#6a9e72", text:"#253d28" },
  { name:"樱粉", bg:"#fff5f8", surface:"#ffffff", accent:"#e07a95", text:"#3d1f28" },
  { name:"薰衣草", bg:"#f5f4fd", surface:"#ffffff", accent:"#8b7fd4", text:"#2a2550" },
  { name:"天空", bg:"#f2f8fd", surface:"#ffffff", accent:"#4a9ec7", text:"#1a2d3d" },
];
const ALIPAY_MAP = {
  "餐饮美食":"餐饮","交通出行":"交通","日用百货":"购物","购物":"购物",
  "娱乐休闲":"娱乐","运动户外":"娱乐","医疗健康":"医疗","住房物业":"居住",
  "教育培训":"教育","转账红包":"其他","投资理财":"其他","充值缴费":"其他",
};

function parseWechat(wb, XLSX) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, defval:"" });
  const hi = rows.findIndex(r => r.includes("交易时间"));
  if (hi === -1) return [];
  const h = rows[hi];
  const ti=h.indexOf("交易时间"), yi=h.indexOf("收/支"), ai=h.indexOf("金额(元)"),
        ci=h.indexOf("交易类型"), ni=h.indexOf("商品"), si=h.indexOf("当前状态");
  return rows.slice(hi+1).filter(r => {
    const t=String(r[yi]||"").trim(), s=String(r[si]||"").trim();
    return (t==="支出"||t==="收入") && s!=="已退款" && s!=="退款成功";
  }).map(r => {
    const amt=parseFloat(r[ai]);
    if (!amt||isNaN(amt)) return null;
    const raw=r[ti];
    const date=raw instanceof Date ? raw.toISOString().slice(0,10) : String(raw).slice(0,10).replace(/\//g,"-");
    return { id:Date.now()+Math.random(), type:String(r[yi]).trim()==="支出"?"expense":"income",
      amount:amt, category:String(r[yi]).trim()==="支出"?"其他":"其他收入",
      note:String(r[ni]||r[ci]||"").slice(0,20), date, imported:true };
  }).filter(Boolean);
}

function parseAlipay(wb, XLSX) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, defval:"" });
  const hi = rows.findIndex(r => r.includes("交易时间"));
  if (hi === -1) return [];
  const h = rows[hi];
  const ti=h.indexOf("交易时间"), yi=h.indexOf("收/支"), ai=h.indexOf("金额"),
        ci=h.indexOf("交易分类"), ni=h.indexOf("商品说明"), si=h.indexOf("交易状态");
  return rows.slice(hi+1).filter(r => {
    const t=String(r[yi]||"").trim(), s=String(r[si]||"").trim();
    return (t==="支出"||t==="收入") && !s.includes("失败") && !s.includes("关闭");
  }).map(r => {
    const amt=parseFloat(r[ai]);
    if (!amt||isNaN(amt)) return null;
    const raw=r[ti];
    const date=raw instanceof Date ? raw.toISOString().slice(0,10) : String(raw).slice(0,10).replace(/\//g,"-");
    const type=String(r[yi]).trim()==="支出"?"expense":"income";
    return { id:Date.now()+Math.random(), type, amount:amt,
      category:type==="expense"?(ALIPAY_MAP[String(r[ci]).trim()]||"其他"):"其他收入",
      note:String(r[ni]||"").slice(0,20), date, imported:true };
  }).filter(Boolean);
}

function defaults() {
  return { entries:[], budget:0, theme:0, mode:"detailed", funFund:0, goals:[], recurring:[], yearGoal:null, catBudgets:{}, fabPos:"right-bottom" };
}
function loadData() {
  try { const r=localStorage.getItem(STORAGE_KEY); if (r) return {...defaults(),...JSON.parse(r)}; } catch {}
  return defaults();
}
function saveData(d) { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(d)); } catch {} }

export default function App() {
  const [data, setData] = useState(loadData);
  const [tab, setTab] = useState("home");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [sortAsc, setSortAsc] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ type:"expense", amount:"", category:"", note:"", date:new Date().toISOString().slice(0,10), fromFunFund:false });
  const [budgetInput, setBudgetInput] = useState(data.budget||"");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [xlsxReady, setXlsxReady] = useState(!!window.XLSX);
  const [showRecurring, setShowRecurring] = useState(false);
  const [recForm, setRecForm] = useState({ name:"", type:"expense", amount:"", category:"", day:"1" });
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({ name:"", target:"", saved:"", deadline:"", emoji:"🌟", color:"" });
  const [editGoalId, setEditGoalId] = useState(null);
  const [depositId, setDepositId] = useState(null);
  const [depositAmt, setDepositAmt] = useState("");
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().slice(0,7));
  const [showYearGoal, setShowYearGoal] = useState(false);
  const [yearGoalForm, setYearGoalForm] = useState({ target:"", items:[] });
  const [yearGoalItem, setYearGoalItem] = useState({ name:"", amount:"" });

  const [sysDark, setSysDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = e => setSysDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // theme: -1 = 跟随系统, 0-5 = 手动
  const theme = data.theme === -1
    ? (sysDark ? THEMES[1] : THEMES[0])
    : (THEMES[data.theme] || THEMES[0]);
  const cats = data.mode==="detailed" ? DETAILED_CATEGORIES : SIMPLE_CATEGORIES;

  useEffect(() => { saveData(data); }, [data]);

  useEffect(() => {
    if (window.XLSX) { setXlsxReady(true); return; }
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload=()=>setXlsxReady(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!data.recurring?.length) return;
    const m=new Date().toISOString().slice(0,7);
    const toAdd=data.recurring.filter(r=>!data.entries.some(e=>e.recurringId===r.id&&e.date.startsWith(m))).map(r=>{
      const days=new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate();
      const d=String(Math.min(r.day,days)).padStart(2,"0");
      return { id:Date.now()+Math.random(), type:r.type, amount:r.amount,
        category:r.category, note:r.name, date:`${m}-${d}`, recurringId:r.id, auto:true };
    });
    if (toAdd.length) setData(d=>({...d,entries:[...toAdd,...d.entries]}));
  }, []);

  useEffect(() => {
    if (!data.budget) return;
    const now=new Date();
    const lm=new Date(now.getFullYear(),now.getMonth()-1,1).toISOString().slice(0,7);
    const key=`settled-${lm}`;
    if (data[key]) return;
    const lmExp=data.entries.filter(e=>e.date.startsWith(lm)&&e.type==="expense").reduce((s,e)=>s+e.amount,0);
    const diff=data.budget-lmExp;
    if (diff===0) return;
    setData(d=>({...d,funFund:Math.max(0,(d.funFund||0)+diff),[key]:true}));
  }, []);

  // 年度目标：每月自动补录储蓄条目
  useEffect(() => {
    if (!data.yearGoal) return;
    const m=new Date().toISOString().slice(0,7);
    const yKey=`yearGoal-${m}`;
    if (data[yKey]) return;
    const monthly=parseFloat(data.yearGoal.monthly);
    if (!monthly||isNaN(monthly)) return;
    const days=new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate();
    const entry={
      id:Date.now()+Math.random(), type:"expense", amount:monthly,
      category:"储蓄", note:`年度目标储蓄`, date:`${m}-01`,
      recurringId:"yearGoal", auto:true,
    };
    setData(d=>({...d,entries:[entry,...d.entries],[yKey]:true}));
  }, []);

  function upd(p) { setData(d=>({...d,...p})); }

  function addEntry() {
    if (!form.amount||!form.category) return;
    const amt = parseFloat(form.amount);
    const e={ id:Date.now(), type:form.type, amount:amt, category:form.category, note:form.note, date:form.date, fromFunFund: form.fromFunFund&&form.type==="expense" };
    const patch = { entries:[e,...data.entries] };
    if (form.fromFunFund && form.type==="expense") {
      patch.funFund = Math.max(0, (data.funFund||0) - amt);
    }
    upd(patch);
    setForm({ type:"expense", amount:"", category:"", note:"", date:new Date().toISOString().slice(0,10), fromFunFund:false });
    setShowAdd(false);
  }

  function delEntry(id) {
    const entry = data.entries.find(e => e.id === id);
    if (!entry) return;
    const patch = { entries: data.entries.filter(e => e.id !== id) };
    if (entry.fromFunFund) {
      patch.funFund = (data.funFund||0) + entry.amount;
    }
    if (entry.category === "储蓄" && entry.note?.startsWith("存入：")) {
      const goalName = entry.note.replace("存入：", "");
      setData(d => ({
        ...d,
        ...patch,
        entries: d.entries.filter(e => e.id !== id),
        goals: d.goals.map(g =>
          g.name === goalName ? { ...g, saved: Math.max(0, (g.saved||0) - entry.amount) } : g
        ),
      }));
    } else {
      upd(patch);
    }
  }

  async function handleImport(e) {
    const file=e.target.files[0];
    if (!file||!window.XLSX) return;
    const XL=window.XLSX;
    setImporting(true); setImportResult(null);
    try {
      const buf=await file.arrayBuffer();
      const name=file.name.toLowerCase();
      const isCSV=name.endsWith(".csv");
      // CSV用GBK编码读取（支付宝导出格式）
      let wb;
      if (isCSV) {
        const decoder=new TextDecoder("gbk");
        const text=decoder.decode(buf);
        wb=XL.read(text,{type:"string",cellDates:true});
      } else {
        wb=XL.read(buf,{type:"array",cellDates:true});
      }
      let parsed=name.includes("微信")||name.includes("wechat")?parseWechat(wb,XL):parseAlipay(wb,XL);
      if (!parsed.length) parsed=parseWechat(wb,XL);
      if (!parsed.length) { setImportResult({ok:false,msg:"未识别到有效记录"}); }
      else {
        const keys=new Set(data.entries.filter(e=>e.imported).map(e=>`${e.date}-${e.amount}-${e.note}`));
        const news=parsed.filter(e=>!keys.has(`${e.date}-${e.amount}-${e.note}`));
        upd({ entries:[...news,...data.entries] });
        setImportResult({ok:true,msg:`导入 ${news.length} 条${parsed.length-news.length>0?`，跳过 ${parsed.length-news.length} 条重复`:""}`});
      }
    } catch(err) { setImportResult({ok:false,msg:"解析失败："+err.message}); }
    setImporting(false); e.target.value="";
  }

  function exportCSV() {
    const filtered = exportMonth === "all"
      ? [...data.entries]
      : data.entries.filter(e => e.date.startsWith(exportMonth));
    if (!filtered.length) return;
    const headers = ["日期","类型","分类","金额","备注"];
    const rows = filtered
      .sort((a,b)=>b.date.localeCompare(a.date))
      .map(e=>[
        e.date,
        e.type==="expense"?"支出":"收入",
        e.category,
        e.amount.toFixed(2),
        e.note||""
      ]);
    const csv = [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const bom = "\uFEFF";
    const encoded = encodeURIComponent(bom+csv);
    const filename = exportMonth === "all"
      ? `Kachingy_全部.csv`
      : `Kachingy_${exportMonth}.csv`;
    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,${encoded}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  function addRec(item) { upd({ recurring:[...(data.recurring||[]),{...item,id:Date.now()}] }); }
  function delRec(id) { upd({ recurring:data.recurring.filter(r=>r.id!==id) }); }
  function addGoal(g) { upd({ goals:[...(data.goals||[]),{...g,id:Date.now(),saved:parseFloat(g.saved)||0}] }); }
  function delGoal(id) { upd({ goals:data.goals.filter(g=>g.id!==id) }); }
  function updateGoalStyle(id, patch) { upd({ goals:data.goals.map(g=>g.id===id?{...g,...patch}:g) }); }
  function deposit(id, amt, name) {
    const entry={ id:Date.now(), type:"expense", amount:amt, category:"储蓄",
      note:`存入：${name}`, date:new Date().toISOString().slice(0,10) };
    setData(d=>({...d,
      goals:d.goals.map(g=>g.id===id?{...g,saved:(g.saved||0)+amt}:g),
      entries:[entry,...d.entries]
    }));
  }

  const monthEntries=data.entries.filter(e=>e.date.startsWith(month));
  const totalIncome=monthEntries.filter(e=>e.type==="income").reduce((s,e)=>s+e.amount,0);
  const totalExpense=monthEntries.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0);
  const balance=totalIncome-totalExpense;

  const today=new Date().toISOString().slice(0,10);
  const todayExpense=data.entries.filter(e=>e.date===today&&e.type==="expense").reduce((s,e)=>s+e.amount,0);
  const daysInMonth=new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate();
  const yearGoalMonthly=data.yearGoal ? parseFloat(data.yearGoal.monthly)||0 : 0;
  const effectiveBudget=data.budget>0 ? data.budget-yearGoalMonthly : 0;
  const dailyLimit=effectiveBudget>0 ? effectiveBudget/daysInMonth : null;
  const dailyOver=dailyLimit!==null ? todayExpense-dailyLimit : null;
  const catTotals={};
  monthEntries.filter(e=>e.type==="expense").forEach(e=>{ catTotals[e.category]=(catTotals[e.category]||0)+e.amount; });

  // 自动按历史比例分配分类预算，用户可覆盖
  function getEffectiveCatBudgets() {
    if (!data.budget) return {};
    const cats=Object.keys(catTotals);
    if (!cats.length) return {};
    const total=Object.values(catTotals).reduce((s,v)=>s+v,0)||1;
    const result={};
    cats.forEach(c=>{
      result[c]=data.catBudgets?.[c]!=null
        ? data.catBudgets[c]
        : Math.round((catTotals[c]/total)*data.budget);
    });
    return result;
  }
  const effectiveCatBudgets=getEffectiveCatBudgets();
  const maxCatVal=Math.max(...Object.keys(catTotals).map(c=>Math.max(catTotals[c], effectiveCatBudgets[c]||0)),1);
  const sortedEntries=[...monthEntries].sort((a,b)=>sortAsc?a.date.localeCompare(b.date):b.date.localeCompare(a.date));

  const FAB_POSITIONS = {
    "left-top":    { top:60,    left:20,   bottom:"auto", right:"auto" },
    "left-middle": { top:"50%", left:20,   bottom:"auto", right:"auto", transform:"translateY(-50%)" },
    "left-bottom": { bottom:96, left:20,   top:"auto",    right:"auto" },
    "right-top":   { top:60,    right:20,  bottom:"auto", left:"auto" },
    "right-middle":{ top:"50%", right:20,  bottom:"auto", left:"auto",  transform:"translateY(-50%)" },
    "right-bottom":{ bottom:96, right:20,  top:"auto",    left:"auto" },
  };
  const fabStyle = FAB_POSITIONS[data.fabPos||"right-bottom"];

  const T=theme;
  const css=`
    @import url('https://fonts.googleapis.com/css2?family=Kaisei+Opti:wght@400;700&family=Ma+Shan+Zheng&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
    body{background:${T.bg};}
    .app{min-height:100vh;background:${T.bg};max-width:430px;margin:0 auto;font-family:system-ui,-apple-system,'Helvetica Neue',sans-serif;color:${T.text};padding-bottom:96px;}

    /* header */
    .hdr{padding:52px 24px 20px;}
    .mrow{display:flex;align-items:center;gap:10px;margin-bottom:6px;}
    .mb{background:${T.accent}18;border:none;color:${T.accent};font-size:.9rem;cursor:pointer;padding:6px 10px;border-radius:99px;line-height:1;}
    .ml{font-family:'Kaisei Opti',serif;font-size:1rem;color:${T.text};opacity:.55;letter-spacing:.08em;}
    .bl{font-size:.68rem;color:${T.accent};opacity:.7;letter-spacing:.18em;text-transform:uppercase;margin-bottom:4px;font-weight:600;}
    .ba{font-family:'Kaisei Opti',serif;font-size:3.2rem;line-height:1;margin:6px 0 2px;letter-spacing:-.01em;}

    /* stat cards */
    .sts{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 24px 20px;}
    .st{background:${T.surface};border-radius:22px;padding:18px 16px;box-shadow:0 2px 16px rgba(0,0,0,.05);}
    .stl{font-size:.65rem;color:${T.accent};opacity:.75;letter-spacing:.14em;margin-bottom:8px;text-transform:uppercase;font-weight:600;}
    .stv{font-size:1.35rem;font-weight:600;}
    .stv.income{color:#6db88a;} .stv.expense{color:#e07a95;}

    /* budget bar */
    .bbw{padding:0 24px 20px;}
    .bbt{display:flex;justify-content:space-between;font-size:.72rem;opacity:.5;margin-bottom:8px;}
    .bbbg{height:8px;background:${T.text}10;border-radius:99px;overflow:hidden;}
    .bbf{height:100%;border-radius:99px;background:linear-gradient(90deg,${T.accent}cc,${T.accent});transition:width .5s cubic-bezier(.4,0,.2,1);}
    .bbf.over{background:linear-gradient(90deg,#e07a95cc,#e07a95);}

    /* fun fund */
    .ffc{margin:0 24px 20px;background:linear-gradient(135deg,${T.accent}22,${T.accent}0a);border-radius:22px;padding:20px;border:1.5px solid ${T.accent}25;position:relative;overflow:hidden;}
    .ffc::after{content:'🎀';position:absolute;right:16px;top:50%;transform:translateY(-50%);font-size:2rem;opacity:.35;}
    .ffl{font-size:.65rem;letter-spacing:.16em;color:${T.accent};opacity:.8;text-transform:uppercase;margin-bottom:6px;font-weight:600;}
    .ffa{font-family:'Kaisei Opti',serif;font-size:2.2rem;color:${T.accent};}

    /* cat breakdown */
    .cb{padding:0 24px 20px;}
    .stit{font-size:.72rem;letter-spacing:.16em;color:${T.accent};opacity:.85;text-transform:uppercase;margin-bottom:14px;font-weight:700;}

    /* entries */
    .es{padding:0 24px;}
    .eh{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
    .sb{background:${T.accent}12;border:1.5px solid ${T.accent}30;border-radius:99px;padding:4px 12px;font-size:.65rem;color:${T.accent};cursor:pointer;font-weight:500;}
    .en{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid ${T.text}06;}
    .ei{width:44px;height:44px;border-radius:16px;background:${T.accent}14;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;}
    .eif{flex:1;min-width:0;}
    .ec{font-size:.88rem;font-weight:500;}
    .eno{font-size:.72rem;opacity:.38;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .er{text-align:right;flex-shrink:0;}
    .ea{font-size:.95rem;font-weight:600;}
    .ea.expense{color:#e07a95;} .ea.income{color:#6db88a;}
    .ed{font-size:.65rem;opacity:.3;margin-top:2px;}
    .edl{background:none;border:none;color:${T.text};opacity:.18;font-size:.85rem;cursor:pointer;padding:4px;margin-left:4px;}

    /* nav — pill style */
    .nav{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);width:calc(100% - 48px);max-width:382px;background:${T.surface};border-radius:99px;display:flex;padding:8px;box-shadow:0 4px 24px rgba(0,0,0,.10),0 0 0 1px ${T.text}06;}
    .nb{flex:1;background:none;border:none;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;padding:8px 0;color:${T.text};opacity:.35;font-size:.58rem;letter-spacing:.08em;transition:all .2s;border-radius:99px;}
    .nb.active{opacity:1;background:${T.accent}18;color:${T.accent};}
    .ni{font-size:1.2rem;}

    /* fab */
    .fab{position:fixed;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,${T.accent},${T.accent}cc);border:none;color:#fff;font-size:1.4rem;cursor:pointer;box-shadow:0 4px 18px ${T.accent}55;display:flex;align-items:center;justify-content:center;transition:transform .15s;z-index:50;}
    .fab:active{transform:scale(.92);}

    /* modal */
    .ov{position:fixed;inset:0;background:#00000050;z-index:100;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(2px);}
    .mo{background:${T.surface};border-radius:28px 28px 0 0;padding:28px 24px 52px;width:100%;max-width:430px;max-height:90vh;overflow-y:auto;}
    .mt{font-family:'Kaisei Opti',serif;font-size:1.4rem;margin-bottom:22px;color:${T.text};}
    .tt{display:flex;background:${T.bg};border-radius:16px;padding:4px;margin-bottom:20px;}
    .tb{flex:1;padding:9px;border:none;border-radius:13px;cursor:pointer;font-size:.82rem;font-family:system-ui,-apple-system,sans-serif;background:transparent;color:${T.text};opacity:.45;transition:all .2s;}
    .tb.active{background:${T.surface};opacity:1;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,.08);}
    .fg{margin-bottom:18px;}
    .fl{font-size:.65rem;letter-spacing:.14em;opacity:.38;text-transform:uppercase;margin-bottom:8px;}
    .fi{width:100%;background:${T.bg};border:none;border-radius:16px;padding:13px 16px;font-size:.95rem;font-family:system-ui,-apple-system,sans-serif;color:${T.text};outline:none;}
    .fi::placeholder{opacity:.28;}
    .cg{display:flex;flex-wrap:wrap;gap:8px;}
    .cbtn{padding:8px 16px;border-radius:99px;border:1.5px solid ${T.text}12;background:${T.bg};font-size:.78rem;font-family:system-ui,-apple-system,sans-serif;color:${T.text};cursor:pointer;opacity:.65;transition:all .15s;}
    .cbtn.active{background:${T.accent};border-color:${T.accent};color:#fff;opacity:1;}
    .abtn{width:100%;padding:15px;background:linear-gradient(135deg,${T.accent},${T.accent}dd);color:#fff;border:none;border-radius:18px;font-size:.92rem;font-family:system-ui,-apple-system,sans-serif;font-weight:600;cursor:pointer;margin-top:8px;letter-spacing:.06em;box-shadow:0 4px 14px ${T.accent}40;}

    /* settings */
    .sp{padding:24px;}
    .ss{margin-bottom:28px;}
    .ss-t{font-size:.68rem;letter-spacing:.16em;color:${T.accent};opacity:.8;text-transform:uppercase;margin-bottom:12px;font-weight:700;}
    .sc{background:${T.surface};border-radius:22px;padding:16px;box-shadow:0 2px 12px rgba(0,0,0,.04);}
    .sr{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid ${T.text}06;}
    .sr:last-child{border-bottom:none;}
    .mtog{display:flex;background:${T.bg};border-radius:16px;padding:4px;}
    .mtb{flex:1;padding:9px;border:none;border-radius:13px;cursor:pointer;font-size:.8rem;font-family:system-ui,-apple-system,sans-serif;background:transparent;color:${T.text};opacity:.45;transition:all .2s;}
    .mtb.active{background:${T.surface};opacity:1;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,.08);}
    .bw{display:flex;align-items:center;gap:8px;}
    .bi{flex:1;background:${T.bg};border:none;border-radius:14px;padding:11px 14px;font-size:.95rem;font-family:system-ui,-apple-system,sans-serif;color:${T.text};outline:none;}
    .sbt{padding:11px 18px;background:${T.accent};color:#fff;border:none;border-radius:14px;font-size:.82rem;cursor:pointer;font-weight:500;}
    .tds{display:flex;gap:10px;flex-wrap:wrap;}
    .td{width:34px;height:34px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:transform .15s;}
    .td.active{border-color:${T.accent};transform:scale(1.15);}
    .ib{display:inline-block;padding:10px 18px;background:${T.accent}14;border:1.5px solid ${T.accent}35;border-radius:14px;font-size:.82rem;color:${T.accent};cursor:pointer;font-family:system-ui,-apple-system,sans-serif;font-weight:500;}
    .ir{margin-top:12px;font-size:.78rem;padding:9px 14px;border-radius:12px;}
    .ir.ok{background:#6db88a18;color:#5a9e72;} .ir.err{background:#e07a9518;color:#d4688a;}

    /* goals page */
    .gp{padding:52px 24px 24px;}
    .gc{background:${T.surface};border-radius:24px;padding:22px;box-shadow:0 2px 16px rgba(0,0,0,.05);margin-bottom:16px;position:relative;overflow:hidden;}
    .gc::before{content:attr(data-emoji);position:absolute;right:18px;top:16px;font-size:2rem;opacity:.18;}
    .gn{font-size:1.05rem;font-weight:600;margin-bottom:4px;padding-right:40px;}
    .gm{font-size:.7rem;opacity:.38;margin-bottom:14px;}
    .gas{display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:10px;}
    .gsv{font-weight:700;color:${T.accent};}
    .gtg{opacity:.38;}
    .gbb{height:10px;background:${T.text}10;border-radius:99px;overflow:hidden;margin-bottom:12px;}
    .gbf{height:100%;border-radius:99px;background:linear-gradient(90deg,${T.accent}cc,${T.accent});transition:width .5s cubic-bezier(.4,0,.2,1);}
    .gbf.done{background:linear-gradient(90deg,#6db88acc,#6db88a);}
    .gmo{font-size:.7rem;opacity:.42;margin-bottom:14px;}
    .gac{display:flex;gap:8px;}
    .gab{flex:1;padding:9px;background:${T.accent}14;border:1.5px solid ${T.accent}30;border-radius:14px;font-size:.78rem;color:${T.accent};cursor:pointer;font-family:system-ui,-apple-system,sans-serif;font-weight:500;}
    .gdb{padding:9px 14px;background:none;border:1.5px solid ${T.text}12;border-radius:14px;font-size:.78rem;opacity:.38;cursor:pointer;font-family:system-ui,-apple-system,sans-serif;color:${T.text};}
    .bdg{display:inline-flex;align-items:center;gap:3px;background:#6db88a20;color:#5a9e72;font-size:.65rem;padding:3px 10px;border-radius:99px;margin-left:8px;font-weight:600;}
    .empty{text-align:center;padding:60px 0;opacity:.28;font-size:.85rem;}
  `;

  return (
    <>
      <style>{css}</style>
      <div className="app">

        {tab==="home" && <>
          <div className="hdr">
            <div className="mrow">
              <button className="mb" onClick={()=>setMonth(m=>{const d=new Date(m+"-01");d.setMonth(d.getMonth()-1);return d.toISOString().slice(0,7);})}>‹</button>
              <span className="ml">{month.replace("-"," / ")}</span>
              <button className="mb" onClick={()=>setMonth(m=>{const d=new Date(m+"-01");d.setMonth(d.getMonth()+1);return d.toISOString().slice(0,7);})}>›</button>
            </div>
            <div className="bl">本月结余</div>
            <div className="ba" style={{color:balance>=0?T.text:"#d4688a"}}>{balance<0?"-":""}¥{Math.abs(balance).toFixed(2)}</div>
          </div>
          <div className="sts">
            <div className="st"><div className="stl">收入</div><div className="stv income">¥{totalIncome.toFixed(2)}</div></div>
            <div className="st"><div className="stl">支出</div><div className="stv expense">¥{totalExpense.toFixed(2)}</div></div>
          </div>
          {data.budget>0 && (()=>{
            const budgetLeft=data.budget-totalExpense;
            const over=budgetLeft<0;
            return <div style={{padding:"0 24px 20px"}}>
              <div style={{background:over?`#e07a9514`:`${T.accent}10`,border:`1.5px solid ${over?"#e07a9530":T.accent+"25"}`,borderRadius:22,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:".62rem",opacity:.42,letterSpacing:".14em",textTransform:"uppercase",marginBottom:5}}>预算结余</div>
                  <div style={{fontFamily:"'Kaisei Opti',serif",fontSize:"1.6rem",fontWeight:700,color:over?"#e07a95":T.accent,lineHeight:1}}>
                    {over?"-":""}¥{Math.abs(budgetLeft).toFixed(2)}
                  </div>
                  <div style={{fontSize:".65rem",opacity:.4,marginTop:4}}>预算 ¥{data.budget} · 已花 ¥{totalExpense.toFixed(0)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:".62rem",opacity:.42,letterSpacing:".14em",textTransform:"uppercase",marginBottom:8}}>本月进度</div>
                  <div style={{width:72,height:72,position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <svg width="72" height="72" style={{position:"absolute",transform:"rotate(-90deg)"}}>
                      <circle cx="36" cy="36" r="28" fill="none" stroke={T.text+"10"} strokeWidth="6"/>
                      <circle cx="36" cy="36" r="28" fill="none" stroke={over?"#e07a95":T.accent} strokeWidth="6"
                        strokeDasharray={`${Math.min(100,(totalExpense/data.budget)*100)*1.759} 175.9`}
                        strokeLinecap="round"/>
                    </svg>
                    <span style={{fontSize:".72rem",fontWeight:600,color:over?"#e07a95":T.accent,zIndex:1}}>
                      {Math.min(100,Math.round((totalExpense/data.budget)*100))}%
                    </span>
                  </div>
                </div>
              </div>
            </div>;
          })()}
          {dailyLimit!==null && month===new Date().toISOString().slice(0,7) && (
            <div style={{padding:"0 24px 20px"}}>
              <div style={{background:dailyOver>0?"#d4688a12":T.surface,border:`1px solid ${dailyOver>0?"#d4688a30":T.text+"10"}`,borderRadius:16,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:`0 1px 8px rgba(0,0,0,.04)`}}>
                <div>
                  <div style={{fontSize:".68rem",opacity:.4,letterSpacing:".12em",textTransform:"uppercase",marginBottom:4}}>今日限额</div>
                  <div style={{fontSize:".95rem",fontWeight:500}}>¥{dailyLimit.toFixed(2)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:".68rem",opacity:.4,letterSpacing:".12em",textTransform:"uppercase",marginBottom:4}}>今日已花</div>
                  <div style={{fontSize:".95rem",fontWeight:500,color:dailyOver>0?"#d4688a":T.text}}>¥{todayExpense.toFixed(2)}</div>
                </div>
                {dailyOver>0 && (
                  <div style={{textAlign:"right",borderLeft:`1px solid #d4688a20`,paddingLeft:14,marginLeft:4}}>
                    <div style={{fontSize:".68rem",letterSpacing:".08em",color:"#d4688a",opacity:.7,marginBottom:4}}>超出</div>
                    <div style={{fontSize:".95rem",fontWeight:600,color:"#d4688a"}}>¥{dailyOver.toFixed(2)}</div>
                  </div>
                )}
              </div>
            </div>
          )}
          {data.funFund>0 && <div className="ffc"><div className="ffl">🎉 娱乐基金</div><div className="ffa">¥{data.funFund.toFixed(2)}</div></div>}
          {Object.keys(catTotals).length>0 && <div className="cb">
            <div className="stit">分类支出{data.budget>0?" vs 预算":""}</div>
            {Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([c,actual])=>{
              const budget=effectiveCatBudgets[c]||0;
              const over=actual-budget;
              const withinAmt=budget>0 ? Math.min(actual,budget) : actual;
              const totalPct=Math.min(100,(actual/maxCatVal)*100);
              const withinPct=budget>0 ? (withinAmt/actual)*totalPct : totalPct;
              const overPct=over>0 ? totalPct-withinPct : 0;
              const budgetPct=budget>0 ? Math.min(100,(budget/maxCatVal)*100) : 0;
              return (
                <div key={c} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
                    <span style={{fontSize:".82rem"}}>{ICONS[c]||"•"} {c}</span>
                    <span style={{fontSize:".75rem",opacity:.5}}>
                      {budget>0 && <span style={{color:over>0?"#d4688a":"#5a9e72",fontWeight:over>0?600:400}}>
                        {over>0?`超 ¥${over.toFixed(0)}`:`¥${actual.toFixed(0)} / ¥${budget}`}
                      </span>}
                      {!budget && <span>¥{actual.toFixed(2)}</span>}
                    </span>
                  </div>
                  <div style={{height:10,borderRadius:99,background:T.text+"10",overflow:"hidden",position:"relative",display:"flex"}}>
                    {/* 预算内绿色段 */}
                    <div style={{width:`${withinPct}%`,height:"100%",background:over>0?"#5a9e72":""+T.accent,borderRadius:over>0?"99px 0 0 99px":"99px",transition:"width .4s",flexShrink:0}}/>
                    {/* 超出红色段 */}
                    {overPct>0 && <div style={{width:`${overPct}%`,height:"100%",background:"#d4688a",borderRadius:"0 99px 99px 0",transition:"width .4s",flexShrink:0}}/>}
                    {/* 预算刻度线 */}
                    {budget>0 && budgetPct>0 && budgetPct<100 && (
                      <div style={{position:"absolute",left:`${budgetPct}%`,top:-3,bottom:-3,width:2,background:T.text,opacity:.15,borderRadius:1}}/>
                    )}
                  </div>
                </div>
              );
            })}
            {data.budget>0 && <div style={{fontSize:".68rem",opacity:.35,marginTop:4,letterSpacing:".06em"}}>竖线为各分类预算上限 · 可在设置中调整</div>}
          </div>}
          <div className="es">
            <div className="eh">
              <span className="stit" style={{margin:0}}>明细记录</span>
              <button className="sb" onClick={()=>setSortAsc(v=>!v)}>{sortAsc?"↑ 正序":"↓ 倒序"}</button>
            </div>
            {sortedEntries.length===0 && <div className="empty">本月暂无记录</div>}
            {sortedEntries.map(e=>(
              <div key={e.id} className="en">
                <div className="ei">{ICONS[e.category]||"•"}</div>
                <div className="eif"><div className="ec">{e.category}{e.fromFunFund&&<span style={{fontSize:".6rem",background:T.accent+"20",color:T.accent,borderRadius:99,padding:"1px 6px",marginLeft:6,fontWeight:500}}>基金</span>}</div>{e.note&&<div className="eno">{e.note}</div>}</div>
                <div className="er"><div className={`ea ${e.type}`}>{e.type==="expense"?"-":"+"}¥{e.amount.toFixed(2)}</div><div className="ed">{e.date}</div></div>
                <button className="edl" onClick={()=>delEntry(e.id)}>×</button>
              </div>
            ))}
          </div>
        </>}

        {tab==="goals" && <div className="gp">
          <div style={{fontFamily:"'Ma Shan Zheng',cursive",fontSize:"1.8rem",marginBottom:24,color:T.accent,fontWeight:400}}>愿望清单 ✨</div>

          {/* 年度目标卡片 */}
          {data.yearGoal ? (
            <div style={{background:`${T.accent}14`,border:`1.5px solid ${T.accent}30`,borderRadius:16,padding:20,marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <div style={{fontSize:".68rem",letterSpacing:".15em",opacity:.5,textTransform:"uppercase",marginBottom:4}}>📅 年度储蓄目标</div>
                  <div style={{fontFamily:"'DM Serif Display',serif",fontSize:"1.5rem",color:T.accent}}>¥{parseFloat(data.yearGoal.total).toFixed(0)}</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>{
                    setYearGoalForm({target:String(data.yearGoal.base||data.yearGoal.total),items:data.yearGoal.items||[]});
                    setShowYearGoal(true);
                  }} style={{background:"none",border:`1px solid ${T.accent}40`,borderRadius:8,padding:"4px 10px",fontSize:".72rem",opacity:.7,cursor:"pointer",color:T.accent,fontFamily:"'Noto Sans SC',sans-serif"}}>编辑</button>
                  <button onClick={()=>upd({yearGoal:null})} style={{background:"none",border:`1px solid ${T.text}20`,borderRadius:8,padding:"4px 10px",fontSize:".72rem",opacity:.5,cursor:"pointer",color:T.text,fontFamily:"'Noto Sans SC',sans-serif"}}>清除</button>
                </div>
              </div>
              {data.yearGoal.items?.length>0 && (
                <div style={{marginBottom:12}}>
                  {data.yearGoal.items.map((item,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:".78rem",opacity:.6,padding:"3px 0"}}>
                      <span>• {item.name}</span><span>¥{parseFloat(item.amount).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:8}}>
                {[
                  {label:"每月存入",val:`¥${parseFloat(data.yearGoal.monthly).toFixed(0)}`},
                  {label:"每日需省",val:`¥${(parseFloat(data.yearGoal.monthly)/daysInMonth).toFixed(1)}`},
                  {label:"剩余月份",val:`${Math.max(0,12-new Date().getMonth())} 个月`},
                ].map(({label,val})=>(
                  <div key={label} style={{background:T.surface,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                    <div style={{fontSize:".62rem",opacity:.4,letterSpacing:".08em",marginBottom:4}}>{label}</div>
                    <div style={{fontSize:".88rem",fontWeight:600,color:T.accent}}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <button className="ib" style={{width:"100%",textAlign:"center",marginBottom:20,padding:"14px"}} onClick={()=>{setYearGoalForm({target:"",items:[]});setShowYearGoal(true);}}>
              📅 设定年度储蓄目标
            </button>
          )}
          {!data.goals?.length && <div className="empty" style={{paddingTop:80}}>还没有目标，点 ＋ 开始攒第一个愿望</div>}
          {(data.goals||[]).map((g,idx)=>{
            const tgt=parseFloat(g.target),saved=parseFloat(g.saved)||0;
            const pct=Math.min(100,(saved/tgt)*100),done=saved>=tgt;
            const today=new Date();
            let monthly=null;
            if (!done&&g.deadline){const dl=new Date(g.deadline);const ms=(dl.getFullYear()-today.getFullYear())*12+(dl.getMonth()-today.getMonth());if(ms>0)monthly=((tgt-saved)/ms).toFixed(2);}
            const cardEmoji=g.emoji||"🌟";
            const cardBg=g.bgImage
              ? `url(${g.bgImage}) center/cover`
              : g.color || T.surface;
            const isEditing=editGoalId===g.id;
            return <div key={g.id} className="gc" style={{background:cardBg,border:g.bgImage?"none":"1px solid "+T.text+"08"}}>
              {/* 背景图遮罩 */}
              {g.bgImage && <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.32)",borderRadius:24,zIndex:0}}/>}
              <div style={{position:"relative",zIndex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div className="gn" style={{color:g.bgImage?"#fff":T.text}}>{g.name}{done&&<span className="bdg">✓ 达成</span>}</div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:"1.6rem",lineHeight:1}}>{cardEmoji}</span>
                    <button onClick={()=>setEditGoalId(isEditing?null:g.id)} style={{background:"none",border:`1px solid ${g.bgImage?"rgba(255,255,255,.3)":T.text+"20"}`,borderRadius:8,padding:"3px 8px",fontSize:".65rem",cursor:"pointer",color:g.bgImage?"#fff":T.text,opacity:.7}}>装扮</button>
                  </div>
                </div>
                {g.deadline&&<div className="gm" style={{color:g.bgImage?"rgba(255,255,255,.7)":""}}>目标日期：{g.deadline}</div>}

                {/* 装扮面板 */}
                {isEditing && <div style={{background:g.bgImage?"rgba(0,0,0,.4)":T.bg,borderRadius:14,padding:"12px 14px",marginBottom:12,backdropFilter:"blur(8px)"}}>
                  <div style={{fontSize:".62rem",opacity:.5,letterSpacing:".12em",textTransform:"uppercase",marginBottom:8,color:g.bgImage?"#fff":""}}>表情</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                    {["🌟","🎯","🎀","🌸","🌈","💫","🦋","🍀","🎸","✈️","💻","👑","🏖","🎨","🐾","🌙","⭐","🎊"].map(e=>(
                      <button key={e} onClick={()=>updateGoalStyle(g.id,{emoji:e})} style={{fontSize:"1.3rem",background:g.emoji===e?T.accent+"40":"transparent",border:g.emoji===e?`1.5px solid ${T.accent}`:"1.5px solid transparent",borderRadius:10,padding:"4px 6px",cursor:"pointer"}}>
                        {e}
                      </button>
                    ))}
                  </div>
                  <div style={{fontSize:".62rem",opacity:.5,letterSpacing:".12em",textTransform:"uppercase",marginBottom:8,color:g.bgImage?"#fff":""}}>卡片颜色</div>
                  <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                    {["#fff","#fff5f8","#f5f4fd","#f2f8fd","#f4f7f2","#fdf8f3","#fff9f0","#f5f5f5","#fde8ef","#e8f4fd","#e8fded","#fdf5e8"].map(c=>(
                      <div key={c} onClick={()=>updateGoalStyle(g.id,{color:c,bgImage:""})} style={{width:28,height:28,borderRadius:8,background:c,cursor:"pointer",border:g.color===c&&!g.bgImage?`2.5px solid ${T.accent}`:"1.5px solid "+T.text+"15",boxSizing:"border-box"}}/>
                    ))}
                  </div>
                  <div style={{fontSize:".62rem",opacity:.5,letterSpacing:".12em",textTransform:"uppercase",marginBottom:8,color:g.bgImage?"#fff":""}}>背景图片</div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <label style={{background:T.accent+"18",border:`1.5px solid ${T.accent}35`,borderRadius:10,padding:"6px 12px",fontSize:".75rem",color:T.accent,cursor:"pointer",fontWeight:500}}>
                      📷 上传图片
                      <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                        const file=e.target.files[0];
                        if (!file) return;
                        const reader=new FileReader();
                        reader.onload=ev=>updateGoalStyle(g.id,{bgImage:ev.target.result,color:""});
                        reader.readAsDataURL(file);
                        e.target.value="";
                      }}/>
                    </label>
                    {g.bgImage && <button onClick={()=>updateGoalStyle(g.id,{bgImage:"",color:""})} style={{background:"none",border:`1px solid ${T.text}20`,borderRadius:10,padding:"6px 10px",fontSize:".72rem",opacity:.5,cursor:"pointer",color:g.bgImage?"#fff":T.text}}>移除图片</button>}
                  </div>
                </div>}

                <div className="gas">
                  <span className="gsv" style={{color:g.bgImage?"#fff":T.accent}}>已攒 ¥{saved.toFixed(2)}</span>
                  <span style={{opacity:g.bgImage?.6:.38,fontSize:".82rem",color:g.bgImage?"#fff":""}}>目标 ¥{tgt.toFixed(2)}</span>
                </div>
                <div className="gbb" style={{background:g.bgImage?"rgba(255,255,255,.2)":T.text+"10"}}>
                  <div className={`gbf${done?" done":""}`} style={{width:`${pct}%`,background:g.bgImage?"rgba(255,255,255,.9)":""}}/>
                </div>
                {monthly&&<div className="gmo" style={{color:g.bgImage?"rgba(255,255,255,.7)":""}}>每月需存入约 ¥{monthly}</div>}
                <div className="gac">
                  {!done&&depositId!==g.id&&<button className="gab" style={{background:g.bgImage?"rgba(255,255,255,.2)":"",borderColor:g.bgImage?"rgba(255,255,255,.3)":"",color:g.bgImage?"#fff":""}} onClick={()=>{setDepositId(g.id);setDepositAmt("");}}>＋ 存入</button>}
                  {!done&&depositId===g.id&&<div style={{display:"flex",gap:8,flex:1}}>
                    <input className="fi" type="number" placeholder="金额" autoFocus value={depositAmt} onChange={e=>setDepositAmt(e.target.value)} style={{flex:1,padding:"8px 12px",fontSize:".9rem"}}/>
                    <button className="gab" style={{flex:"none",padding:"8px 14px"}} onClick={()=>{const a=parseFloat(depositAmt);if(a>0){deposit(g.id,a,g.name);setDepositId(null);setDepositAmt("");}}}>确认</button>
                    <button className="gdb" onClick={()=>setDepositId(null)}>取消</button>
                  </div>}
                  {depositId!==g.id&&<button className="gdb" style={{background:g.bgImage?"rgba(255,255,255,.15)":"",borderColor:g.bgImage?"rgba(255,255,255,.2)":"",color:g.bgImage?"#fff":""}} onClick={()=>delGoal(g.id)}>删除</button>}
                </div>
              </div>
            </div>;
          })}
        </div>}

        {tab==="settings" && <div className="sp">
          <div style={{fontFamily:"'Ma Shan Zheng',cursive",fontSize:"1.8rem",marginBottom:24,paddingTop:16,color:T.accent,fontWeight:400}}>设置 ⚙️</div>
          <div className="ss">
            <div className="ss-t">记账模式</div>
            <div className="mtog">
              <button className={`mtb${data.mode==="detailed"?" active":""}`} onClick={()=>upd({mode:"detailed"})}>详细模式</button>
              <button className={`mtb${data.mode==="simple"?" active":""}`} onClick={()=>upd({mode:"simple"})}>懒人模式</button>
            </div>
            <div style={{fontSize:".72rem",opacity:.35,marginTop:8}}>{data.mode==="detailed"?"🫐 细分九大类":"🥕 必需品 / 非必需品"}</div>
          </div>
          <div className="ss">
            <div className="ss-t">月度预算</div>
            <div className="bw"><span style={{opacity:.4}}>¥</span>
              <input className="bi" type="number" placeholder="0" value={budgetInput} onChange={e=>setBudgetInput(e.target.value)}/>
              <button className="sbt" onClick={()=>upd({budget:parseFloat(budgetInput)||0})}>保存</button>
            </div>
          </div>
          {data.budget>0 && <div className="ss">
            <div className="ss-t">分类预算调整</div>
            <div className="sc">
              <div style={{fontSize:".75rem",opacity:.45,marginBottom:12}}>为每个分类单独设定月度上限</div>
              {DETAILED_CATEGORIES.expense.map(c=>(
                <div key={c} className="sr">
                  <span style={{fontSize:".85rem",flex:1}}>{ICONS[c]||"•"} {c}</span>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{opacity:.35,fontSize:".82rem"}}>¥</span>
                    <input type="number" value={data.catBudgets?.[c]??""} placeholder={String(effectiveCatBudgets[c]||0)}
                      onChange={e=>{
                        const v=parseFloat(e.target.value);
                        upd({catBudgets:{...(data.catBudgets||{}),[c]:isNaN(v)?undefined:v}});
                      }}
                      style={{width:80,background:T.bg,border:"none",borderRadius:8,padding:"6px 10px",fontSize:".85rem",color:T.text,outline:"none",textAlign:"right"}}
                    />
                  </div>
                </div>
              ))}
              <button onClick={()=>upd({catBudgets:{}})} style={{marginTop:12,background:"none",border:`1px solid ${T.text}15`,borderRadius:8,padding:"6px 14px",fontSize:".72rem",opacity:.45,cursor:"pointer",color:T.text,fontFamily:"'Noto Sans SC',sans-serif"}}>重置为自动分配</button>
            </div>
          </div>}
          <div className="ss">
            <div className="ss-t">主题配色</div>
            <div className="tds">
              <div className={`td${data.theme===-1?" active":""}`}
                style={{background:"linear-gradient(135deg,#fff 50%,#1a1a20 50%)",border:data.theme===-1?`3px solid ${T.accent}`:"3px solid transparent"}}
                onClick={()=>upd({theme:-1})} title="跟随系统" />
              {THEMES.map((t,i)=>(
                <div key={i} className={`td${data.theme===i?" active":""}`} style={{background:t.accent}} onClick={()=>upd({theme:i})} title={t.name}/>
              ))}
            </div>
            <div style={{fontSize:".65rem",opacity:.35,marginTop:8}}>
              {data.theme===-1 ? `跟随系统（当前：${sysDark?"深色":"浅色"}）` : THEMES[data.theme]?.name}
            </div>
          </div>
          <div className="ss">
            <div className="ss-t">定期账单</div>
            <div className="sc">
              {!(data.recurring?.length)&&<div style={{fontSize:".78rem",opacity:.4,paddingBottom:8}}>暂无定期项目</div>}
              {(data.recurring||[]).map(r=>(
                <div key={r.id} className="sr">
                  <span style={{fontSize:".88rem"}}>{ICONS[r.category]||"•"} {r.name}</span>
                  <span style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:".78rem",opacity:.5,color:r.type==="expense"?"#d4688a":"#5a9e72"}}>{r.type==="expense"?"-":"+"}¥{r.amount} · 每月{r.day}日</span>
                    <button onClick={()=>delRec(r.id)} style={{background:"none",border:"none",opacity:.3,cursor:"pointer",fontSize:".9rem",color:T.text}}>×</button>
                  </span>
                </div>
              ))}
              <button className="ib" style={{marginTop:12}} onClick={()=>setShowRecurring(true)}>＋ 添加定期项目</button>
            </div>
          </div>
          <div className="ss">
            <div className="ss-t">导入账单</div>
            <div className="sc">
              <div style={{fontSize:".82rem",opacity:.5,marginBottom:12}}>支持微信/支付宝导出的 xlsx 格式账单</div>
              <label className="ib">
                {!xlsxReady?"加载中…":importing?"解析中…":"📂 选择账单文件"}
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} style={{display:"none"}} disabled={importing||!xlsxReady}/>
              </label>
              <div style={{fontSize:".72rem",opacity:.38,marginTop:8}}>支持微信/支付宝的 xlsx、xls、csv 格式</div>
              {importResult&&<div className={`ir${importResult.ok?" ok":" err"}`}>{importResult.ok?"✓ ":"✗ "}{importResult.msg}</div>}
              <div style={{marginTop:12,borderTop:`1px solid ${T.text}08`,paddingTop:12}}>
                <div style={{fontSize:".75rem",opacity:.45,marginBottom:8}}>导出账单为 CSV 文件</div>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                  <select value={exportMonth==="all"?"all":exportMonth.slice(0,4)}
                    onChange={e=>{
                      if(e.target.value==="all"){setExportMonth("all");}
                      else{
                        const months=[...new Set(data.entries.map(en=>en.date.slice(0,7)).filter(m=>m.startsWith(e.target.value)))].sort((a,b)=>b.localeCompare(a));
                        setExportMonth(months[0]||e.target.value+"-01");
                      }
                    }}
                    style={{flex:1,background:T.bg,border:"none",borderRadius:12,padding:"8px 12px",fontSize:".85rem",color:T.text,outline:"none"}}>
                    <option value="all">全部</option>
                    {[...new Set(data.entries.map(e=>e.date.slice(0,4)))].sort((a,b)=>b.localeCompare(a)).map(y=>(
                      <option key={y} value={y}>{y}年</option>
                    ))}
                  </select>
                  {exportMonth!=="all" && (
                    <select value={exportMonth}
                      onChange={e=>setExportMonth(e.target.value)}
                      style={{flex:1,background:T.bg,border:"none",borderRadius:12,padding:"8px 12px",fontSize:".85rem",color:T.text,outline:"none"}}>
                      {[...new Set(data.entries.map(en=>en.date.slice(0,7)).filter(m=>m.startsWith(exportMonth.slice(0,4))))].sort((a,b)=>b.localeCompare(a)).map(m=>(
                        <option key={m} value={m}>{m.slice(5)}月</option>
                      ))}
                    </select>
                  )}
                  <button className="ib" onClick={exportCSV}
                    disabled={!data.entries.length}
                    style={{opacity:data.entries.length?1:.4,whiteSpace:"nowrap"}}>
                    📤 导出
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="ss">
            <div className="ss-t">娱乐基金</div>
            <div className="sc">
              <div className="sr"><span style={{fontSize:".88rem"}}>当前余额</span><span style={{fontSize:".95rem",fontWeight:600,color:T.accent}}>¥{(data.funFund||0).toFixed(2)}</span></div>
              <div className="sr"><span style={{fontSize:".75rem",opacity:.45}}>每月初自动结算上月节余或超支</span></div>
              {data.budget>0&&<div className="sr"><span style={{fontSize:".75rem",opacity:.45}}>
                本月预算 ¥{data.budget}，已支出 ¥{totalExpense.toFixed(2)}，
                {data.budget-totalExpense>=0?`预计月底转入 ¥${(data.budget-totalExpense).toFixed(2)}`:`超支 ¥${Math.abs(data.budget-totalExpense).toFixed(2)}，月底将扣减`}
              </span></div>}
              {(data.funFund||0)>0&&<button className="ib" style={{marginTop:12,background:"#d4688a18",borderColor:"#d4688a40",color:"#d4688a"}} onClick={()=>upd({funFund:0})}>清零基金</button>}
            </div>
          </div>
          <div className="ss">
            <div className="ss-t">➕ 按钮位置</div>
            <div className="sc">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  ["left-top","左上"],["right-top","右上"],
                  ["left-middle","左中"],["right-middle","右中"],
                  ["left-bottom","左下"],["right-bottom","右下"],
                ].map(([pos,label])=>(
                  <button key={pos} onClick={()=>upd({fabPos:pos})}
                    style={{padding:"10px",borderRadius:12,border:`1.5px solid ${data.fabPos===pos?T.accent:T.text+"15"}`,
                      background:data.fabPos===pos?`${T.accent}18`:"transparent",
                      color:data.fabPos===pos?T.accent:T.text,fontWeight:data.fabPos===pos?600:400,
                      cursor:"pointer",fontSize:".85rem",transition:"all .15s"}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>}

        <nav className="nav">
          {[["home","首页","🏠"],["goals","愿望","🌸"],["settings","设置","⚙️"]].map(([id,label,icon])=>(
            <button key={id} className={`nb${tab===id?" active":""}`} onClick={()=>setTab(id)}>
              <span className="ni">{icon}</span><span>{label}</span>
            </button>
          ))}
        </nav>

        <button className="fab" style={fabStyle} onClick={()=>tab==="goals"?setShowAddGoal(true):setShowAdd(true)}>＋</button>

        {showAdd&&<div className="ov" onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div className="mo">
            <div className="mt">记一笔</div>
            <div className="tt">
              <button className={`tb${form.type==="expense"?" active":""}`} onClick={()=>setForm(f=>({...f,type:"expense",category:""}))}>支出</button>
              <button className={`tb${form.type==="income"?" active":""}`} onClick={()=>setForm(f=>({...f,type:"income",category:""}))}>收入</button>
            </div>
            <div className="fg"><div className="fl">金额</div><input className="fi" type="number" placeholder="0.00" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} autoFocus/></div>
            <div className="fg"><div className="fl">分类</div><div className="cg">{cats[form.type].map(c=><button key={c} className={`cbtn${form.category===c?" active":""}`} onClick={()=>setForm(f=>({...f,category:c}))}>{ICONS[c]} {c}</button>)}</div></div>
            <div className="fg"><div className="fl">备注</div><input className="fi" placeholder="可选" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/></div>
            <div className="fg"><div className="fl">日期</div><input className="fi" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
            {form.type==="expense" && (data.funFund||0)>0 && (
              <div onClick={()=>setForm(f=>({...f,fromFunFund:!f.fromFunFund}))}
                style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:form.fromFunFund?`${T.accent}14`:T.bg,border:`1.5px solid ${form.fromFunFund?T.accent+"40":T.text+"10"}`,borderRadius:16,padding:"12px 16px",marginBottom:16,cursor:"pointer",transition:"all .2s"}}>
                <div>
                  <div style={{fontSize:".85rem",fontWeight:500}}>🎉 从娱乐基金支付</div>
                  <div style={{fontSize:".68rem",opacity:.45,marginTop:2}}>当前余额 ¥{(data.funFund||0).toFixed(2)}</div>
                </div>
                <div style={{width:24,height:24,borderRadius:"50%",background:form.fromFunFund?T.accent:T.text+"15",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
                  {form.fromFunFund && <span style={{color:"#fff",fontSize:".75rem",fontWeight:700}}>✓</span>}
                </div>
              </div>
            )}
            <button className="abtn" onClick={addEntry}>记 录</button>
          </div>
        </div>}

        {showAddGoal&&<div className="ov" onClick={e=>e.target===e.currentTarget&&setShowAddGoal(false)}>
          <div className="mo">
            <div className="mt">新建愿望</div>
            <div className="fg"><div className="fl">愿望名称</div><input className="fi" placeholder="如：演唱会门票、旅行" value={goalForm.name} onChange={e=>setGoalForm(f=>({...f,name:e.target.value}))} autoFocus/></div>
            <div className="fg"><div className="fl">目标金额</div><input className="fi" type="number" placeholder="0.00" value={goalForm.target} onChange={e=>setGoalForm(f=>({...f,target:e.target.value}))}/></div>
            <div className="fg"><div className="fl">已有存款（可填 0）</div><input className="fi" type="number" placeholder="0.00" value={goalForm.saved} onChange={e=>setGoalForm(f=>({...f,saved:e.target.value}))}/></div>
            <div className="fg"><div className="fl">目标日期（可选）</div><input className="fi" type="date" value={goalForm.deadline} onChange={e=>setGoalForm(f=>({...f,deadline:e.target.value}))}/></div>
            <div className="fg">
              <div className="fl">卡片表情</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {["🌟","🎯","🎀","🌸","🌈","💫","🦋","🍀","🎸","✈️","💻","👑","🏖","🎨","🐾","🌙","⭐","🎊"].map(e=>(
                  <button key={e} onClick={()=>setGoalForm(f=>({...f,emoji:e}))} style={{fontSize:"1.2rem",background:goalForm.emoji===e?T.accent+"30":"transparent",border:goalForm.emoji===e?`1.5px solid ${T.accent}`:"1.5px solid transparent",borderRadius:10,padding:"4px 6px",cursor:"pointer"}}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="fg">
              <div className="fl">卡片颜色</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {["#ffffff","#fff5f8","#f5f4fd","#f2f8fd","#f4f7f2","#fdf8f3","#fff9f0","#fde8ef","#e8f4fd","#e8fded"].map(c=>(
                  <div key={c} onClick={()=>setGoalForm(f=>({...f,color:c}))} style={{width:28,height:28,borderRadius:8,background:c,cursor:"pointer",border:goalForm.color===c?`2.5px solid ${T.accent}`:"1.5px solid "+T.text+"18"}}/>
                ))}
              </div>
            </div>
            <button className="abtn" onClick={()=>{
              if(!goalForm.name||!goalForm.target)return;
              addGoal({name:goalForm.name,target:parseFloat(goalForm.target),saved:parseFloat(goalForm.saved)||0,deadline:goalForm.deadline,emoji:goalForm.emoji||"🌟",color:goalForm.color||""});
              setGoalForm({name:"",target:"",saved:"",deadline:"",emoji:"🌟",color:""});
              setShowAddGoal(false);
            }}>创 建</button>
          </div>
        </div>}

        {showRecurring&&<div className="ov" onClick={e=>e.target===e.currentTarget&&setShowRecurring(false)}>
          <div className="mo">
            <div className="mt">添加定期项目</div>
            <div className="tt">
              <button className={`tb${recForm.type==="expense"?" active":""}`} onClick={()=>setRecForm(f=>({...f,type:"expense",category:""}))}>支出</button>
              <button className={`tb${recForm.type==="income"?" active":""}`} onClick={()=>setRecForm(f=>({...f,type:"income",category:""}))}>收入</button>
            </div>
            <div className="fg"><div className="fl">名称</div><input className="fi" placeholder="如：房租、视频会员" value={recForm.name} onChange={e=>setRecForm(f=>({...f,name:e.target.value}))}/></div>
            <div className="fg"><div className="fl">金额</div><input className="fi" type="number" placeholder="0.00" value={recForm.amount} onChange={e=>setRecForm(f=>({...f,amount:e.target.value}))}/></div>
            <div className="fg"><div className="fl">分类</div><div className="cg">{cats[recForm.type].map(c=><button key={c} className={`cbtn${recForm.category===c?" active":""}`} onClick={()=>setRecForm(f=>({...f,category:c}))}>{ICONS[c]} {c}</button>)}</div></div>
            <div className="fg"><div className="fl">每月几日</div><input className="fi" type="number" min="1" max="31" placeholder="1" value={recForm.day} onChange={e=>setRecForm(f=>({...f,day:e.target.value}))}/></div>
            <button className="abtn" onClick={()=>{
              if(!recForm.name||!recForm.amount||!recForm.category)return;
              addRec({...recForm,amount:parseFloat(recForm.amount),day:parseInt(recForm.day)||1});
              setRecForm({name:"",type:"expense",amount:"",category:"",day:"1"});
              setShowRecurring(false);
            }}>添加</button>
          </div>
        </div>}

        {showYearGoal&&<div className="ov" onClick={e=>e.target===e.currentTarget&&setShowYearGoal(false)}>
          <div className="mo">
            <div className="mt">{data.yearGoal?"编辑年度储蓄目标":"设定年度储蓄目标"}</div>
            <div className="fg">
              <div className="fl">年度储蓄总额（基础）</div>
              <input className="fi" type="number" placeholder="如：10000" value={yearGoalForm.target} onChange={e=>setYearGoalForm(f=>({...f,target:e.target.value}))} autoFocus/>
            </div>
            <div className="fg">
              <div className="fl">大额计划支出（可选，累计添加）</div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input className="fi" placeholder="名称，如：电脑" value={yearGoalItem.name} onChange={e=>setYearGoalItem(f=>({...f,name:e.target.value}))} style={{flex:2}}/>
                <input className="fi" type="number" placeholder="金额" value={yearGoalItem.amount} onChange={e=>setYearGoalItem(f=>({...f,amount:e.target.value}))} style={{flex:1}}/>
                <button onClick={()=>{
                  if (!yearGoalItem.name||!yearGoalItem.amount) return;
                  setYearGoalForm(f=>({...f,items:[...f.items,yearGoalItem]}));
                  setYearGoalItem({name:"",amount:""});
                }} style={{padding:"0 14px",background:T.accent,color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontSize:"1.1rem"}}>＋</button>
              </div>
              {yearGoalForm.items.map((item,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:".78rem",padding:"4px 8px",background:T.bg,borderRadius:8,marginBottom:4}}>
                  <span>{item.name} ¥{item.amount}</span>
                  <button onClick={()=>setYearGoalForm(f=>({...f,items:f.items.filter((_,j)=>j!==i)}))} style={{background:"none",border:"none",opacity:.4,cursor:"pointer",color:T.text}}>×</button>
                </div>
              ))}
            </div>
            {yearGoalForm.target && (()=>{
              const base=parseFloat(yearGoalForm.target)||0;
              const extra=yearGoalForm.items.reduce((s,i)=>s+parseFloat(i.amount||0),0);
              const total=base+extra;
              const monthly=total/12;
              return <div style={{background:`${T.accent}12`,borderRadius:12,padding:"12px 14px",marginBottom:16,fontSize:".82rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{opacity:.5}}>年度总目标</span><span style={{fontWeight:600}}>¥{total.toFixed(0)}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{opacity:.5}}>每月需存入</span><span style={{fontWeight:600,color:T.accent}}>¥{monthly.toFixed(0)}</span>
                </div>
              </div>;
            })()}
            <button className="abtn" onClick={()=>{
              if (!yearGoalForm.target) return;
              const base=parseFloat(yearGoalForm.target)||0;
              const extra=yearGoalForm.items.reduce((s,i)=>s+parseFloat(i.amount||0),0);
              const total=base+extra;
              upd({yearGoal:{total,monthly:(total/12).toFixed(2),items:yearGoalForm.items,base:parseFloat(yearGoalForm.target)||0}});
              setYearGoalForm({target:"",items:[]});
              setYearGoalItem({name:"",amount:""});
              setShowYearGoal(false);
            }}>确认设定</button>
          </div>
        </div>}

      </div>
    </>
  );
}
