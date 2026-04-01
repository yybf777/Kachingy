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

function defaults() {
  return { entries:[], budget:0, theme:0, mode:"detailed", funFund:0, funFundSettled:[], goals:[], recurring:[], yearGoal:null, catBudgets:{}, fabPos:"right-bottom" };
}
function loadData() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) return {...defaults(), ...JSON.parse(r)};
  } catch {}
  return defaults();
}
function saveData(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} }

export default function App() {
  const [data, setData] = useState(loadData);
  const [tab, setTab] = useState("home");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [sortAsc, setSortAsc] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ type:"expense", amount:"", category:"", note:"", date:new Date().toISOString().slice(0,10), fromFunFund:false });
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrPreview, setOcrPreview] = useState(null);
  const [budgetInput, setBudgetInput] = useState(data.budget||"");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showRecurring, setShowRecurring] = useState(false);
  const [recForm, setRecForm] = useState({ name:"", type:"expense", amount:"", category:"", day:"1" });
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({ name:"", target:"", saved:"", deadline:"", emoji:"🌟", color:"" });
  const [editGoalId, setEditGoalId] = useState(null);
  const [depositId, setDepositId] = useState(null);
  const [depositAmt, setDepositAmt] = useState("");
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().slice(0,7));
  const [showYearGoal, setShowYearGoal] = useState(false);
  const [yearGoalForm, setYearGoalForm] = useState({ target:"", items:[], initialSaved:"", mode:"auto" });
  const [yearGoalItem, setYearGoalItem] = useState({ name:"", amount:"" });
  const [showYearDeposit, setShowYearDeposit] = useState(false);
  const [yearDepositAmt, setYearDepositAmt] = useState("");
  const [sysDark, setSysDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [showNote, setShowNote] = useState(false); // 备注默认收起
  const [searchQuery, setSearchQuery] = useState(""); // 账单搜索
  const [editEntry, setEditEntry] = useState(null); // 正在编辑的条目
  const [editForm, setEditForm] = useState(null);   // 编辑表单数据
  // 分类下钻：expandedCat = 当前展开的分类名，excludedIds = 被屏蔽的条目id集合
  const [expandedCat, setExpandedCat] = useState(null);
  const [excludedIds, setExcludedIds] = useState(new Set());

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = e => setSysDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const theme = data.theme === -1 ? (sysDark ? THEMES[1] : THEMES[0]) : (THEMES[data.theme] || THEMES[0]);
  const cats = data.mode==="detailed" ? DETAILED_CATEGORIES : SIMPLE_CATEGORIES;

  useEffect(() => { saveData(data); }, [data]);

  useEffect(() => {
    if (!data.recurring?.length) return;
    const now = new Date();
    const m = now.toISOString().slice(0,7);
    const todayDay = now.getDate(); // 今天是几号
    const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();

    // 只触发"今天应该扣款"的定期项目
    // 规则：r.day <= 今天，且本月还没有这条记录
    const toAdd = data.recurring
      .filter(r => {
        const targetDay = Math.min(r.day, daysInMonth);
        // 今天 >= 扣款日，且本月还没有这条记录
        return todayDay >= targetDay &&
          !data.entries.some(e => e.recurringId===r.id && e.date.startsWith(m));
      })
      .map(r => {
        const d = String(Math.min(r.day, daysInMonth)).padStart(2,"0");
        return { id:Date.now()+Math.random(), type:r.type, amount:r.amount,
          category:r.category, note:r.name, date:`${m}-${d}`, recurringId:r.id, auto:true };
      });

    if (toAdd.length) setData(d => ({...d, entries:[...toAdd,...d.entries]}));
  }, []);

  useEffect(() => {
    if (!data.budget) return;
    const now = new Date();
    const lm = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,7);
    // 用专门的数组记录已结算月份，不用动态 key（动态 key 容易被 defaults 覆盖丢失）
    const settled = data.funFundSettled || [];
    if (settled.includes(lm)) return;
    const lmExp = data.entries.filter(e => e.date.startsWith(lm) && e.type==="expense").reduce((s,e) => s+e.amount, 0);
    const diff = data.budget - lmExp;
    if (diff === 0) {
      // diff 为 0 也要标记已结算，否则每次打开都会重新检查
      setData(d => ({...d, funFundSettled:[...(d.funFundSettled||[]), lm]}));
      return;
    }
    setData(d => ({
      ...d,
      funFund: Math.max(0, (d.funFund||0) + diff),
      funFundSettled: [...(d.funFundSettled||[]), lm],
    }));
  }, []);

  useEffect(() => {
    if (!data.yearGoal) return;
    if (data.yearGoal.mode === "manual") return; // 手动模式不自动扣
    const m = new Date().toISOString().slice(0,7);
    const yKey = `yearGoal-${m}`;
    if (data[yKey]) return;
    const monthly = parseFloat(data.yearGoal.monthly);
    if (!monthly || isNaN(monthly)) return;
    const entry = { id:Date.now()+Math.random(), type:"expense", amount:monthly, category:"储蓄", note:`年度目标储蓄`, date:`${m}-01`, recurringId:"yearGoal", auto:true };
    setData(d => ({...d, entries:[entry,...d.entries], [yKey]:true}));
  }, []);

  function upd(p) { setData(d => ({...d,...p})); }

  function addEntry() {
    if (!form.amount || !form.category) return;
    const amt = parseFloat(form.amount);
    const e = { id:Date.now(), type:form.type, amount:amt, category:form.category, note:form.note, date:form.date, fromFunFund: form.fromFunFund && form.type==="expense" };
    const patch = { entries:[e,...data.entries] };
    if (form.fromFunFund && form.type==="expense") patch.funFund = Math.max(0, (data.funFund||0) - amt);
    upd(patch);
    setForm({ type:"expense", amount:"", category:"", note:"", date:new Date().toISOString().slice(0,10), fromFunFund:false });
    setShowAdd(false);
  }

  function delEntry(id) {
    const entry = data.entries.find(e => e.id === id);
    if (!entry) return;
    const patch = { entries: data.entries.filter(e => e.id !== id) };
    if (entry.fromFunFund) patch.funFund = (data.funFund||0) + entry.amount;
    if (entry.category === "储蓄" && entry.note?.startsWith("存入：")) {
      const goalName = entry.note.replace("存入：","");
      setData(d => ({...d,...patch, entries:d.entries.filter(e=>e.id!==id), goals:d.goals.map(g => g.name===goalName ? {...g,saved:Math.max(0,(g.saved||0)-entry.amount)} : g)}));
    } else { upd(patch); }
  }

  function saveEditEntry() {
    if (!editForm.amount || !editForm.category) return;
    const updated = {
      ...editEntry,
      amount: parseFloat(editForm.amount),
      category: editForm.category,
      note: editForm.note,
      date: editForm.date,
      type: editForm.type,
    };
    upd({ entries: data.entries.map(e => e.id===editEntry.id ? updated : e) });
    setEditEntry(null);
    setEditForm(null);
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      // Load XLSX dynamically
      if (!window.XLSX) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const XL = window.XLSX;
      const buf = await file.arrayBuffer();
      const name = file.name.toLowerCase();
      let wb;
      if (name.endsWith(".csv")) {
        const decoder = new TextDecoder("gbk");
        const text = decoder.decode(buf);
        wb = XL.read(text, {type:"string", cellDates:true});
      } else {
        wb = XL.read(buf, {type:"array", cellDates:true});
      }
      const parseW = (wb, XL) => {
        const rows = XL.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, defval:""});
        const hi = rows.findIndex(r => r.includes("交易时间"));
        if (hi===-1) return [];
        const h = rows[hi];
        const ti=h.indexOf("交易时间"),yi=h.indexOf("收/支"),ai=h.indexOf("金额(元)"),ci=h.indexOf("交易类型"),ni=h.indexOf("商品"),si=h.indexOf("当前状态");
        return rows.slice(hi+1).filter(r=>{const t=String(r[yi]||"").trim(),s=String(r[si]||"").trim();return(t==="支出"||t==="收入")&&s!=="已退款"&&s!=="退款成功";}).map(r=>{const amt=parseFloat(r[ai]);if(!amt||isNaN(amt))return null;const raw=r[ti];const date=raw instanceof Date?raw.toISOString().slice(0,10):String(raw).slice(0,10).replace(/\//g,"-");return{id:Date.now()+Math.random(),type:String(r[yi]).trim()==="支出"?"expense":"income",amount:amt,category:String(r[yi]).trim()==="支出"?"其他":"其他收入",note:String(r[ni]||r[ci]||"").slice(0,20),date,imported:true};}).filter(Boolean);
      };
      const parseA = (wb, XL) => {
        const rows = XL.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, defval:""});
        const hi = rows.findIndex(r => r.includes("交易时间"));
        if (hi===-1) return [];
        const h = rows[hi];
        const ti=h.indexOf("交易时间"),yi=h.indexOf("收/支"),ai=h.indexOf("金额"),ci=h.indexOf("交易分类"),ni=h.indexOf("商品说明"),si=h.indexOf("交易状态");
        return rows.slice(hi+1).filter(r=>{const t=String(r[yi]||"").trim(),s=String(r[si]||"").trim();return(t==="支出"||t==="收入")&&!s.includes("失败")&&!s.includes("关闭");}).map(r=>{const amt=parseFloat(r[ai]);if(!amt||isNaN(amt))return null;const raw=r[ti];const date=raw instanceof Date?raw.toISOString().slice(0,10):String(raw).slice(0,10).replace(/\//g,"-");const type=String(r[yi]).trim()==="支出"?"expense":"income";return{id:Date.now()+Math.random(),type,amount:amt,category:type==="expense"?(ALIPAY_MAP[String(r[ci]).trim()]||"其他"):"其他收入",note:String(r[ni]||"").slice(0,20),date,imported:true};}).filter(Boolean);
      };
      let parsed = name.includes("微信")||name.includes("wechat") ? parseW(wb,XL) : parseA(wb,XL);
      if (!parsed.length) parsed = parseW(wb,XL);
      if (!parsed.length) { setImportResult({ok:false,msg:"未识别到有效记录"}); }
      else {
        const keys = new Set(data.entries.filter(e=>e.imported).map(e=>`${e.date}-${e.amount}-${e.note}`));
        const news = parsed.filter(e=>!keys.has(`${e.date}-${e.amount}-${e.note}`));
        upd({ entries:[...news,...data.entries] });
        setImportResult({ok:true,msg:`导入 ${news.length} 条${parsed.length-news.length>0?`，跳过 ${parsed.length-news.length} 条重复`:""}`});
      }
    } catch(err) { setImportResult({ok:false,msg:"解析失败："+err.message}); }
    setImporting(false); e.target.value="";
  }

  function exportCSV() {
    const filtered = exportMonth==="all" ? [...data.entries] : data.entries.filter(e=>e.date.startsWith(exportMonth));
    if (!filtered.length) return;
    const headers = ["日期","类型","分类","金额","备注"];
    const rows = filtered.sort((a,b)=>b.date.localeCompare(a.date)).map(e=>[e.date,e.type==="expense"?"支出":"收入",e.category,e.amount.toFixed(2),e.note||""]);
    const csv = [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const bom = "\uFEFF";
    const encoded = encodeURIComponent(bom+csv);
    const filename = exportMonth==="all" ? `Kachingy_全部.csv` : `Kachingy_${exportMonth}.csv`;
    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,${encoded}`;
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  // OCR — Tesseract not available in artifact sandbox, show friendly message
  async function handleOCR(e) {
    const file = e.target.files[0];
    if (!file) return;
    setOcrLoading(true);
    setOcrPreview(URL.createObjectURL(file));
    e.target.value = "";
    try {
      const Tesseract = window.Tesseract;
      if (!Tesseract) {
        alert("OCR 组件还在加载，请稍后再试");
        setOcrLoading(false);
        return;
      }
      const { data: { text } } = await Tesseract.recognize(file, "chi_sim+eng", {});

      // ── 退款检测 ──────────────────────────────────────────────────────
      if (/已退款|退款成功|退款记录/.test(text)) {
        alert("检测到退款记录，不计入支出。如需记录退款收入，请手动填写。");
        setOcrLoading(false);
        setOcrPreview(null);
        return;
      }

      // ── 文本预处理：统一各种减号为标准负号 ──────────────────────────
      // 微信账单详情用的是 U+2212 数学减号 −，以及全角 －，统一替换
      const normalized = text
        .replace(/−/g, "-")   // − 数学减号
        .replace(/－/g, "-")   // － 全角减号
        .replace(/—/g, "-")   // — 破折号（有时被误识别为负号）
        .replace(/–/g, "-");       // – 连接号

      // ── 金额提取（四级优先级）────────────────────────────────────────
      // 优先级1：负号开头金额（微信/支付宝账单详情大字号，含全角减号处理后）
      const negMatch = normalized.match(/-\s*(\d+\.\d{1,2})(?:\s|$)/);

      // 优先级2：¥ 符号（含 Y、V 等 Tesseract 误识别）
      const yenMatch = normalized.match(/[¥￥Yy]\s*(\d+\.\d{1,2})/);

      // 优先级3：关键词后跟金额
      const keywordMatch = normalized.match(
        /(?:付款|实付|金额|合计|订单金额|实际支付|应付|扣款|消费)[^\d]*(\d+\.\d{1,2})/
      );

      // 优先级4：兜底——在排除时间戳、单号后，取最大的 xx.xx 格式数字
      // 先把时间格式（10:23:35）和长数字串（交易单号）剔除
      const cleaned = normalized
        .replace(/\d{2}:\d{2}:\d{2}/g, "")          // 时间 17:23:35
        .replace(/\d{8,}/g, "")                       // 8位以上长数字串（单号）
        .replace(/\d{4}[-年]\d{1,2}[-月]\d{1,2}/g,""); // 日期
      const allAmounts = [...cleaned.matchAll(/(?<![:\d])(\d{1,5}\.\d{1,2})(?!\d)/g)]
        .map(m => parseFloat(m[1]))
        .filter(n => n >= 0.01 && n <= 99999);
      const fallbackAmt = allAmounts.length ? String(Math.max(...allAmounts)) : "";

      const amount =
        (negMatch  && negMatch[1])  ||
        (yenMatch  && yenMatch[1])  ||
        (keywordMatch && keywordMatch[1]) ||
        fallbackAmt;

      // ── 日期提取 ──────────────────────────────────────────────────────
      const dateMatch =
        normalized.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/) ||
        normalized.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
      const date = dateMatch
        ? `${dateMatch[1]}-${String(dateMatch[2]).padStart(2,"0")}-${String(dateMatch[3]).padStart(2,"0")}`
        : new Date().toISOString().slice(0,10);

      // ── 商户/商品名提取 ───────────────────────────────────────────────
      const merchantMatch =
        normalized.match(/商品[^\S\n]*\n(.{2,15})/) ||
        normalized.match(/商户全称[^\S\n]*\n(.{2,15})/) ||
        normalized.match(/商家.{0,4}([\u4e00-\u9fa5]{2,10})/);
      const merchant = merchantMatch ? merchantMatch[1].trim() : "";

      // ── 分类推断 ───────────────────────────────────────────────────────
      const ctx = normalized + merchant;
      let category = "其他";
      if (/餐|饭|吃|外卖|奶茶|咖啡|火锅|烧烤|面|饮|食|快餐|食堂|小吃|麦当劳|肯德基|瑞幸|喜茶/.test(ctx))
        category = "餐饮";
      else if (/滴滴|打车|地铁|公交|高铁|火车|机票|交通|加油|停车|出租|摩拜|哈啰|共享单车/.test(ctx))
        category = "交通";
      else if (/超市|购物|淘宝|京东|拼多多|天猫|商场|服装|衣|鞋|包|美妆|化妆|图文|打印|复印/.test(ctx))
        category = "购物";
      else if (/电影|游戏|娱乐|ktv|演唱会|视频|音乐|爱奇艺|bilibili|b站/.test(ctx.toLowerCase()))
        category = "娱乐";
      else if (/医院|药|诊|健康|挂号|检查|体检/.test(ctx))
        category = "医疗";
      else if (/房租|水电|物业|居住|燃气|宽带/.test(ctx))
        category = "居住";
      else if (/学费|课|书|教育|培训|考试|邮电大学|洗澡|洗衣|饮水|校园/.test(ctx))
        category = "教育";

      setForm(f => ({
        ...f,
        amount,
        category,
        note: merchant || f.note,
        date,
        type: "expense",
      }));

    } catch (err) {
      console.error("OCR 识别失败", err);
      alert("识别失败，请手动填写或重试");
    }
    setOcrLoading(false);
  }

  function addRec(item) { upd({ recurring:[...(data.recurring||[]),{...item,id:Date.now()}] }); }
  function delRec(id) { upd({ recurring:data.recurring.filter(r=>r.id!==id) }); }
  function addGoal(g) { upd({ goals:[...(data.goals||[]),{...g,id:Date.now(),saved:parseFloat(g.saved)||0}] }); }
  function delGoal(id) { upd({ goals:data.goals.filter(g=>g.id!==id) }); }
  function updateGoalStyle(id, patch) { upd({ goals:data.goals.map(g=>g.id===id?{...g,...patch}:g) }); }
  function deposit(id, amt, name) {
    const entry = { id:Date.now(), type:"expense", amount:amt, category:"储蓄", note:`存入：${name}`, date:new Date().toISOString().slice(0,10) };
    setData(d => ({...d, goals:d.goals.map(g=>g.id===id?{...g,saved:(g.saved||0)+amt}:g), entries:[entry,...d.entries]}));
  }

  const monthEntries = data.entries.filter(e => e.date.startsWith(month));
  const totalIncome = monthEntries.filter(e=>e.type==="income").reduce((s,e)=>s+e.amount,0);
  const totalExpense = monthEntries.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0);
  const balance = totalIncome - totalExpense;
  const today = new Date().toISOString().slice(0,10);
  const todayExpense = data.entries.filter(e=>e.date===today&&e.type==="expense").reduce((s,e)=>s+e.amount,0);
  const daysInMonth = new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate();
  const yearGoalMonthly = data.yearGoal ? parseFloat(data.yearGoal.monthly)||0 : 0;
  const effectiveBudget = data.budget>0 ? data.budget-yearGoalMonthly : 0;
  const dailyLimit = effectiveBudget>0 ? effectiveBudget/daysInMonth : null;
  const dailyOver = dailyLimit!==null ? todayExpense-dailyLimit : null;
  const catTotals = {};
  monthEntries.filter(e=>e.type==="expense").forEach(e=>{ catTotals[e.category]=(catTotals[e.category]||0)+e.amount; });

  function getEffectiveCatBudgets() {
    if (!data.budget) return {};
    const cs = Object.keys(catTotals);
    if (!cs.length) return {};
    const total = Object.values(catTotals).reduce((s,v)=>s+v,0)||1;
    const result = {};
    cs.forEach(c => { result[c] = data.catBudgets?.[c]!=null ? data.catBudgets[c] : Math.round((catTotals[c]/total)*data.budget); });
    return result;
  }
  const effectiveCatBudgets = getEffectiveCatBudgets();
  const maxCatVal = Math.max(...Object.keys(catTotals).map(c=>Math.max(catTotals[c],effectiveCatBudgets[c]||0)),1);
  // 搜索时跨月搜索全部记录，否则只看当月
  const searchBase = searchQuery.trim()
    ? data.entries
    : monthEntries;
  const filteredEntries = searchQuery.trim()
    ? searchBase.filter(e=>{
        const q = searchQuery.trim().toLowerCase();
        return (
          e.category.includes(q) ||
          (e.note||"").toLowerCase().includes(q) ||
          String(e.amount).includes(q) ||
          e.date.includes(q)
        );
      })
    : searchBase;
  const sortedEntries = [...filteredEntries].sort((a,b)=>sortAsc?a.date.localeCompare(b.date):b.date.localeCompare(a.date));

  const THEME_EMOJIS = ["🧀","💵","🍀","🎀","💜","🦋"];
  const fundEmoji = data.theme===-1 ? (sysDark?"💵":"🧀") : (THEME_EMOJIS[data.theme]||"💰");

  const FAB_POSITIONS = {
    "left-top":    {top:60,left:20,bottom:"auto",right:"auto"},
    "left-middle": {top:"50%",left:20,bottom:"auto",right:"auto",transform:"translateY(-50%)"},
    "left-bottom": {bottom:96,left:20,top:"auto",right:"auto"},
    "right-top":   {top:60,right:20,bottom:"auto",left:"auto"},
    "right-middle":{top:"50%",right:20,bottom:"auto",left:"auto",transform:"translateY(-50%)"},
    "right-bottom":{bottom:96,right:20,top:"auto",left:"auto"},
  };
  const fabStyle = FAB_POSITIONS[data.fabPos||"right-bottom"];
  const T = theme;

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Kaisei+Opti:wght@400;700&family=Ma+Shan+Zheng&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
    body{background:${T.bg};}
    .app{min-height:100vh;background:${T.bg};max-width:430px;margin:0 auto;font-family:system-ui,-apple-system,'Helvetica Neue',sans-serif;color:${T.text};padding-bottom:96px;}
    .hdr{padding:44px 24px 12px;}
    .mrow{display:flex;align-items:center;gap:10px;margin-bottom:6px;}
    .mb{background:${T.accent}18;border:none;color:${T.accent};font-size:.9rem;cursor:pointer;padding:6px 10px;border-radius:99px;line-height:1;}
    .ml{font-family:'Kaisei Opti',serif;font-size:1rem;color:${T.text};opacity:.55;letter-spacing:.08em;}
    .bl{font-size:.68rem;color:${T.accent};opacity:.7;letter-spacing:.18em;text-transform:uppercase;margin-bottom:4px;font-weight:600;text-shadow:${data.bgImage?`0 1px 4px ${T.bg}`:'none'};}
    .ba{font-family:'Kaisei Opti',serif;font-size:clamp(1.8rem,8vw,3.2rem);line-height:1;margin:6px 0 2px;letter-spacing:-.02em;text-shadow:${data.bgImage?`0 2px 12px ${T.bg}bb`:'none'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:calc(100% - 70px);}
    .sts{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 24px 12px;}
    .st{background:${data.bgImage?'rgba(255,255,255,0.52)':T.surface};backdrop-filter:${data.bgImage?'blur(16px)':''};-webkit-backdrop-filter:${data.bgImage?'blur(16px)':''};border-radius:18px;padding:14px 16px;box-shadow:0 2px 16px rgba(0,0,0,.06);border:1px solid rgba(255,255,255,0.6);}
    .stl{font-size:.65rem;color:${T.accent};opacity:.75;letter-spacing:.14em;margin-bottom:8px;text-transform:uppercase;font-weight:600;}
    .stv{font-size:clamp(.95rem,4vw,1.25rem);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .stv.income{color:#6db88a;} .stv.expense{color:#e07a95;}
    .ffc{margin:0 24px 10px;background:${data.bgImage?`rgba(255,255,255,0.48)`:`linear-gradient(135deg,${T.accent}22,${T.accent}0a)`};backdrop-filter:${data.bgImage?'blur(16px)':''};-webkit-backdrop-filter:${data.bgImage?'blur(16px)':''};border-radius:22px;padding:20px;border:1.5px solid ${T.accent}25;position:relative;overflow:hidden;}
    .ffl{font-size:.65rem;letter-spacing:.16em;color:${T.accent};opacity:.8;text-transform:uppercase;margin-bottom:6px;font-weight:600;}
    .ffa{font-family:'Kaisei Opti',serif;font-size:2.2rem;color:${T.accent};}
    .cb{padding:0 24px 12px;}
    .stit{font-size:.72rem;letter-spacing:.16em;color:${T.accent};opacity:.85;text-transform:uppercase;margin-bottom:14px;font-weight:700;text-shadow:${data.bgImage?`0 1px 4px ${T.bg}aa`:'none'};}
    .es{padding:0 24px 8px;}
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
    .nav{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);width:calc(100% - 48px);max-width:382px;background:${data.bgImage?'rgba(255,255,255,0.68)':T.surface};backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:99px;display:flex;padding:8px;box-shadow:0 4px 24px rgba(0,0,0,.10),0 0 0 1px rgba(255,255,255,0.6);}
    .nb{flex:1;background:none;border:none;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;padding:8px 0;color:${T.text};opacity:.35;font-size:.58rem;letter-spacing:.08em;transition:all .2s;border-radius:99px;}
    .nb.active{opacity:1;background:${T.accent}18;color:${T.accent};}
    .ni{font-size:1.2rem;}
    .fab{position:fixed;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,${T.accent},${T.accent}cc);border:none;color:#fff;font-size:1.4rem;cursor:pointer;box-shadow:0 4px 18px ${T.accent}55;display:flex;align-items:center;justify-content:center;transition:transform .15s;z-index:50;}
    .fab:active{transform:scale(.92);}
    .ov{position:fixed;inset:0;background:#00000050;z-index:100;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(2px);}
    .mo{background:${data.bgImage?'rgba(255,255,255,0.80)':T.surface};backdrop-filter:${data.bgImage?'blur(24px)':''};-webkit-backdrop-filter:${data.bgImage?'blur(24px)':''};border-radius:28px 28px 0 0;padding:28px 24px 48px;width:100%;max-width:430px;height:auto;max-height:92vh;overflow-y:auto;transition:height .2s;}
    .mt{font-family:'Kaisei Opti',serif;font-size:1.4rem;margin-bottom:22px;color:${T.text};}
    .tt{display:flex;background:${data.bgImage?'rgba(255,255,255,0.40)':T.bg};border-radius:16px;padding:4px;margin-bottom:20px;}
    .tb{flex:1;padding:9px;border:none;border-radius:13px;cursor:pointer;font-size:.82rem;font-family:system-ui,-apple-system,sans-serif;background:transparent;color:${T.text};opacity:.45;transition:all .2s;}
    .tb.active{background:${T.surface};opacity:1;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,.08);}
    .fg{margin-bottom:18px;}
    .fl{font-size:.65rem;letter-spacing:.14em;opacity:.38;text-transform:uppercase;margin-bottom:8px;}
    .fi{width:100%;background:${data.bgImage?'rgba(255,255,255,0.6)':T.bg};border:none;border-radius:16px;padding:13px 16px;font-size:.95rem;font-family:system-ui,-apple-system,sans-serif;color:${T.text};outline:none;}
    .fi::placeholder{opacity:.28;}
    .cg{display:flex;flex-wrap:wrap;gap:8px;}
    .cbtn{padding:8px 0;border-radius:99px;border:1.5px solid ${T.text}12;background:${data.bgImage?'rgba(255,255,255,0.6)':T.bg};font-size:.78rem;font-family:system-ui,-apple-system,sans-serif;color:${T.text};cursor:pointer;opacity:.65;transition:all .15s;width:calc(33.33% - 6px);text-align:center;}
    .cbtn.active{background:${T.accent};border-color:${T.accent};color:#fff;opacity:1;}
    .abtn{width:100%;padding:15px;background:linear-gradient(135deg,${T.accent},${T.accent}dd);color:#fff;border:none;border-radius:18px;font-size:.92rem;font-family:system-ui,-apple-system,sans-serif;font-weight:600;cursor:pointer;margin-top:8px;letter-spacing:.06em;box-shadow:0 4px 14px ${T.accent}40;}
    .sp{padding:24px;}
    .ss{margin-bottom:20px;}
    .ss-t{font-size:.68rem;letter-spacing:.16em;color:${T.accent};opacity:.8;text-transform:uppercase;margin-bottom:12px;font-weight:700;text-shadow:${data.bgImage?`0 1px 4px ${T.bg}aa`:'none'};}
    .sc{background:${data.bgImage?'rgba(255,255,255,0.52)':T.surface};backdrop-filter:${data.bgImage?'blur(16px)':''};-webkit-backdrop-filter:${data.bgImage?'blur(16px)':''};border-radius:22px;padding:16px;box-shadow:0 2px 12px rgba(0,0,0,.04);border:1px solid rgba(255,255,255,0.5);}
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
    .gp{padding:44px 24px 16px;}
    .gc{background:${data.bgImage?'rgba(255,255,255,0.52)':T.surface};backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-radius:24px;padding:22px;box-shadow:0 2px 16px rgba(0,0,0,.06);margin-bottom:12px;position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.40);}
    .gn{font-size:1.05rem;font-weight:600;margin-bottom:4px;padding-right:40px;}
    .gm{font-size:.7rem;opacity:.38;margin-bottom:14px;}
    .gas{display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:10px;}
    .gsv{font-weight:700;color:${T.accent};}
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
      <div className="app" style={{position:"relative"}}>
        {/* 全局自定义背景 */}
        {data.bgImage&&<div style={{
          position:"fixed",inset:0,zIndex:0,pointerEvents:"none",
          backgroundImage:`url(${data.bgImage})`,
          backgroundSize:"cover",backgroundPosition:"center",
          opacity:data.bgOpacity??0.12,
        }}/>}
        {/* header 渐变遮罩：有背景图时让文字区域更清晰 */}
        {data.bgImage&&<div style={{
          position:"fixed",top:0,left:0,right:0,height:180,zIndex:0,pointerEvents:"none",
          background:`linear-gradient(to bottom, ${T.bg}cc 0%, ${T.bg}88 60%, transparent 100%)`,
        }}/>}
        {tab==="home" && <>
          <div className="hdr" style={{
            background:data.bgImage?'rgba(255,255,255,0.45)':'transparent',
            backdropFilter:data.bgImage?'blur(12px)':'',
            WebkitBackdropFilter:data.bgImage?'blur(12px)':'',
            borderRadius:data.bgImage?'0 0 24px 24px':'',
            marginBottom:data.bgImage?8:0,
          }}>
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
          {/* ── 月度对比图 ── */}
          {(()=>{
            // 生成所有有数据的月份（按时间排序）
            const allMonths = [...new Set(data.entries.map(e=>e.date.slice(0,7)))].sort();
            if (allMonths.length === 0) return null;
            const maxAmt = Math.max(...allMonths.map(m=>{
              const inc = data.entries.filter(e=>e.date.startsWith(m)&&e.type==="income").reduce((s,e)=>s+e.amount,0);
              const exp = data.entries.filter(e=>e.date.startsWith(m)&&e.type==="expense").reduce((s,e)=>s+e.amount,0);
              return Math.max(inc, exp, data.budget||0);
            }), 1);
            const BAR_W = 18;
            const BAR_GAP = 6;
            const GROUP_W = BAR_W*2 + BAR_GAP + 28; // 双柱+间距+月份标签间距
            const H = 90;
            return <div style={{padding:"0 0 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0 24px",marginBottom:10}}>
                <span className="stit" style={{margin:0}}>月度趋势</span>
                <span style={{fontSize:".65rem",opacity:.4,letterSpacing:".06em"}}>
                  <span style={{color:"#6db88a",fontWeight:600}}>■</span> 收入&nbsp;
                  <span style={{color:"#e07a95",fontWeight:600}}>■</span> 支出
                  {data.budget>0&&<><span style={{opacity:.5}}>&nbsp;— 预算</span></>}
                </span>
              </div>
              <div style={{overflowX:"auto",paddingLeft:24,paddingRight:24,scrollbarWidth:"none"}}
                ref={el=>{if(el)el.scrollLeft=el.scrollWidth;}}>
                <div style={{display:"flex",alignItems:"flex-end",gap:8,minWidth:"max-content",paddingBottom:4}}>
                  {allMonths.map(m=>{
                    const inc=data.entries.filter(e=>e.date.startsWith(m)&&e.type==="income").reduce((s,e)=>s+e.amount,0);
                    const exp=data.entries.filter(e=>e.date.startsWith(m)&&e.type==="expense").reduce((s,e)=>s+e.amount,0);
                    const incH=Math.max(2,Math.round((inc/maxAmt)*H));
                    const expH=Math.max(2,Math.round((exp/maxAmt)*H));
                    const budgetH=data.budget>0?Math.round((data.budget/maxAmt)*H):null;
                    const isCurrentMonth=m===month;
                    return <div key={m} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,position:"relative"}}>
                      {/* 预算线 */}
                      {budgetH&&<div style={{position:"absolute",bottom:budgetH+18,left:-4,right:-4,height:1.5,background:T.accent,opacity:.4,borderRadius:1,zIndex:1}}/>}
                      {/* 双柱 */}
                      <div style={{display:"flex",alignItems:"flex-end",gap:BAR_GAP,height:H,position:"relative"}}>
                        {/* 收入柱 */}
                        <div style={{width:BAR_W,height:incH,background:isCurrentMonth?"#6db88a":"#6db88a60",borderRadius:"6px 6px 2px 2px",transition:"height .4s cubic-bezier(.4,0,.2,1)",cursor:"pointer",position:"relative"}}
                          title={`${m} 收入 ¥${inc.toFixed(0)}`}/>
                        {/* 支出柱 */}
                        <div style={{width:BAR_W,height:expH,background:isCurrentMonth?(exp>data.budget&&data.budget>0?"#d4688a":"#e07a95"):(exp>data.budget&&data.budget>0?"#d4688a60":"#e07a9560"),borderRadius:"6px 6px 2px 2px",transition:"height .4s cubic-bezier(.4,0,.2,1)",cursor:"pointer"}}
                          title={`${m} 支出 ¥${exp.toFixed(0)}`}/>
                      </div>
                      {/* 月份标签 */}
                      <div style={{fontSize:".6rem",opacity:isCurrentMonth?1:.45,color:isCurrentMonth?T.accent:T.text,fontWeight:isCurrentMonth?700:400,whiteSpace:"nowrap"}}>
                        {m.slice(5)}月
                      </div>
                      {/* 当前月份下划线 */}
                      {isCurrentMonth&&<div style={{width:4,height:4,borderRadius:"50%",background:T.accent}}/>}
                    </div>;
                  })}
                </div>
              </div>
            </div>;
          })()}

          {data.budget>0 && (()=>{
            const budgetLeft=data.budget-totalExpense; const over=budgetLeft<0;
            return <div style={{padding:"0 24px 12px"}}>
              <div style={{background:over?`rgba(255,220,220,0.7)`:`rgba(255,255,255,0.7)`,backdropFilter:data.bgImage?'blur(16px)':'',WebkitBackdropFilter:data.bgImage?'blur(16px)':'',border:`1.5px solid ${over?"#e07a9530":T.accent+"25"}`,borderRadius:22,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:".62rem",opacity:.42,letterSpacing:".14em",textTransform:"uppercase",marginBottom:5}}>预算结余</div>
                  <div style={{fontFamily:"'Kaisei Opti',serif",fontSize:"1.6rem",fontWeight:700,color:over?"#e07a95":T.accent,lineHeight:1}}>{over?"-":""}¥{Math.abs(budgetLeft).toFixed(2)}</div>
                  <div style={{fontSize:".65rem",opacity:.4,marginTop:4}}>预算 ¥{data.budget} · 已花 ¥{totalExpense.toFixed(0)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:".62rem",opacity:.42,letterSpacing:".14em",textTransform:"uppercase",marginBottom:8}}>本月进度</div>
                  <div style={{width:72,height:72,position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <svg width="72" height="72" style={{position:"absolute",transform:"rotate(-90deg)"}}>
                      <circle cx="36" cy="36" r="28" fill="none" stroke={T.text+"10"} strokeWidth="6"/>
                      <circle cx="36" cy="36" r="28" fill="none" stroke={over?"#e07a95":T.accent} strokeWidth="6" strokeDasharray={`${Math.min(100,(totalExpense/data.budget)*100)*1.759} 175.9`} strokeLinecap="round"/>
                    </svg>
                    <span style={{fontSize:".72rem",fontWeight:600,color:over?"#e07a95":T.accent,zIndex:1}}>{Math.min(100,Math.round((totalExpense/data.budget)*100))}%</span>
                  </div>
                </div>
              </div>
            </div>;
          })()}
          {dailyLimit!==null && month===new Date().toISOString().slice(0,7) && (
            <div style={{padding:"0 24px 12px"}}>
              <div style={{background:dailyOver>0?'rgba(255,210,215,0.72)':'rgba(255,255,255,0.52)',backdropFilter:data.bgImage?'blur(16px)':'',WebkitBackdropFilter:data.bgImage?'blur(16px)':'',border:`1px solid ${dailyOver>0?"#d4688a30":T.text+"10"}`,borderRadius:16,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:`0 1px 8px rgba(0,0,0,.04)`,border:'1px solid rgba(255,255,255,0.40)'}}>
                <div><div style={{fontSize:".68rem",opacity:.4,letterSpacing:".12em",textTransform:"uppercase",marginBottom:4}}>今日限额</div><div style={{fontSize:".95rem",fontWeight:500}}>¥{dailyLimit.toFixed(2)}</div></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:".68rem",opacity:.4,letterSpacing:".12em",textTransform:"uppercase",marginBottom:4}}>今日已花</div><div style={{fontSize:".95rem",fontWeight:500,color:dailyOver>0?"#d4688a":T.text}}>¥{todayExpense.toFixed(2)}</div></div>
                {dailyOver>0&&<div style={{textAlign:"right",borderLeft:`1px solid #d4688a20`,paddingLeft:14,marginLeft:4}}><div style={{fontSize:".68rem",letterSpacing:".08em",color:"#d4688a",opacity:.7,marginBottom:4}}>超出</div><div style={{fontSize:".95rem",fontWeight:600,color:"#d4688a"}}>¥{dailyOver.toFixed(2)}</div></div>}
              </div>
            </div>
          )}
          {data.funFund>0 && <div className="ffc">
            <div className="ffl">🎉 娱乐基金</div>
            <div className="ffa">¥{data.funFund.toFixed(2)}</div>
            <span style={{position:"absolute",right:16,top:"50%",transform:"translateY(-50%)",fontSize:"2rem",opacity:.35}}>{fundEmoji}</span>
          </div>}
          {Object.keys(catTotals).length>0 && <div className="cb">
            <div className="stit">分类支出{data.budget>0?" vs 预算":""}</div>
            {Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([c,actual])=>{
              const budget=effectiveCatBudgets[c]||0;
              // 该分类所有账目，按金额从高到低
              const catEntries = monthEntries
                .filter(e=>e.type==="expense"&&e.category===c)
                .sort((a,b)=>b.amount-a.amount);
              // 屏蔽后的实际金额
              const filteredActual = catEntries
                .filter(e=>!excludedIds.has(e.id))
                .reduce((s,e)=>s+e.amount,0);
              const over=filteredActual-budget;
              const withinAmt=budget>0?Math.min(filteredActual,budget):filteredActual;
              const totalPct=Math.min(100,(filteredActual/maxCatVal)*100);
              const withinPct=budget>0&&filteredActual>0?(withinAmt/filteredActual)*totalPct:totalPct;
              const overPct=over>0?totalPct-withinPct:0;
              const budgetPct=budget>0?Math.min(100,(budget/maxCatVal)*100):0;
              const isExpanded=expandedCat===c;
              const hasExcluded=catEntries.some(e=>excludedIds.has(e.id));
              return <div key={c} style={{marginBottom:isExpanded?20:14}}>
                {/* 分类行 — 可点击展开 */}
                <div
                  onClick={()=>{
                    setExpandedCat(isExpanded?null:c);
                    // 切换时清空该分类的屏蔽
                    if(isExpanded){
                      setExcludedIds(prev=>{
                        const next=new Set(prev);
                        catEntries.forEach(e=>next.delete(e.id));
                        return next;
                      });
                    }
                  }}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5,cursor:"pointer",userSelect:"none"}}
                >
                  <span style={{fontSize:".82rem",display:"flex",alignItems:"center",gap:6}}>
                    {ICONS[c]||"•"} {c}
                    {hasExcluded&&<span style={{fontSize:".6rem",background:"#e07a9520",color:"#e07a95",borderRadius:99,padding:"1px 6px",fontWeight:500}}>已筛选</span>}
                  </span>
                  <span style={{display:"flex",alignItems:"center",gap:6,fontSize:".75rem",opacity:.5}}>
                    {budget>0&&<span style={{color:over>0?"#d4688a":"#5a9e72",fontWeight:over>0?600:400}}>
                      {over>0?`超 ¥${over.toFixed(0)}`:`¥${filteredActual.toFixed(0)} / ¥${budget}`}
                    </span>}
                    {!budget&&<span>¥{filteredActual.toFixed(2)}</span>}
                    <span style={{opacity:.4,fontSize:".7rem"}}>{isExpanded?"▲":"▼"}</span>
                  </span>
                </div>
                {/* 进度条 */}
                <div style={{height:10,borderRadius:99,background:T.text+"10",overflow:"hidden",position:"relative",display:"flex"}}>
                  <div style={{width:`${withinPct}%`,height:"100%",background:over>0?"#5a9e72":T.accent,borderRadius:over>0?"99px 0 0 99px":"99px",flexShrink:0,transition:"width .3s"}}/>
                  {overPct>0&&<div style={{width:`${overPct}%`,height:"100%",background:"#d4688a",borderRadius:"0 99px 99px 0",flexShrink:0,transition:"width .3s"}}/>}
                  {budget>0&&budgetPct>0&&budgetPct<100&&<div style={{position:"absolute",left:`${budgetPct}%`,top:-3,bottom:-3,width:2,background:T.text,opacity:.15,borderRadius:1}}/>}
                </div>
                {/* 展开的账目列表 */}
                {isExpanded&&<div style={{marginTop:10,background:T.bg,borderRadius:14,overflow:"hidden",border:`1px solid ${T.text}08`}}>
                  {/* 顶部汇总栏 */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderBottom:`1px solid ${T.text}06`,background:T.surface}}>
                    <span style={{fontSize:".68rem",opacity:.45,letterSpacing:".08em"}}>
                      共 {catEntries.length} 笔
                      {hasExcluded&&<span style={{color:"#e07a95"}}> · 已屏蔽 {catEntries.filter(e=>excludedIds.has(e.id)).length} 笔</span>}
                    </span>
                    <span style={{fontSize:".75rem",fontWeight:600,color:over>0?"#d4688a":T.accent}}>
                      合计 ¥{filteredActual.toFixed(2)}
                      {hasExcluded&&<span style={{fontSize:".65rem",opacity:.5,fontWeight:400,marginLeft:4}}>（原 ¥{actual.toFixed(2)}）</span>}
                    </span>
                  </div>
                  {hasExcluded&&<div style={{padding:"6px 12px",background:"#e07a9508",borderBottom:`1px solid ${T.text}06`}}>
                    <button
                      onClick={e=>{e.stopPropagation();setExcludedIds(prev=>{const next=new Set(prev);catEntries.forEach(e=>next.delete(e.id));return next;});}}
                      style={{fontSize:".68rem",color:"#e07a95",background:"none",border:"none",cursor:"pointer",padding:0,opacity:.8}}
                    >↺ 恢复所有屏蔽</button>
                  </div>}
                  {catEntries.map((e,i)=>{
                    const isExcluded=excludedIds.has(e.id);
                    return <div
                      key={e.id}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderBottom:i<catEntries.length-1?`1px solid ${T.text}05`:"none",opacity:isExcluded?.35:1,transition:"opacity .2s"}}
                    >
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:".82rem",fontWeight:500,textDecoration:isExcluded?"line-through":"none",color:T.text}}>{e.note||e.category}</div>
                        <div style={{fontSize:".65rem",opacity:.35,marginTop:1}}>{e.date}</div>
                      </div>
                      <span style={{fontSize:".88rem",fontWeight:600,color:isExcluded?T.text+"60":"#d4688a",flexShrink:0}}>¥{e.amount.toFixed(2)}</span>
                      <button
                        onClick={ev=>{ev.stopPropagation();setExcludedIds(prev=>{const next=new Set(prev);isExcluded?next.delete(e.id):next.add(e.id);return next;});}}
                        style={{flexShrink:0,background:isExcluded?T.accent+"20":"#e07a9514",border:`1px solid ${isExcluded?T.accent+"40":"#e07a9530"}`,borderRadius:8,padding:"3px 8px",fontSize:".65rem",color:isExcluded?T.accent:"#e07a95",cursor:"pointer",fontWeight:500,whiteSpace:"nowrap"}}
                      >{isExcluded?"恢复":"屏蔽"}</button>
                    </div>;
                  })}
                </div>}
              </div>;
            })}
            {data.budget>0&&<div style={{fontSize:".68rem",opacity:.35,marginTop:4,letterSpacing:".06em"}}>竖线为各分类预算上限 · 可在设置中调整 · 点击分类可查看明细</div>}
          </div>}
          <div className="es">
            <div className="eh">
              <span className="stit" style={{margin:0}}>明细记录</span>
              <button className="sb" onClick={()=>setSortAsc(v=>!v)}>{sortAsc?"↑ 正序":"↓ 倒序"}</button>
            </div>
            {/* 搜索框 */}
            <div style={{position:"relative",marginBottom:14}}>
              <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:".95rem",opacity:.35,pointerEvents:"none"}}>🔍</span>
              <input
                type="text"
                placeholder="搜索分类、备注、金额…"
                value={searchQuery}
                onChange={e=>setSearchQuery(e.target.value)}
                style={{
                  width:"100%",background:T.bg,border:`1.5px solid ${searchQuery?T.accent+"50":T.text+"10"}`,
                  borderRadius:14,padding:"10px 36px 10px 38px",
                  fontSize:".85rem",color:T.text,outline:"none",
                  transition:"border-color .2s",
                  fontFamily:"system-ui,-apple-system,sans-serif",
                }}
              />
              {searchQuery&&<button onClick={()=>setSearchQuery("")}
                style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:".9rem",color:T.text,opacity:.35,padding:4}}>
                ×
              </button>}
            </div>
            {/* 搜索结果提示 */}
            {searchQuery.trim()&&<div style={{fontSize:".72rem",opacity:.45,marginBottom:10,letterSpacing:".04em"}}>
              搜索「{searchQuery.trim()}」· 共 {sortedEntries.length} 条{sortedEntries.length>0?`，合计 ¥${sortedEntries.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0).toFixed(2)}`:""}
            </div>}
            {sortedEntries.length===0&&<div className="empty">{searchQuery.trim()?"没有找到相关记录":"本月暂无记录"}</div>}
            {sortedEntries.map(e=>(
              <div key={e.id} className="en" onClick={()=>{setEditEntry(e);setEditForm({type:e.type,amount:String(e.amount),category:e.category,note:e.note||"",date:e.date});}} style={{cursor:"pointer"}}>
                <div className="ei">{ICONS[e.category]||"•"}</div>
                <div className="eif">
                  <div className="ec">
                    {e.category}
                    {e.fromFunFund&&<span style={{fontSize:".6rem",background:T.accent+"20",color:T.accent,borderRadius:99,padding:"1px 6px",marginLeft:6,fontWeight:500}}>基金</span>}
                    {e.auto&&<span style={{fontSize:".6rem",background:T.text+"10",color:T.text,borderRadius:99,padding:"1px 6px",marginLeft:6,opacity:.45}}>自动</span>}
                  </div>
                  {e.note&&<div className="eno">{e.note}</div>}
                </div>
                <div className="er"><div className={`ea ${e.type}`}>{e.type==="expense"?"-":"+"}¥{e.amount.toFixed(2)}</div><div className="ed">{e.date}</div></div>
                <button className="edl" onClick={ev=>{ev.stopPropagation();if(window.confirm(`确认删除这笔「${e.category}」¥${e.amount.toFixed(2)} 的记录？`)){delEntry(e.id);}}}>×</button>
              </div>
            ))}
          </div>
        </>}

        {tab==="goals" && <div className="gp">
          <div style={{
            fontFamily:"'Ma Shan Zheng',cursive",fontSize:"1.8rem",marginBottom:24,
            color:T.accent,fontWeight:400,
            display:"inline-block",
            background:data.bgImage?`rgba(255,255,255,0.55)`:'transparent',
            backdropFilter:data.bgImage?'blur(10px)':'',
            WebkitBackdropFilter:data.bgImage?'blur(10px)':'',
            borderRadius:data.bgImage?14:0,
            padding:data.bgImage?'4px 14px 4px 10px':0,
          }}>愿望清单 ✨</div>
          {data.yearGoal ? (()=>{
            const yg = data.yearGoal;
            const initialSaved = parseFloat(yg.initialSaved)||0;
            // 通过 entries 累计已手动/自动存入的金额
            const savedViaEntries = data.entries
              .filter(e=>e.category==="储蓄"&&(e.recurringId==="yearGoal"||e.yearGoalManual))
              .reduce((s,e)=>s+e.amount,0);
            const totalSaved = initialSaved + savedViaEntries;
            const remaining = Math.max(0, parseFloat(yg.total) - totalSaved);
            const pct = Math.min(100,(totalSaved/parseFloat(yg.total))*100);
            const monthsLeft = Math.max(1, 12-new Date().getMonth());
            const monthlyNeeded = (remaining/monthsLeft).toFixed(0);
            const isManual = yg.mode==="manual";
            return <div style={{background:data.bgImage?'rgba(255,255,255,0.50)':`${T.accent}14`,backdropFilter:data.bgImage?'blur(16px)':'',WebkitBackdropFilter:data.bgImage?'blur(16px)':'',border:`1.5px solid ${T.accent}30`,borderRadius:16,padding:20,marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <div style={{fontSize:".68rem",letterSpacing:".15em",opacity:.5,textTransform:"uppercase"}}>📅 年度储蓄目标</div>
                    <span style={{fontSize:".6rem",background:isManual?T.accent+"25":"#6db88a20",color:isManual?T.accent:"#5a9e72",borderRadius:99,padding:"1px 7px",fontWeight:600}}>{isManual?"手动":"自动"}</span>
                  </div>
                  <div style={{fontSize:"1.5rem",color:T.accent,fontWeight:700}}>¥{parseFloat(yg.total).toFixed(0)}</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>{setYearGoalForm({target:String(yg.base||yg.total),items:yg.items||[],initialSaved:String(yg.initialSaved||""),mode:yg.mode||"auto"});setShowYearGoal(true);}} style={{background:"none",border:`1px solid ${T.accent}40`,borderRadius:8,padding:"4px 10px",fontSize:".72rem",opacity:.7,cursor:"pointer",color:T.accent}}>编辑</button>
                  <button onClick={()=>upd({yearGoal:null})} style={{background:"none",border:`1px solid ${T.text}20`,borderRadius:8,padding:"4px 10px",fontSize:".72rem",opacity:.5,cursor:"pointer",color:T.text}}>清除</button>
                </div>
              </div>
              {/* 进度条 */}
              <div style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:".72rem",marginBottom:6}}>
                  <span style={{color:T.accent,fontWeight:600}}>已存 ¥{totalSaved.toFixed(0)}</span>
                  <span style={{opacity:.4}}>目标 ¥{parseFloat(yg.total).toFixed(0)}</span>
                </div>
                <div style={{height:8,background:T.text+"15",borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${T.accent}cc,${T.accent})`,borderRadius:99,transition:"width .4s"}}/>
                </div>
                {initialSaved>0&&<div style={{fontSize:".62rem",opacity:.35,marginTop:4}}>含开始前已存 ¥{initialSaved.toFixed(0)}</div>}
              </div>
              {yg.items?.length>0&&<div style={{marginBottom:10}}>{yg.items.map((item,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:".78rem",opacity:.6,padding:"3px 0"}}><span>• {item.name}</span><span>¥{parseFloat(item.amount).toFixed(0)}</span></div>)}</div>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:isManual?14:0}}>
                {[
                  {label:"已存",val:`¥${totalSaved.toFixed(0)}`},
                  {label:"还差",val:`¥${remaining.toFixed(0)}`},
                  {label:isManual?"建议月存":"每月自存",val:`¥${monthlyNeeded}`},
                ].map(({label,val})=>(
                  <div key={label} style={{background:T.surface,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                    <div style={{fontSize:".62rem",opacity:.4,letterSpacing:".08em",marginBottom:4}}>{label}</div>
                    <div style={{fontSize:".88rem",fontWeight:600,color:T.accent}}>{val}</div>
                  </div>
                ))}
              </div>
              {/* 手动模式：存入按钮 */}
              {isManual&&(
                showYearDeposit
                  ? <div style={{display:"flex",gap:8,marginTop:4}} onClick={e=>e.stopPropagation()}>
                      <input className="fi" type="number" placeholder="本次存入金额" autoFocus value={yearDepositAmt} onChange={e=>setYearDepositAmt(e.target.value)} style={{flex:1,padding:"9px 12px",fontSize:".9rem"}}/>
                      <button style={{padding:"9px 14px",background:T.accent,color:"#fff",border:"none",borderRadius:12,cursor:"pointer",fontSize:".82rem",fontWeight:500}} onClick={()=>{
                        const amt=parseFloat(yearDepositAmt);
                        if(!amt||amt<=0) return;
                        const entry={id:Date.now(), type:"expense", amount:amt, category:"储蓄", note:"年度目标储蓄", date:new Date().toISOString().slice(0,10), yearGoalManual:true};
                        upd({entries:[entry,...data.entries]});
                        setYearDepositAmt(""); setShowYearDeposit(false);
                      }}>确认</button>
                      <button style={{padding:"9px 12px",background:"none",border:`1px solid ${T.text}15`,borderRadius:12,cursor:"pointer",fontSize:".82rem",opacity:.5,color:T.text}} onClick={()=>{setShowYearDeposit(false);setYearDepositAmt("");}}>取消</button>
                    </div>
                  : <button className="gab" style={{width:"100%",textAlign:"center"}} onClick={()=>setShowYearDeposit(true)}>＋ 本次存入</button>
              )}
            </div>;
          })() : (
            <button className="ib" style={{width:"100%",textAlign:"center",marginBottom:20,padding:"14px"}} onClick={()=>{setYearGoalForm({target:"",items:[],initialSaved:"",mode:"auto"});setShowYearGoal(true);}}>📅 设定年度储蓄目标</button>
          )}
          {!data.goals?.length&&<div className="empty" style={{paddingTop:80}}>还没有目标，点 ＋ 开始攒第一个愿望</div>}
          {(data.goals||[]).map((g)=>{
            const tgt=parseFloat(g.target),saved=parseFloat(g.saved)||0;
            const pct=Math.min(100,(saved/tgt)*100),done=saved>=tgt;
            const today2=new Date(); let monthly=null;
            if(!done&&g.deadline){const dl=new Date(g.deadline);const ms=(dl.getFullYear()-today2.getFullYear())*12+(dl.getMonth()-today2.getMonth());if(ms>0)monthly=((tgt-saved)/ms).toFixed(2);}
            const cardEmoji=g.emoji||"🌟";
            const cardBg=g.bgImage?`url(${g.bgImage}) center/cover`:g.color||T.surface;
            const isEditing=editGoalId===g.id;
            return <div key={g.id} className="gc" style={{background:cardBg,border:g.bgImage?"none":"1px solid "+T.text+"08"}}>
              {g.bgImage&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.32)",borderRadius:24,zIndex:0}}/>}
              <div style={{position:"relative",zIndex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div className="gn" style={{color:g.bgImage?"#fff":T.text}}>{g.name}{done&&<span className="bdg">✓ 达成</span>}</div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:"1.6rem",lineHeight:1}}>{cardEmoji}</span>
                    <button onClick={()=>setEditGoalId(isEditing?null:g.id)} style={{background:"none",border:`1px solid ${g.bgImage?"rgba(255,255,255,.3)":T.text+"20"}`,borderRadius:8,padding:"3px 8px",fontSize:".65rem",cursor:"pointer",color:g.bgImage?"#fff":T.text,opacity:.7}}>装扮</button>
                  </div>
                </div>
                {g.deadline&&<div className="gm" style={{color:g.bgImage?"rgba(255,255,255,.7)":""}}>目标日期：{g.deadline}</div>}
                {isEditing&&<div style={{background:g.bgImage?"rgba(0,0,0,.4)":T.bg,borderRadius:14,padding:"12px 14px",marginBottom:12,backdropFilter:"blur(8px)"}}>
                  <div style={{fontSize:".62rem",opacity:.5,letterSpacing:".12em",textTransform:"uppercase",marginBottom:8,color:g.bgImage?"#fff":""}}>表情</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                    {["🌟","🎯","🎀","🌸","🌈","💫","🦋","🍀","🎸","✈️","💻","👑","🏖","🎨","🐾","🌙","⭐","🎊"].map(e=>(
                      <button key={e} onClick={()=>updateGoalStyle(g.id,{emoji:e})} style={{fontSize:"1.3rem",background:g.emoji===e?T.accent+"40":"transparent",border:g.emoji===e?`1.5px solid ${T.accent}`:"1.5px solid transparent",borderRadius:10,padding:"4px 6px",cursor:"pointer"}}>{e}</button>
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
                      <input type="file" accept="image/*" style={{display:"none"}} onChange={ev=>{
                        const file=ev.target.files[0];
                        if(!file) return;
                        const reader=new FileReader();
                        reader.onload=e=>updateGoalStyle(g.id,{bgImage:e.target.result,color:""});
                        reader.readAsDataURL(file);
                        ev.target.value="";
                      }}/>
                    </label>
                    {g.bgImage&&<button onClick={()=>updateGoalStyle(g.id,{bgImage:"",color:""})} style={{background:"none",border:`1px solid ${T.text}20`,borderRadius:10,padding:"6px 10px",fontSize:".72rem",opacity:.5,cursor:"pointer",color:g.bgImage?"#fff":T.text}}>移除图片</button>}
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
          <div style={{
            fontFamily:"'Ma Shan Zheng',cursive",fontSize:"1.8rem",marginBottom:24,paddingTop:16,
            color:T.accent,fontWeight:400,display:"inline-block",
            background:data.bgImage?`rgba(255,255,255,0.55)`:'transparent',
            backdropFilter:data.bgImage?'blur(10px)':'',
            WebkitBackdropFilter:data.bgImage?'blur(10px)':'',
            borderRadius:data.bgImage?14:0,
            padding:data.bgImage?'4px 14px 4px 10px':0,
          }}>设置 ⚙️</div>

          {/* ── 记账设置 ── */}
          <div className="ss-t">记账设置</div>
          <div className="sc" style={{marginBottom:20}}>
            {[
              {
                icon:"📋", label:"记账模式",
                value:data.mode==="detailed"?"详细模式":"懒人模式",
                key:"mode",
              },
              {
                icon:"💰", label:"月度预算",
                value:data.budget>0?`¥${data.budget}`:"未设置",
                key:"budget",
              },
              {
                icon:"📊", label:"分类预算",
                value:(()=>{const n=Object.keys(data.catBudgets||{}).filter(k=>data.catBudgets[k]!=null).length;return n>0?`已设置 ${n} 项`:"自动分配";})(),
                key:"catBudget",
                disabled:!data.budget,
              },
              {
                icon:"🔄", label:"定期账单",
                value:(data.recurring?.length||0)>0?`${data.recurring.length} 项`:"未设置",
                key:"recurring",
              },
            ].map(({icon,label,value,key,disabled})=>(
              <div key={key} className="sr" style={{opacity:disabled?.35:1}}
                onClick={()=>!disabled&&upd({_settingPanel:key===data._settingPanel?null:key})}>
                <span style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                  <span style={{fontSize:"1.1rem",width:28,textAlign:"center"}}>{icon}</span>
                  <span style={{fontSize:".92rem"}}>{label}</span>
                </span>
                <span style={{display:"flex",alignItems:"center",gap:6,fontSize:".78rem",opacity:.5}}>
                  {value}
                  <span style={{fontSize:".75rem",opacity:.6,transform:data._settingPanel===key?"rotate(90deg)":"rotate(0deg)",transition:"transform .2s",display:"inline-block"}}>›</span>
                </span>
              </div>
            ))}
            {/* 展开面板 */}
            {data._settingPanel==="mode"&&<div style={{padding:"14px 0 4px",borderTop:`1px solid ${T.text}08`}}>
              <div className="mtog">
                <button className={`mtb${data.mode==="detailed"?" active":""}`} onClick={()=>upd({mode:"detailed"})}>详细模式</button>
                <button className={`mtb${data.mode==="simple"?" active":""}`} onClick={()=>upd({mode:"simple"})}>懒人模式</button>
              </div>
              <div style={{fontSize:".72rem",opacity:.35,marginTop:8}}>{data.mode==="detailed"?"🫐 细分九大类":"🥕 必需品 / 非必需品"}</div>
            </div>}
            {data._settingPanel==="budget"&&<div style={{padding:"14px 0 4px",borderTop:`1px solid ${T.text}08`}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,display:"flex",alignItems:"center",background:data.budget>0?`${T.accent}10`:T.bg,border:`1.5px solid ${data.budget>0?T.accent+"35":T.text+"12"}`,borderRadius:14,overflow:"hidden"}}>
                  <span style={{padding:"11px 10px 11px 14px",fontSize:".95rem",color:T.accent,opacity:.7,fontWeight:500}}>¥</span>
                  <input className="bi" type="number" placeholder="设定月度预算" value={budgetInput}
                    onChange={e=>setBudgetInput(e.target.value)}
                    style={{background:"transparent",border:"none",flex:1,padding:"11px 14px 11px 0",color:T.text,fontSize:".95rem",outline:"none"}}/>
                </div>
                <button className="sbt" onClick={()=>upd({budget:parseFloat(budgetInput)||0})} style={{borderRadius:14,padding:"11px 20px",whiteSpace:"nowrap"}}>保存</button>
              </div>
            </div>}
            {data._settingPanel==="catBudget"&&data.budget>0&&<div style={{padding:"14px 0 4px",borderTop:`1px solid ${T.text}08`}}>
              <div style={{fontSize:".72rem",opacity:.4,marginBottom:12}}>留空则自动按比例分配</div>
              {DETAILED_CATEGORIES.expense.map(c=>{
                const hasVal=data.catBudgets?.[c]!=null;
                return <div key={c} className="sr">
                  <span style={{fontSize:".85rem",flex:1,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:"1.1rem"}}>{ICONS[c]}</span><span>{c}</span>
                  </span>
                  <div style={{display:"flex",alignItems:"center",background:hasVal?`${T.accent}12`:T.bg,border:`1.5px solid ${hasVal?T.accent+"40":T.text+"12"}`,borderRadius:12,overflow:"hidden"}}>
                    <span style={{padding:"6px 6px 6px 10px",fontSize:".78rem",color:hasVal?T.accent:T.text,opacity:hasVal?1:.35,fontWeight:500}}>¥</span>
                    <input type="number" value={data.catBudgets?.[c]??""} placeholder={String(effectiveCatBudgets[c]||0)}
                      onChange={e=>{const v=parseFloat(e.target.value);upd({catBudgets:{...(data.catBudgets||{}),[c]:isNaN(v)?undefined:v}});}}
                      style={{width:72,background:"transparent",border:"none",padding:"6px 10px 6px 0",fontSize:".88rem",color:hasVal?T.accent:T.text,outline:"none",textAlign:"right",fontWeight:hasVal?600:400}}/>
                  </div>
                </div>;
              })}
              <button onClick={()=>upd({catBudgets:{}})} style={{marginTop:12,background:`${T.accent}10`,border:`1px solid ${T.accent}25`,borderRadius:10,padding:"7px 16px",fontSize:".72rem",color:T.accent,cursor:"pointer",fontWeight:500}}>↺ 重置为自动分配</button>
            </div>}
            {data._settingPanel==="recurring"&&<div style={{padding:"14px 0 4px",borderTop:`1px solid ${T.text}08`}}>
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
            </div>}
          </div>

          {/* ── 个性化 ── */}
          <div className="ss-t">个性化</div>
          <div className="sc" style={{marginBottom:20}}>
            {[
              {icon:"🎨", label:"主题配色", value:data.theme===-1?`跟随系统`:THEMES[data.theme]?.name||"", key:"theme"},
              {icon:"🖼", label:"背景图片", value:data.bgImage?"已设置":"未设置", key:"bgImage"},
              {icon:"➕", label:"按钮位置", value:{"left-top":"左上角","right-top":"右上角","left-middle":"左中","right-middle":"右中","left-bottom":"左下角","right-bottom":"右下角"}[data.fabPos||"right-bottom"], key:"fabPos"},
            ].map(({icon,label,value,key})=>(
              <div key={key} className="sr"
                onClick={()=>upd({_settingPanel:key===data._settingPanel?null:key})}>
                <span style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                  <span style={{fontSize:"1.1rem",width:28,textAlign:"center"}}>{icon}</span>
                  <span style={{fontSize:".92rem"}}>{label}</span>
                </span>
                <span style={{display:"flex",alignItems:"center",gap:6,fontSize:".78rem",opacity:.5}}>
                  {key==="theme"&&<span style={{width:10,height:10,borderRadius:"50%",background:data.theme===-1?(sysDark?THEMES[1].accent:THEMES[0].accent):THEMES[data.theme]?.accent,display:"inline-block"}}/>}
                  {key==="bgImage"&&data.bgImage&&<span style={{width:16,height:16,borderRadius:4,backgroundImage:`url(${data.bgImage})`,backgroundSize:"cover",display:"inline-block"}}/>}
                  {value}
                  <span style={{fontSize:".75rem",opacity:.6,transform:data._settingPanel===key?"rotate(90deg)":"rotate(0deg)",transition:"transform .2s",display:"inline-block"}}>›</span>
                </span>
              </div>
            ))}
            {/* 主题展开 */}
            {data._settingPanel==="theme"&&<div style={{padding:"14px 0 4px",borderTop:`1px solid ${T.text}08`}}>
              <div className="tds">
                <div className={`td${data.theme===-1?" active":""}`} style={{background:"linear-gradient(135deg,#fff 50%,#1a1a20 50%)",border:data.theme===-1?`3px solid ${T.accent}`:"3px solid transparent"}} onClick={()=>upd({theme:-1})} title="跟随系统"/>
                {THEMES.map((t,i)=><div key={i} className={`td${data.theme===i?" active":""}`} style={{background:t.accent}} onClick={()=>upd({theme:i})} title={t.name}/>)}
              </div>
              <div style={{fontSize:".65rem",opacity:.35,marginTop:8}}>{data.theme===-1?`跟随系统（当前：${sysDark?"深色":"浅色"}）`:THEMES[data.theme]?.name}</div>
            </div>}
            {/* 背景图展开 */}
            {data._settingPanel==="bgImage"&&<div style={{padding:"14px 0 4px",borderTop:`1px solid ${T.text}08`}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:data.bgImage?12:0}}>
                <label style={{background:T.accent+"14",border:`1.5px solid ${T.accent}35`,borderRadius:10,padding:"7px 14px",fontSize:".78rem",color:T.accent,cursor:"pointer",fontWeight:500}}>
                  🖼 {data.bgImage?"更换图片":"上传背景图"}
                  <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                    const file=e.target.files[0]; if(!file) return;
                    const reader=new FileReader();
                    reader.onload=ev=>upd({bgImage:ev.target.result});
                    reader.readAsDataURL(file); e.target.value="";
                  }}/>
                </label>
                {data.bgImage&&<button onClick={()=>upd({bgImage:"",bgOpacity:0.12})} style={{background:"none",border:`1px solid ${T.text}20`,borderRadius:10,padding:"7px 12px",fontSize:".78rem",opacity:.5,cursor:"pointer",color:T.text}}>移除</button>}
              </div>
              {data.bgImage&&<>
                <div style={{borderRadius:12,overflow:"hidden",marginBottom:10,height:72,position:"relative"}}>
                  <img src={data.bgImage} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  <div style={{position:"absolute",inset:0,background:`rgba(255,255,255,${1-(data.bgOpacity??0.12)})`,pointerEvents:"none"}}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:".68rem",opacity:.45,whiteSpace:"nowrap"}}>透明度</span>
                  <input type="range" min="0.04" max="0.55" step="0.01"
                    value={data.bgOpacity??0.12} onChange={e=>upd({bgOpacity:parseFloat(e.target.value)})}
                    style={{flex:1,accentColor:T.accent}}/>
                  <span style={{fontSize:".68rem",opacity:.45,minWidth:28}}>{Math.round((data.bgOpacity??0.12)*100)}%</span>
                </div>
              </>}
            </div>}
            {/* 按钮位置展开 */}
            {data._settingPanel==="fabPos"&&<div style={{padding:"14px 0 4px",borderTop:`1px solid ${T.text}08`}}>
              <div style={{position:"relative",width:110,height:190,margin:"0 auto 12px",border:`2px solid ${T.text}20`,borderRadius:18,background:T.bg,overflow:"hidden"}}>
                <div style={{position:"absolute",top:6,left:"50%",transform:"translateX(-50%)",width:28,height:5,background:T.text+"20",borderRadius:99}}/>
                <div style={{position:"absolute",bottom:5,left:"50%",transform:"translateX(-50%)",width:32,height:3,background:T.text+"20",borderRadius:99}}/>
                {[["left-top",{top:22,left:8}],["right-top",{top:22,right:8}],["left-middle",{top:"50%",left:8,transform:"translateY(-50%)"}],["right-middle",{top:"50%",right:8,transform:"translateY(-50%)"}],["left-bottom",{bottom:22,left:8}],["right-bottom",{bottom:22,right:8}]].map(([pos,style])=>(
                  <div key={pos} onClick={()=>upd({fabPos:pos})} style={{position:"absolute",...style,width:22,height:22,borderRadius:"50%",background:data.fabPos===pos?`linear-gradient(135deg,${T.accent},${T.accent}cc)`:T.text+"12",border:`1.5px solid ${data.fabPos===pos?T.accent+"80":T.text+"20"}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".6rem",color:data.fabPos===pos?"#fff":T.text+"50",fontWeight:700,transition:"all .2s",boxShadow:data.fabPos===pos?`0 2px 8px ${T.accent}50`:"none"}}>＋</div>
                ))}
              </div>
              <div style={{textAlign:"center",fontSize:".75rem",color:T.accent,fontWeight:600}}>
                {{"left-top":"左上角","right-top":"右上角","left-middle":"左侧中间","right-middle":"右侧中间","left-bottom":"左下角","right-bottom":"右下角"}[data.fabPos||"right-bottom"]}
              </div>
            </div>}
          </div>

          {/* ── 数据管理 ── */}
          <div className="ss-t">数据管理</div>
          <div className="sc" style={{marginBottom:20}}>
            {[
              {icon:"📥", label:"导入账单", value:"微信/支付宝", key:"import"},
              {icon:"📤", label:"导出账单", value:"CSV 格式", key:"export"},
              {icon:"📦", label:"备份数据", value:"全量 JSON", key:"backup"},
              {icon:"🔁", label:"恢复数据", value:"导入备份", key:"restore"},
              {icon:"🎉", label:"娱乐基金", value:`¥${(data.funFund||0).toFixed(2)}`, key:"funFund"},
            ].map(({icon,label,value,key})=>(
              <div key={key} className="sr"
                onClick={()=>upd({_settingPanel:key===data._settingPanel?null:key})}>
                <span style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                  <span style={{fontSize:"1.1rem",width:28,textAlign:"center"}}>{icon}</span>
                  <span style={{fontSize:".92rem"}}>{label}</span>
                </span>
                <span style={{display:"flex",alignItems:"center",gap:6,fontSize:".78rem",opacity:.5}}>
                  {value}
                  <span style={{fontSize:".75rem",opacity:.6,transform:data._settingPanel===key?"rotate(90deg)":"rotate(0deg)",transition:"transform .2s",display:"inline-block"}}>›</span>
                </span>
              </div>
            ))}
            {/* 备份展开 */}
            {data._settingPanel==="backup"&&<div style={{padding:"14px 0 4px",borderTop:`1px solid ${T.text}08`}}>
              <div style={{fontSize:".78rem",opacity:.45,marginBottom:12}}>
                将所有数据（账单、愿望、目标、个性化设置）打包为 JSON 文件保存到本地
              </div>
              <button className="ib" onClick={()=>{
                const backup = {
                  ...data,
                  _backupVersion: 1,
                  _backupTime: new Date().toISOString(),
                };
                // 移除临时 UI 状态
                delete backup._settingPanel;
                const json = JSON.stringify(backup, null, 2);
                const blob = new Blob([json], {type:"application/json"});
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Kachingy_备份_${new Date().toLocaleDateString("zh-CN").replace(/\//g,"-")}.json`;
                document.body.appendChild(a); a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}>
                📦 立即备份
              </button>
              <div style={{fontSize:".65rem",opacity:.3,marginTop:8}}>建议定期备份，清除浏览器数据前务必先备份</div>
            </div>}

            {/* 恢复展开 */}
            {data._settingPanel==="restore"&&<div style={{padding:"14px 0 4px",borderTop:`1px solid ${T.text}08`}}>
              <div style={{fontSize:".78rem",opacity:.45,marginBottom:12}}>
                选择之前导出的 JSON 备份文件，将完全恢复所有数据和设置
              </div>
              <label className="ib" style={{background:"#e07a9514",borderColor:"#e07a9530",color:"#d4688a"}}>
                🔁 选择备份文件
                <input type="file" accept=".json" style={{display:"none"}} onChange={e=>{
                  const file = e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => {
                    try {
                      const parsed = JSON.parse(ev.target.result);
                      // 验证是否是有效备份
                      if (!parsed.entries || !Array.isArray(parsed.entries)) {
                        alert("文件格式不正确，请选择 Kachingy 导出的备份文件");
                        return;
                      }
                      if (window.confirm(`确认恢复备份？
备份时间：${parsed._backupTime ? new Date(parsed._backupTime).toLocaleString("zh-CN") : "未知"}
包含 ${parsed.entries.length} 条账单记录

⚠️ 当前数据将被覆盖`)) {
                        // 清除临时字段
                        delete parsed._backupVersion;
                        delete parsed._backupTime;
                        delete parsed._settingPanel;
                        setData({...defaults(), ...parsed});
                        alert("✅ 恢复成功！");
                      }
                    } catch(err) {
                      alert("读取失败：" + err.message);
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = "";
                }}/>
              </label>
              <div style={{fontSize:".65rem",opacity:.3,marginTop:8}}>恢复后当前所有数据将被替换，操作不可撤销</div>
            </div>}

            {/* 导入展开 */}
            {data._settingPanel==="import"&&<div style={{padding:"14px 0 4px",borderTop:`1px solid ${T.text}08`}}>
              <div style={{fontSize:".78rem",opacity:.45,marginBottom:12}}>支持微信/支付宝导出的 xlsx/csv 格式账单</div>
              <label className="ib">
                {importing?"解析中…":"📂 选择账单文件"}
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} style={{display:"none"}} disabled={importing}/>
              </label>
              {importResult&&<div className={`ir${importResult.ok?" ok":" err"}`}>{importResult.ok?"✓ ":"✗ "}{importResult.msg}</div>}
            </div>}
            {/* 导出展开 */}
            {data._settingPanel==="export"&&<div style={{padding:"14px 0 4px",borderTop:`1px solid ${T.text}08`}}>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <select value={exportMonth==="all"?"all":exportMonth.slice(0,4)}
                  onChange={e=>{if(e.target.value==="all"){setExportMonth("all");}else{const months=[...new Set(data.entries.map(en=>en.date.slice(0,7)).filter(m=>m.startsWith(e.target.value)))].sort((a,b)=>b.localeCompare(a));setExportMonth(months[0]||e.target.value+"-01");}}}
                  style={{flex:1,background:T.bg,border:"none",borderRadius:12,padding:"8px 12px",fontSize:".85rem",color:T.text,outline:"none"}}>
                  <option value="all">全部</option>
                  {[...new Set(data.entries.map(e=>e.date.slice(0,4)))].sort((a,b)=>b.localeCompare(a)).map(y=><option key={y} value={y}>{y}年</option>)}
                </select>
                {exportMonth!=="all"&&<select value={exportMonth} onChange={e=>setExportMonth(e.target.value)} style={{flex:1,background:T.bg,border:"none",borderRadius:12,padding:"8px 12px",fontSize:".85rem",color:T.text,outline:"none"}}>
                  {[...new Set(data.entries.map(en=>en.date.slice(0,7)).filter(m=>m.startsWith(exportMonth.slice(0,4))))].sort((a,b)=>b.localeCompare(a)).map(m=><option key={m} value={m}>{m.slice(5)}月</option>)}
                </select>}
                <button className="ib" onClick={exportCSV} disabled={!data.entries.length} style={{opacity:data.entries.length?1:.4,whiteSpace:"nowrap"}}>导出</button>
              </div>
            </div>}
            {/* 娱乐基金展开 */}
            {data._settingPanel==="funFund"&&<div style={{padding:"14px 0 4px",borderTop:`1px solid ${T.text}08`}}>
              <div className="sr"><span style={{fontSize:".85rem",opacity:.5}}>每月初自动结算上月节余或超支</span></div>
              {data.budget>0&&<div className="sr"><span style={{fontSize:".78rem",opacity:.45}}>
                本月预算 ¥{data.budget}，已支出 ¥{totalExpense.toFixed(2)}，
                {data.budget-totalExpense>=0?`预计月底转入 ¥${(data.budget-totalExpense).toFixed(2)}`:`超支 ¥${Math.abs(data.budget-totalExpense).toFixed(2)}`}
              </span></div>}
              {(data.funFund||0)>0&&<button className="ib" style={{marginTop:12,background:"#d4688a18",borderColor:"#d4688a40",color:"#d4688a"}} onClick={()=>upd({funFund:0})}>清零基金</button>}
            </div>}
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

        {showAdd&&<div className="ov" onClick={e=>{if(e.target===e.currentTarget){setShowAdd(false);setOcrPreview(null);setShowNote(false);}}}>
          <div className="mo">
            <div className="mt">记一笔</div>
            <label style={{display:"flex",alignItems:"center",gap:10,background:T.accent+"12",border:`1.5px solid ${T.accent}30`,borderRadius:16,padding:"11px 16px",marginBottom:18,cursor:"pointer"}}>
              <span style={{fontSize:"1.2rem"}}>📷</span>
              <div style={{flex:1}}>
                <div style={{fontSize:".85rem",fontWeight:500,color:T.accent}}>识图记账</div>
                <div style={{fontSize:".65rem",opacity:.45,marginTop:1}}>上传支付截图自动识别金额</div>
              </div>
              {ocrLoading&&<span style={{fontSize:".75rem",opacity:.5}}>识别中…</span>}
              <input type="file" accept="image/*" style={{display:"none"}} onChange={handleOCR} disabled={ocrLoading}/>
            </label>
            {ocrPreview&&<img src={ocrPreview} style={{width:"100%",borderRadius:12,marginBottom:14,maxHeight:160,objectFit:"cover",opacity:.7}}/>}
            <div className="tt">
              <button className={`tb${form.type==="expense"?" active":""}`} onClick={()=>setForm(f=>({...f,type:"expense",category:""}))}>支出</button>
              <button className={`tb${form.type==="income"?" active":""}`} onClick={()=>setForm(f=>({...f,type:"income",category:""}))}>收入</button>
            </div>
            {/* 金额 — inputmode=decimal 直接弹数字键盘 */}
            <div className="fg">
              <div className="fl">金额</div>
              <div style={{display:"flex",alignItems:"center",background:T.bg,borderRadius:16,overflow:"hidden"}}>
                <span style={{
                  padding:"13px 4px 13px 16px",
                  fontSize:"1.4rem",fontWeight:600,
                  color:form.amount?T.accent:T.text,
                  opacity:form.amount?1:.28,
                  lineHeight:1,transition:"color .2s,opacity .2s",
                  fontFamily:"'Kaisei Opti',serif",
                }}>¥</span>
                <input
                  type="number" inputMode="decimal"
                  placeholder="0.00" value={form.amount}
                  onChange={e=>setForm(f=>({...f,amount:e.target.value}))}
                  autoFocus
                  style={{
                    flex:1,background:"transparent",border:"none",outline:"none",
                    padding:"13px 16px 13px 4px",
                    fontSize:"1.4rem",fontWeight:600,letterSpacing:".02em",
                    color:T.text,fontFamily:"system-ui,-apple-system,sans-serif",
                  }}
                />
              </div>
            </div>
            <div className="fg"><div className="fl">分类</div><div className="cg">{cats[form.type].map(c=><button key={c} className={`cbtn${form.category===c?" active":""}`} onClick={()=>setForm(f=>({...f,category:c}))}>{ICONS[c]} {c}</button>)}</div></div>
            {/* 日期 — 快捷今天/昨天 + 日期选择器 */}
            <div className="fg">
              <div className="fl">日期</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {[
                  {label:"今天", val:new Date().toISOString().slice(0,10)},
                  {label:"昨天", val:new Date(Date.now()-86400000).toISOString().slice(0,10)},
                ].map(({label,val})=>(
                  <button key={label} onClick={()=>setForm(f=>({...f,date:val}))}
                    style={{padding:"8px 14px",borderRadius:99,border:`1.5px solid ${form.date===val?T.accent:T.text+"15"}`,background:form.date===val?`${T.accent}18`:"transparent",color:form.date===val?T.accent:T.text,fontSize:".78rem",fontWeight:form.date===val?600:400,cursor:"pointer",transition:"all .15s",whiteSpace:"nowrap"}}>
                    {label}
                  </button>
                ))}
                <input className="fi" type="date" value={form.date}
                  onChange={e=>setForm(f=>({...f,date:e.target.value}))}
                  style={{flex:1,padding:"8px 12px",fontSize:".82rem"}}
                />
              </div>
            </div>
            {/* 备注 — 默认收起，点击展开 */}
            <div className="fg" style={{marginBottom:showNote?18:12}}>
              {!showNote
                ? <button onClick={()=>setShowNote(true)}
                    style={{background:"none",border:`1px dashed ${T.text}20`,borderRadius:12,padding:"9px 16px",width:"100%",textAlign:"left",fontSize:".78rem",color:T.text,opacity:.45,cursor:"pointer"}}>
                    ＋ 添加备注（可选）
                  </button>
                : <div style={{position:"relative"}}>
                    <div className="fl">备注</div>
                    <input className="fi" placeholder="备注内容" autoFocus value={form.note}
                      onChange={e=>setForm(f=>({...f,note:e.target.value}))}/>
                    {!form.note&&<button onClick={()=>setShowNote(false)}
                      style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",opacity:.3,cursor:"pointer",fontSize:".9rem",color:T.text}}>×</button>}
                  </div>
              }
            </div>
            {form.type==="expense"&&(data.funFund||0)>0&&(
              <div onClick={()=>setForm(f=>({...f,fromFunFund:!f.fromFunFund}))} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:form.fromFunFund?`${T.accent}14`:T.bg,border:`1.5px solid ${form.fromFunFund?T.accent+"40":T.text+"10"}`,borderRadius:16,padding:"12px 16px",marginBottom:16,cursor:"pointer",transition:"all .2s"}}>
                <div>
                  <div style={{fontSize:".85rem",fontWeight:500}}>🎉 从娱乐基金支付</div>
                  <div style={{fontSize:".68rem",opacity:.45,marginTop:2}}>当前余额 ¥{(data.funFund||0).toFixed(2)}</div>
                </div>
                <div style={{width:24,height:24,borderRadius:"50%",background:form.fromFunFund?T.accent:T.text+"15",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
                  {form.fromFunFund&&<span style={{color:"#fff",fontSize:".75rem",fontWeight:700}}>✓</span>}
                </div>
              </div>
            )}
            {(()=>{
              const disabled = !form.amount || !form.category;
              return <button className="abtn" onClick={addEntry}
                disabled={disabled}
                style={{opacity:disabled?.4:1,cursor:disabled?"not-allowed":"pointer",transition:"opacity .2s"}}>
                记 录
              </button>;
            })()}
          </div>
        </div>}

        {/* ── 编辑记录弹窗 ── */}
        {editEntry&&editForm&&<div className="ov" onClick={e=>{if(e.target===e.currentTarget){setEditEntry(null);setEditForm(null);}}}>
          <div className="mo">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
              <div className="mt" style={{margin:0}}>编辑记录</div>
              <button onClick={()=>{if(window.confirm("确认删除这笔记录？")){delEntry(editEntry.id);setEditEntry(null);setEditForm(null);}}}
                style={{background:"#e07a9514",border:"1px solid #e07a9530",borderRadius:10,padding:"6px 12px",fontSize:".75rem",color:"#d4688a",cursor:"pointer",fontWeight:500}}>
                🗑 删除
              </button>
            </div>
            {/* 支出/收入切换 */}
            <div className="tt">
              <button className={`tb${editForm.type==="expense"?" active":""}`} onClick={()=>setEditForm(f=>({...f,type:"expense",category:""}))}>支出</button>
              <button className={`tb${editForm.type==="income"?" active":""}`} onClick={()=>setEditForm(f=>({...f,type:"income",category:""}))}>收入</button>
            </div>
            {/* 金额 */}
            <div className="fg">
              <div className="fl">金额</div>
              <div style={{display:"flex",alignItems:"center",background:T.bg,borderRadius:16,overflow:"hidden"}}>
                <span style={{padding:"13px 4px 13px 16px",fontSize:"1.4rem",fontWeight:600,color:editForm.amount?T.accent:T.text,opacity:editForm.amount?1:.28,lineHeight:1,fontFamily:"'Kaisei Opti',serif"}}>¥</span>
                <input type="number" inputMode="decimal" autoFocus
                  value={editForm.amount} onChange={e=>setEditForm(f=>({...f,amount:e.target.value}))}
                  style={{flex:1,background:"transparent",border:"none",outline:"none",padding:"13px 16px 13px 4px",fontSize:"1.4rem",fontWeight:600,color:T.text}}/>
              </div>
            </div>
            {/* 分类 */}
            <div className="fg">
              <div className="fl">分类</div>
              <div className="cg">
                {cats[editForm.type].map(c=>(
                  <button key={c} className={`cbtn${editForm.category===c?" active":""}`}
                    onClick={()=>setEditForm(f=>({...f,category:c}))}>
                    {ICONS[c]} {c}
                  </button>
                ))}
              </div>
            </div>
            {/* 日期 */}
            <div className="fg">
              <div className="fl">日期</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {[{label:"今天",val:new Date().toISOString().slice(0,10)},{label:"昨天",val:new Date(Date.now()-86400000).toISOString().slice(0,10)}].map(({label,val})=>(
                  <button key={label} onClick={()=>setEditForm(f=>({...f,date:val}))}
                    style={{padding:"8px 14px",borderRadius:99,border:`1.5px solid ${editForm.date===val?T.accent:T.text+"15"}`,background:editForm.date===val?`${T.accent}18`:"transparent",color:editForm.date===val?T.accent:T.text,fontSize:".78rem",fontWeight:editForm.date===val?600:400,cursor:"pointer",whiteSpace:"nowrap"}}>
                    {label}
                  </button>
                ))}
                <input className="fi" type="date" value={editForm.date}
                  onChange={e=>setEditForm(f=>({...f,date:e.target.value}))}
                  style={{flex:1,padding:"8px 12px",fontSize:".82rem"}}/>
              </div>
            </div>
            {/* 备注 */}
            <div className="fg">
              <div className="fl">备注</div>
              <input className="fi" placeholder="可选" value={editForm.note}
                onChange={e=>setEditForm(f=>({...f,note:e.target.value}))}/>
            </div>
            {(()=>{
              const disabled = !editForm.amount || !editForm.category;
              return <button className="abtn" onClick={saveEditEntry}
                disabled={disabled}
                style={{opacity:disabled?.4:1,cursor:disabled?"not-allowed":"pointer"}}>
                保 存
              </button>;
            })()}
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
                  <button key={e} onClick={()=>setGoalForm(f=>({...f,emoji:e}))} style={{fontSize:"1.2rem",background:goalForm.emoji===e?T.accent+"30":"transparent",border:goalForm.emoji===e?`1.5px solid ${T.accent}`:"1.5px solid transparent",borderRadius:10,padding:"4px 6px",cursor:"pointer"}}>{e}</button>
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
            <button className="abtn" onClick={()=>{if(!goalForm.name||!goalForm.target)return;addGoal({name:goalForm.name,target:parseFloat(goalForm.target),saved:parseFloat(goalForm.saved)||0,deadline:goalForm.deadline,emoji:goalForm.emoji||"🌟",color:goalForm.color||""});setGoalForm({name:"",target:"",saved:"",deadline:"",emoji:"🌟",color:""});setShowAddGoal(false);}}>创 建</button>
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
            <button className="abtn" onClick={()=>{if(!recForm.name||!recForm.amount||!recForm.category)return;addRec({...recForm,amount:parseFloat(recForm.amount),day:parseInt(recForm.day)||1});setRecForm({name:"",type:"expense",amount:"",category:"",day:"1"});setShowRecurring(false);}}>添加</button>
          </div>
        </div>}

        {showYearGoal&&<div className="ov" onClick={e=>e.target===e.currentTarget&&setShowYearGoal(false)}>
          <div className="mo">
            <div className="mt">{data.yearGoal?"编辑年度储蓄目标":"设定年度储蓄目标"}</div>
            {/* 存入模式选择 */}
            <div className="fg">
              <div className="fl">存入方式</div>
              <div className="tt" style={{marginBottom:0}}>
                <button className={`tb${yearGoalForm.mode==="auto"?" active":""}`} onClick={()=>setYearGoalForm(f=>({...f,mode:"auto"}))}>🤖 每月自动扣除</button>
                <button className={`tb${yearGoalForm.mode==="manual"?" active":""}`} onClick={()=>setYearGoalForm(f=>({...f,mode:"manual"}))}>✋ 手动记录</button>
              </div>
              <div style={{fontSize:".68rem",opacity:.35,marginTop:8}}>
                {yearGoalForm.mode==="auto"?"每月1号自动生成固定储蓄记录":"每次存钱后手动点「本次存入」，金额可不同"}
              </div>
            </div>
            <div className="fg">
              <div className="fl">年度储蓄总额（基础）</div>
              <input className="fi" type="number" placeholder="如：10000" value={yearGoalForm.target} onChange={e=>setYearGoalForm(f=>({...f,target:e.target.value}))} autoFocus/>
            </div>
            {/* 开始前已存金额 */}
            <div className="fg">
              <div className="fl">开始前已存金额（可填 0）</div>
              <input className="fi" type="number" placeholder="使用 Kachingy 之前已存入的金额" value={yearGoalForm.initialSaved} onChange={e=>setYearGoalForm(f=>({...f,initialSaved:e.target.value}))}/>
              <div style={{fontSize:".68rem",opacity:.35,marginTop:6}}>这笔金额会计入进度，但不生成支出记录</div>
            </div>
            <div className="fg">
              <div className="fl">大额计划支出（可选，累计添加）</div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input className="fi" placeholder="名称，如：电脑" value={yearGoalItem.name} onChange={e=>setYearGoalItem(f=>({...f,name:e.target.value}))} style={{flex:2}}/>
                <input className="fi" type="number" placeholder="金额" value={yearGoalItem.amount} onChange={e=>setYearGoalItem(f=>({...f,amount:e.target.value}))} style={{flex:1}}/>
                <button onClick={()=>{if(!yearGoalItem.name||!yearGoalItem.amount)return;setYearGoalForm(f=>({...f,items:[...f.items,yearGoalItem]}));setYearGoalItem({name:"",amount:""});}} style={{padding:"0 14px",background:T.accent,color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontSize:"1.1rem"}}>＋</button>
              </div>
              {yearGoalForm.items.map((item,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:".78rem",padding:"4px 8px",background:T.bg,borderRadius:8,marginBottom:4}}>
                  <span>{item.name} ¥{item.amount}</span>
                  <button onClick={()=>setYearGoalForm(f=>({...f,items:f.items.filter((_,j)=>j!==i)}))} style={{background:"none",border:"none",opacity:.4,cursor:"pointer",color:T.text}}>×</button>
                </div>
              ))}
            </div>
            {yearGoalForm.target&&(()=>{
              const base=parseFloat(yearGoalForm.target)||0;
              const extra=yearGoalForm.items.reduce((s,i)=>s+parseFloat(i.amount||0),0);
              const total=base+extra;
              const initSaved=parseFloat(yearGoalForm.initialSaved)||0;
              const remaining=Math.max(0,total-initSaved);
              const monthly=remaining/12;
              return <div style={{background:`${T.accent}12`,borderRadius:12,padding:"12px 14px",marginBottom:16,fontSize:".82rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{opacity:.5}}>年度总目标</span><span style={{fontWeight:600}}>¥{total.toFixed(0)}</span></div>
                {initSaved>0&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{opacity:.5}}>已存（开始前）</span><span style={{fontWeight:600}}>¥{initSaved.toFixed(0)}</span></div>}
                <div style={{display:"flex",justifyContent:"space-between"}}><span style={{opacity:.5}}>{yearGoalForm.mode==="auto"?"每月自动存入":"建议月存"}</span><span style={{fontWeight:600,color:T.accent}}>¥{monthly.toFixed(0)}</span></div>
              </div>;
            })()}
            <button className="abtn" onClick={()=>{
              if(!yearGoalForm.target) return;
              const base=parseFloat(yearGoalForm.target)||0;
              const extra=yearGoalForm.items.reduce((s,i)=>s+parseFloat(i.amount||0),0);
              const total=base+extra;
              const initSaved=parseFloat(yearGoalForm.initialSaved)||0;
              const remaining=Math.max(0,total-initSaved);
              upd({yearGoal:{total,monthly:(remaining/12).toFixed(2),items:yearGoalForm.items,base,initialSaved:initSaved,mode:yearGoalForm.mode}});
              setYearGoalForm({target:"",items:[],initialSaved:"",mode:"auto"});
              setYearGoalItem({name:"",amount:""});
              setShowYearGoal(false);
            }}>确认设定</button>
          </div>
        </div>}
      </div>
    </>
  );
}
