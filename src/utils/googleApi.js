const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
const DRIVE_FOLDER_ID = process.env.REACT_APP_DRIVE_FOLDER_ID;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly';

let tokenClient = null;
let accessToken = null;

export const initGoogleApi = () => {
  return new Promise((resolve) => {
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.onload = () => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({});
        await window.gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
        await window.gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
        resolve();
      });
    };
    document.body.appendChild(gapiScript);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    document.body.appendChild(gisScript);
  });
};

export const signIn = () => {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) { reject(response); return; }
        accessToken = response.access_token;
        window.gapi.client.setToken({ access_token: accessToken });
        resolve();
      }
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
};

export const isSignedIn = () => !!accessToken;

export const getBrandData = async (brandName) => {
  const res = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${brandName}!A:Z`
  });
  const rows = res.result.values;
  if (!rows || rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
};

export const writeRecommendations = async (brandName, weekPeriod, suggestions) => {
  const data = await getBrandData(brandName);
  const rowIndex = data.findIndex(r => r['週期'] === weekPeriod);
  if (rowIndex === -1) return;
  const sheetRow = rowIndex + 2;
  await window.gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${brandName}!F${sheetRow}:H${sheetRow}`,
    valueInputOption: 'RAW',
    resource: { values: [[suggestions[0], suggestions[1], suggestions[2]]] }
  });
};

export const getBrandFolders = async () => {
  const res = await window.gapi.client.drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    orderBy: 'name'
  });
  return res.result.files;
};

export const getBrandFiles = async (brandName) => {
  const folders = await getBrandFolders();
  const folder = folders.find(f => f.name === brandName);
  if (!folder) return [];
  const res = await window.gapi.client.drive.files.list({
    q: `'${folder.id}' in parents and trashed=false`,
    fields: 'files(id, name, createdTime)',
    orderBy: 'createdTime desc'
  });
  return res.result.files;
};

export const fetchAndParseExcel = async (fileId) => {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const arrayBuffer = await res.arrayBuffer();
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
};

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
