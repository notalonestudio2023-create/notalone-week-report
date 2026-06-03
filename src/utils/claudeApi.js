// src/utils/claudeApi.js
// 呼叫 Claude API 產出廣告優化建議

const ANTHROPIC_API_KEY = process.env.REACT_APP_ANTHROPIC_API_KEY;

// 成效標準表（給 Claude 參考）
const STANDARDS_CONTEXT = `
廣告成效評估標準表：
- 互動訊息（Messenger 對話）：卓越 ≤$50 / 標準 $50-100 / 警示 $100-150 / 急救 >$150
- 潛在顧客表單（Lead Form）：卓越 ≤$50 / 標準 $50-100 / 警示 $100-150 / 急救 >$150
- FB 追蹤廣告：卓越 ≤$5 / 標準 $5-10 / 警示 $10-25 / 急救 >$25
- IG 追蹤廣告：卓越 ≤$5 / 標準 $5-10 / 警示 $10-25 / 急救 >$25
- 點擊詢問廣告：卓越 ≤$5 / 標準 $5-15 / 警示 $15-33 / 急救 >$33
`;

export const generateRecommendations = async ({ brandName, period, adData, socialData }) => {
  const adSummary = adData.map(a =>
    `${a.type}：花費 $${a.spend}、成果 ${a.result} 次、成本 $${a.cost}/次、評級${a.label}`
  ).join('\n');

  const prompt = `
你是一位台灣數位行銷分析師，正在為品牌「${brandName}」製作 ${period} 的社群廣告週報優化建議。

${STANDARDS_CONTEXT}

本週數據：
集客狀況：
- Facebook 追蹤：${socialData.fb} 人（增長 ${socialData.fbGrowth > 0 ? '+' : ''}${socialData.fbGrowth}）
- Instagram 追蹤：${socialData.ig} 人（增長 ${socialData.igGrowth > 0 ? '+' : ''}${socialData.igGrowth}）
- LINE OA 好友：${socialData.line} 人（增長 ${socialData.lineGrowth > 0 ? '+' : ''}${socialData.lineGrowth}）

廣告成效：
${adSummary}

請根據以上數據，產出 3 點具體優化建議。每點建議格式如下：
- 標題：簡短有力（含評級符號）
- 內容：具體說明問題、建議行動方向、預期效果（約 50-80 字）

請以 JSON 格式回覆，不要加任何其他文字：
{
  "suggestions": [
    {"title": "建議標題", "body": "建議內容"},
    {"title": "建議標題", "body": "建議內容"},
    {"title": "建議標題", "body": "建議內容"}
  ]
}
`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || '{}';

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean).suggestions || [];
  } catch {
    return [
      { title: '建議產出失敗', body: '請手動填寫優化建議。' },
      { title: '—', body: '—' },
      { title: '—', body: '—' }
    ];
  }
};
