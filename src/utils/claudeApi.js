// v2
const PROXY_URL = 'https://script.google.com/macros/s/AKfycbxKCHpXCKT6S210HyYT718J9aZrfEZ-cBrctZdxP-ul1GUDZxz9bAeU_TFHdnybDuHW/exec';

const STANDARDS_CONTEXT = `
廣告成效評估標準：
- 互動訊息（Messenger）：卓越 ≤$50 / 標準 $50-100 / 警示 $100-150 / 急救 >$150
- 潛在顧客表單（Lead Form）：卓越 ≤$50 / 標準 $50-100 / 警示 $100-150 / 急救 >$150
- FB 追蹤廣告：卓越 ≤$5 / 標準 $5-10 / 警示 $10-25 / 急救 >$25
- IG 追蹤廣告：卓越 ≤$5 / 標準 $5-10 / 警示 $10-25 / 急救 >$25
- 點擊詢問廣告：卓越 ≤$5 / 標準 $5-15 / 警示 $15-33 / 急救 >$33
`;

export const generateRecommendations = async ({
  brandName, weekStart, weekEnd, adData, socialData, prevSocialData
}) => {
  const hasAd = adData && adData.length > 0;

  const socialSummary = `
集客狀況（本週）：
- Facebook 追蹤：${socialData.fb.toLocaleString()} 人（較上週 ${prevSocialData ? (socialData.fb - prevSocialData.fb >= 0 ? '+' : '') + (socialData.fb - prevSocialData.fb) + ' 人' : '無前週資料'}）
- Instagram 追蹤：${socialData.ig.toLocaleString()} 人（較上週 ${prevSocialData ? (socialData.ig - prevSocialData.ig >= 0 ? '+' : '') + (socialData.ig - prevSocialData.ig) + ' 人' : '無前週資料'}）
- LINE OA 好友：${socialData.line.toLocaleString()} 人（較上週 ${prevSocialData ? (socialData.line - prevSocialData.line >= 0 ? '+' : '') + (socialData.line - prevSocialData.line) + ' 人' : '無前週資料'}）`.trim();

  const adSummary = hasAd
    ? adData.map(a => `${a.type}：花費 $${a.spend}、成果 ${a.result} 次、每次成本 $${a.cost}（${a.label}）`).join('\n')
    : '本週無廣告投放資料';

  const prompt = `你是定然數位公關的社群顧問，正在為品牌「${brandName}」撰寫 ${weekStart} 至 ${weekEnd} 的週報優化建議。建議對象是品牌客戶，語氣專業、正向、易讀。每月廣告預算固定，請勿建議調整預算金額。

${STANDARDS_CONTEXT}

${socialSummary}

廣告成效：
${adSummary}

請產出 3 點優化建議，格式規則如下：
- 建議01：概述本週與上週的集客數據差異，語氣正向，約 40-60 字
- 建議02：針對廣告成效最好或最值得延續的項目，給出具體可執行方向，約 50-70 字
- 建議03：針對成效待改善的項目或下週內容操作方向，給出具體建議，約 50-70 字

若本週無廣告資料，建議02與03改針對社群內容經營方向給建議。

請以 JSON 格式回覆，不要加任何其他文字：
{"suggestions":["建議01的完整內容","建議02的完整內容","建議03的完整內容"]}`;

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ prompt })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);

  try {
    const clean = data.text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return parsed.suggestions || ['', '', ''];
  } catch {
    return ['建議產出失敗，請稍後再試。', '', ''];
  }
};
