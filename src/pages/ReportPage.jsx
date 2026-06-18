import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { getBrandData, getAdData, parseAdData, writeRecommendations, getBudgetData } from '../utils/googleApi';
import { generateRecommendations } from '../utils/claudeApi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const BASOTO = '巴索托集團';

export default function ReportPage() {
  const { brandId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allData, setAllData] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [adData, setAdData] = useState([]);
  const [adLoading, setAdLoading] = useState(true);
  const [adError, setAdError] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeLines, setActiveLines] = useState(new Set(['Messenger', 'Lead Form', '追蹤FB', '追蹤IG', '點擊詢問']));
  const aiTriggered = useRef(new Set());

  const AD_SERIES = [
    { key: 'Messenger', color: '#A32D2D', dash: [] },
    { key: 'Lead Form', color: '#0F6E56', dash: [] },
    { key: '追蹤FB',   color: '#854F0B', dash: [4, 3] },
    { key: '追蹤IG',   color: '#1B3A6B', dash: [4, 3] },
    { key: '點擊詢問', color: '#3B6D11', dash: [4, 3] }
  ];

  useEffect(() => {
    setLoading(true);
    getBrandData(brandId).then(data => {
      if (!data || data.length === 0) { setError('尚無週報資料'); setLoading(false); return; }
      setAllData(data);
      setSelectedWeek(data[data.length - 1]['週期開始日']);
      setLoading(false);
    }).catch(e => { setError('資料載入失敗：' + e.message); setLoading(false); });
  }, [brandId]);

  useEffect(() => {
    if (!selectedWeek) return;
    setAdData([]);
    setAdError(null);
    setAdLoading(true);
    setBudgetData(null);
    const weekStart = selectedWeek.replace(/\//g, '-');
    getAdData(brandId, weekStart)
      .then(rows => { setAdData(parseAdData(rows)); setAdLoading(false); })
      .catch(e => { setAdError(e.message); setAdLoading(false); });
    getBudgetData(brandId, weekStart)
      .then(b => setBudgetData(b))
      .catch(() => setBudgetData(null));
  }, [selectedWeek, brandId]);

  useEffect(() => {
    if (adLoading) return;
    if (!selectedWeek || !allData.length) return;
    const currentIdx = allData.findIndex(d => d['週期開始日'] === selectedWeek);
    if (currentIdx < 0) return;
    const currentWeek = allData[currentIdx];
    const hasSuggestions = currentWeek['建議01'] || currentWeek['建議02'] || currentWeek['建議03'];
    if (hasSuggestions) return;
    const key = `${brandId}_${selectedWeek}`;
    if (aiTriggered.current.has(key)) return;
    aiTriggered.current.add(key);
    triggerAI(currentIdx);
  }, [adLoading, selectedWeek, allData, brandId]);

  const triggerAI = async (currentIdx) => {
    setAiLoading(true);
    try {
      const currentData = allData[currentIdx];
      const prevData = currentIdx > 0 ? allData[currentIdx - 1] : null;
      const isBasoto = brandId === BASOTO;
      const weekStart = currentData['週期開始日'].replace(/\//g, '-');
      const weekEnd = (currentData['週期結束日'] || '').replace(/\//g, '-');

      const socialData = isBasoto ? {
        fb: 0, ig: parseInt(currentData['GROUP IG追蹤數'] || 0),
        line: parseInt(currentData['LINE好友數'] || 0)
      } : {
        fb: parseInt(currentData['FB追蹤數'] || 0),
        ig: parseInt(currentData['IG追蹤數'] || 0),
        line: parseInt(currentData['LINE好友數'] || 0)
      };

      const prevSocialData = prevData ? (isBasoto ? {
        fb: 0, ig: parseInt(prevData['GROUP IG追蹤數'] || 0),
        line: parseInt(prevData['LINE好友數'] || 0)
      } : {
        fb: parseInt(prevData['FB追蹤數'] || 0),
        ig: parseInt(prevData['IG追蹤數'] || 0),
        line: parseInt(prevData['LINE好友數'] || 0)
      }) : null;

      const result = await generateRecommendations({
        brandName: brandId, weekStart, weekEnd, adData, socialData, prevSocialData
      });

      await writeRecommendations(brandId, weekStart, result);

      setAllData(prev => prev.map(d =>
        d['週期開始日'] === selectedWeek
          ? { ...d, 建議01: result[0], 建議02: result[1], 建議03: result[2] }
          : d
      ));
    } catch (e) {
      console.error('AI 建議產出失敗：', e.message);
    }
    setAiLoading(false);
  };

  const currentIdx = allData.findIndex(d => d['週期開始日'] === selectedWeek);
  const currentWeek = allData[currentIdx] || {};
  const prevWeek = currentIdx > 0 ? allData[currentIdx - 1] : null;
  const isBasoto = brandId === BASOTO;

  const calcGrowth = (field) => {
    if (currentIdx <= 0) return 0;
    return parseInt(currentWeek[field] || 0) - parseInt(prevWeek[field] || 0);
  };

  const metrics = isBasoto ? [
    { label: 'GROUP IG 追蹤', field: 'GROUP IG追蹤數' },
    { label: 'CAFFE IG 追蹤', field: 'CAFFE IG追蹤數' },
    { label: 'PIZZA IG 追蹤', field: 'PIZZA IG追蹤數' },
    { label: 'LINE OA 好友',  field: 'LINE好友數' }
  ] : [
    { label: 'Facebook 追蹤', field: 'FB追蹤數' },
    { label: 'Instagram 追蹤', field: 'IG追蹤數' },
    { label: 'LINE OA 好友',  field: 'LINE好友數' }
  ];

  const activeAdTypes = new Set(adData.map(a => a.type));
  const visibleSeries = AD_SERIES.filter(s => activeAdTypes.has(s.key));

  const histChartData = {
    labels: allData.map(d => (d['週期開始日'] || '').slice(5)),
    datasets: visibleSeries.map(s => ({
      label: s.key,
      data: allData.map(d => parseFloat(d[`成本_${s.key}`] || 0)),
      borderColor: s.color, backgroundColor: 'transparent', borderWidth: 2,
      borderDash: s.dash, pointRadius: 5, pointBackgroundColor: s.color, tension: 0.2,
      hidden: !activeLines.has(s.key),
      yAxisID: (s.key === 'Messenger' || s.key === 'Lead Form') ? 'yH' : 'yL'
    }))
  };

  const histOptions = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
      yH: { type: 'linear', position: 'left', ticks: { callback: v => '$' + v, font: { size: 11 } }, title: { display: true, text: '訊息/表單', font: { size: 10 } } },
      yL: { type: 'linear', position: 'right', min: 0, ticks: { callback: v => '$' + v, font: { size: 11 } }, grid: { drawOnChartArea: false }, title: { display: true, text: '追蹤/點擊', font: { size: 10 } } }
    }
  };

  const suggestions = [
    currentWeek['建議01'] || '',
    currentWeek['建議02'] || '',
    currentWeek['建議03'] || ''
  ];
  const hasSuggestions = suggestions.some(s => s);

  if (loading) return <div className="loading-screen"><div className="loading-logo">定然</div><p className="loading-sub">資料載入中...</p></div>;
  if (error) return <div className="loading-screen"><div className="loading-logo">定然</div><p className="loading-sub">{error}</p></div>;

  return (
    <div className="report-root">
      <header className="report-header">
        <div className="header-inner">
          <div className="header-brand">
            <span className="header-logo">定然</span>
            <span className="header-logo-en">NOTALONE DIGITAL PR</span>
          </div>
          <div className="header-meta">
            <p className="header-brand-name">{brandId}</p>
            <p className="header-period">社群廣告週報</p>
          </div>
        </div>
        <div className="week-selector">
          <select
            className="week-select"
            value={selectedWeek || ''}
            onChange={e => setSelectedWeek(e.target.value)}>
            {[...allData].reverse().map(d => {
              const start = (d['週期開始日'] || '').replace(/-/g, '/');
              const end = (d['週期結束日'] || '').replace(/-/g, '/');
              return (
                <option key={d['週期開始日']} value={d['週期開始日']}>
                  {start} – {end}
                </option>
              );
            })}
          </select>
        </div>
      </header>

      <main className="report-body">

        {/* 區塊一：月預算總覽 */}
        {budgetData && (
          <>
            <section className="report-section">
              <h2 className="sec-title">月預算總覽</h2>
              <div className="budget-header">
                <div>
                  <p className="budget-date">生效日：{budgetData.effectiveDate?.replace(/-/g, '/')}</p>
                </div>
                <div className="budget-total">
                  <p className="budget-total-label">月廣告預算</p>
                  <p className="budget-total-value">${budgetData.total?.toLocaleString()}</p>
                </div>
              </div>
              <div className="budget-table-wrap">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>平台</th>
                      <th>廣告目標</th>
                      <th>轉換目標</th>
                      <th>走期</th>
                      <th>受眾區域</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetData.items?.map((item, i) => (
                      <tr key={i}>
                        <td>{item.platform}</td>
                        <td>{item.goal}</td>
                        <td>{item.conv}</td>
                        <td style={{ fontSize: '11px', color: 'var(--brand-sub)' }}>{item.period}</td>
                        <td style={{ fontSize: '11px', color: 'var(--brand-sub)' }}>{item.area}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <div className="divider" />
          </>
        )}

        {/* 區塊二：集客狀況 */}
        <section className="report-section">
          <h2 className="sec-title">集客狀況</h2>
          <div className="metric-grid">
            {metrics.map(m => {
              const growth = calcGrowth(m.field);
              return (
                <div key={m.label} className="metric-card">
                  <p className="metric-label">{m.label}</p>
                  <p className="metric-value">{parseInt(currentWeek[m.field] || 0).toLocaleString()}</p>
                  <p className={`metric-growth ${growth >= 0 ? 'pos' : 'neg'}`}>
                    {growth >= 0 ? '+' : ''}{growth} 人
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <div className="divider" />

        {/* 區塊三：廣告成效 */}
        <section className="report-section">
          <h2 className="sec-title">本週廣告成效</h2>
          {adLoading && <p className="empty-hint">載入廣告資料中...</p>}
          {adError && <p className="empty-hint">本週廣告資料尚未上傳</p>}
          {!adLoading && !adError && adData.length === 0 && (
            <p className="empty-hint">本週無廣告投放資料</p>
          )}
          {!adLoading && adData.length > 0 && (
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>廣告類型</th>
                    <th>花費</th>
                    <th>成果</th>
                    <th>每次成本</th>
                    <th>觸及人數</th>
                    <th>評級</th>
                  </tr>
                </thead>
                <tbody>
                  {adData.map(a => (
                    <tr key={a.type}>
                      <td>{a.type}</td>
                      <td>${a.spend.toLocaleString()}</td>
                      <td>{a.result.toLocaleString()}</td>
                      <td>${a.cost}</td>
                      <td>{a.reach.toLocaleString()}</td>
                      <td><span className={`badge badge-${a.grade}`}>{a.label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="divider" />

        {allData.length > 1 && visibleSeries.length > 0 && (
          <section className="report-section">
            <h2 className="sec-title">廣告成本歷史走勢（元/次）</h2>
            <div className="toggle-row">
              {visibleSeries.map(s => (
                <button key={s.key}
                  className={`toggle-btn ${activeLines.has(s.key) ? 'on' : ''}`}
                  style={activeLines.has(s.key) ? { background: s.color, borderColor: s.color } : {}}
                  onClick={() => {
                    const next = new Set(activeLines);
                    next.has(s.key) ? next.delete(s.key) : next.add(s.key);
                    setActiveLines(next);
                  }}>
                  {s.key}
                </button>
              ))}
            </div>
            <div className="chart-wrap"><Line data={histChartData} options={histOptions} /></div>
            <p className="chart-note">左軸：訊息 / 表單成本　右軸：追蹤 / 點擊成本</p>
          </section>
        )}

        <div className="divider" />

        {/* 優化建議 */}
        <section className="report-section">
          <h2 className="sec-title">優化建議</h2>
          {aiLoading && <p className="empty-hint">🤖 AI 分析中，請稍候...</p>}
          {!aiLoading && hasSuggestions && (
            <div className="suggestions-list">
              {suggestions.map((s, i) => s ? (
                <div key={i} className="suggestion-card">
                  <p className="suggestion-num">建議 0{i + 1}</p>
                  <p className="suggestion-body">{s}</p>
                </div>
              ) : null)}
            </div>
          )}
          {!aiLoading && !hasSuggestions && (
            <p className="empty-hint">尚未產出本週優化建議</p>
          )}
        </section>

        <footer className="report-footer">
          <p className="footer-en">NOTALONE DIGITAL PR</p>
          <p className="footer-slogan">閃閃發光的品牌來自價值的傳遞。</p>
        </footer>
      </main>
    </div>
  );
}
