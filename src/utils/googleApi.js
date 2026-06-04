const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const SPREADSHEET_ID = '1QRRjhqy06OvhcJnSS1NYaFFbLHn59vFN35nmIYFY2K0';
const DRIVE_FOLDER_ID = process.env.REACT_APP_DRIVE_FOLDER_ID;

// 公開讀取 Sheets，不需要登入
export const initGoogleApi = () => Promise.resolve();
export const signIn = () => Promise.resolve();
export const isSignedIn = () => true;

export const getBrandData = async (brandName) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(brandName)}!A:Z?key=AIzaSyAojmIBZM0IKf7_oAIlwk4Hp3JMKAaX00A`;
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

export const writeRecommendations = async (brandName, weekPeriod, suggestions) => {
  console.log('寫回功能需要授權，目前略過');
};

export const getBrandFolders = async () => [];
export const getBrandFiles = async () => [];
export const fetchAndParseExcel = async () => [];

const STANDARDS = {
  'Messenger': { excellent: 50, standard: 100, warning: 150 },
  'Lead Form': { excellent: 50, standard: 100, warning: 150 },
  '追蹤FB':    { excellent: 5,  standard: 10,  warning: 25  },
  '追蹤IG':    { excellent: 5,  standard: 10,  warning: 25  },
  '點擊詢問':  { excellent: 5,  standard: 15,  warning: 33  }
};

const getGrade = (type, cost) => {
  const std = STANDARDS[type];
  if (!std) return { grade: '—', label: '—' };
  if (cost <= std.excellent) return { grade: 'excellent', label: '🚀 卓越' };
  if (cost <= std.standard)  return { grade: 'ok',        label: '✅ 標準' };
  if (cost <= std.warning)   return { grade: 'warn',      label: '⚠️ 警示' };
  return { grade: 'danger', label: '‼️ 急救' };
};

export const parseAdData = (rows) => {
  const groups = {};
  rows.forEach(row => {
    const campaign = row['行銷活動名稱'] || '';
    const spend = parseFloat(row['花費金額 (TWD)'] || 0);
    const result = parseFloat(row['成果'] || 0);
    const reach = parseFloat(row['觸及人數'] || 0);
    let type = null;
    if (campaign.includes('訊息') || campaign.includes('Messenger')) type = 'Messenger';
    else if (campaign.includes('表單') || campaign.includes('Lead')) type = 'Lead Form';
    else if (campaign.includes('追蹤') && campaign.includes('FB')) type = '追蹤FB';
    else if (campaign.includes('追蹤') && campaign.includes('IG')) type = '追蹤IG';
    else if (campaign.includes('點擊') || campaign.includes('詢問')) type = '點擊詢問';
    else type = '其他';
    if (!groups[type]) groups[type] = { spend: 0, result: 0, reach: 0 };
    groups[type].spend  += spend;
    groups[type].result += result;
    groups[type].reach  += reach;
  });
  return Object.entries(groups).map(([type, d]) => {
    const cost = d.result > 0 ? Math.round((d.spend / d.result) * 10) / 10 : 0;
    return { type, spend: Math.round(d.spend), result: Math.round(d.result), cost, reach: Math.round(d.reach), ...getGrade(type, cost) };
  });
};
