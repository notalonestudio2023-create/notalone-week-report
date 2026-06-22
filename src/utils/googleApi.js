const API_KEY = 'AIzaSyAojmIBZM0lKf7_oAIlwk4Hp3JMKAaX00A';
const SPREADSHEET_ID = '1QRRjhqy06OvhcJnSS1NYaFFbLHn59vFN35nmIYFY2K0';
const PROXY_URL = 'https://script.google.com/macros/s/AKfycbxKCHpXCKT6S210HyYT718J9aZrfEZ-cBrctZdxP-ul1GUDZxz9bAeU_TFHdnybDuHW/exec';

const proxyFetch = async (body) => {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  return res.json();
};

const proxyGet = async (params) => {
  const query = Object.entries(params)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&');
  const res = await fetch(PROXY_URL + '?' + query, { redirect: 'follow' });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch(e) {
    console.error('proxyGet parse error:', text);
    return { success: false, error: 'parse error' };
  }
};

export const initGoogleApi = () => Promise.resolve();
export const signIn = () => Promise.resolve();
export const isSignedIn = () => true;

export const getBrandData = async (brandName) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(brandName)}!A:Z?key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const rows = data.values;
  if (!rows || rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
};

export const getAdData = async (brandName, weekStart) => {
  const data = await proxyFetch({ action: 'getAdData', brandName, weekStart });
  if (!data.success) throw new Error(data.error);
  return data.rows || [];
};

export const getBudgetData = async (brandName, weekStart) => {
  const data = await proxyFetch({ action: 'getBudgetData', brandName, weekStart });
  if (!data.success) throw new Error(data.error);
  return data.budget || null;
};

export const parseBudgetImage = async (brandName, weekStart) => {
  const data = await proxyGet({ action: 'parseBudgetImage', brandName, weekStart });
  if (!data.success) throw new Error(data.error);
  return data.budget || null;
};

export const clearBudgetData = async (brandName, effectiveDate) => {
  const data = await proxyGet({ action: 'clearBudgetData', brandName, effectiveDate });
  if (!data.success) throw new Error(data.error);
};

export const writeRecommendations = async (brandName, weekStart, suggestions) => {
  const data = await proxyFetch({ action: 'writeRecommendations', brandName, weekStart, suggestions });
  if (!data.success) throw new Error(data.error);
};

export const writeAdCache = async (brandName, weekStart, adData) => {
  const data = await proxyFetch({ action: 'writeAdCache', brandName, weekStart, adData });
  if (!data.success) throw new Error(data.error);
};

export const AD_TYPES = [
  { key: 'FB追蹤',  match: c => c.includes('追蹤') && c.includes('FB') },
  { key: 'IG追蹤',  match: c => c.includes('追蹤') && c.includes('IG') },
  { key: 'FB點擊',  match: c => c.includes('點擊') },
  { key: 'FB訊息',  match: c => c.includes('訊息') },
  { key: 'FB表單',  match: c => c.includes('表單') },
  { key: 'FB觸及',  match: c => c.includes('觸及') },
  { key: 'IG前台',  match: c => c.includes('Instagram 貼文：') },
];

const STANDARDS = {
  'FB追蹤':  { excellent: 5,  standard: 10,  warning: 25  },
  'IG追蹤':  { excellent: 5,  standard: 10,  warning: 25  },
  'IG互動':  { excellent: 5,  standard: 15,  warning: 33  },
  'FB點擊':  { excellent: 5,  standard: 15,  warning: 33  },
  'FB訊息':  { excellent: 50, standard: 100, warning: 150 },
  'FB表單':  { excellent: 50, standard: 100, warning: 150 },
  'FB觸及':  { excellent: 5,  standard: 15,  warning: 33  },
  'IG前台':  { excellent: 5,  standard: 15,  warning: 33  },
};

const getGrade = (type, cost) => {
  const std = STANDARDS[type];
  if (!std) return { grade: '—', label: '—' };
  if (cost <= std.excellent) return { grade: 'excellent', label: '🚀 卓越' };
  if (cost <= std.standard)  return { grade: 'ok',        label: '✅ 標準' };
  if (cost <= std.warning)   return { grade: 'warn',      label: '⚠️ 警示' };
  return { grade: 'danger', label: '‼️ 急救' };
};

// 依月預算判斷 IG前台 的實際類型
const resolveIgFrontType = (budgetData) => {
  if (!budgetData?.items) return 'IG追蹤';
  const igItem = budgetData.items.find(item =>
    (item.platform || '').includes('IG') || (item.platform || '').includes('ig')
  );
  if (!igItem) return 'IG追蹤';
  const conv = (igItem.conv || '').toLowerCase();
  if (conv.includes('互動')) return 'IG互動';
  return 'IG追蹤';
};

export const parseAdData = (rows, budgetData) => {
  const igFrontType = resolveIgFrontType(budgetData);
  const groups = {};

  rows.forEach(row => {
    const campaign = row['行銷活動名稱'] || '';
    const spend = parseFloat(row['花費金額 (TWD)'] || 0);
    const result = parseFloat(row['成果'] || 0);
    const reach = parseFloat(row['觸及人數'] || 0);

    let type = '其他';
    for (const { key, match } of AD_TYPES) {
      if (match(campaign)) {
        type = key === 'IG前台' ? igFrontType : key;
        break;
      }
    }

    if (!groups[type]) groups[type] = { spend: 0, result: 0, reach: 0 };
    groups[type].spend  += spend;
    groups[type].result += result;
    groups[type].reach  += reach;
  });

  return Object.entries(groups)
    .filter(([type]) => type !== '其他')
    .map(([type, d]) => {
      const cost = d.result > 0 ? Math.round((d.spend / d.result) * 10) / 10 : 0;
      return { type, spend: Math.round(d.spend), result: Math.round(d.result), cost, reach: Math.round(d.reach), ...getGrade(type, cost) };
    });
};
