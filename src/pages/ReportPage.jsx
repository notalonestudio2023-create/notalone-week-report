import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { getBrandData, parseAdData } from '../utils/googleApi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const GradeBadge = ({ grade, label }) => {
  const cls = { excellent:'badge-excellent', ok:'badge-ok', warn:'badge-warn', danger:'badge-danger' }[grade] || 'badge-ok';
  return <span className={`badge ${cls}`}>{label}</span>;
};

export default function ReportPage() {
  const { brandId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allData, setAllData] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [activeLines, setActiveLines] = useState(new Set(['Messenger','Lead Form','追蹤FB','追蹤IG','點擊詢問']));

  useEffect(() => {
    getBrandData(brandId).then(data => {
      if (data.length === 0) { setError('尚無週報資料'); setLoading(false); return; }
      setAllData(data);
      setSelectedWeek(data[data.length - 1]['週期開始日']);
      setLoading(false);
    }).catch(e => { setError('資料載入失敗：' + e.message); setLoading(false); });
  }, [brandId]);

  const calcGrowth = (field) => {
    const idx = allData.findIndex(d => d['週期開始日'] === selectedWeek);
    if (idx <= 0) return 0;
    return (parseInt(allData[idx][field] || 0)) - (parseInt(allData[idx - 1][field] || 0));
  };

  const AD_SERIES = [
    { key: 'Messenger', color: '#A32D2D', dash: [] },
    { key: 'Lead Form', color: '#0F6E56', dash: [] },
    { key: '追蹤FB', color: '#854F0B', dash: [4,3] },
    { key: '追蹤IG', color: '#1B3A6B', dash: [4,3] },
    { key: '點擊詢問', color: '#3B6D11', dash: [4,3] }
  ];

  const histChartData = {
    labels: allData.map(d => d['週期開始日']?.slice(5) || ''),
    datasets: AD_SERIES.map(s => ({
      label: s.key, data: allData.map(d => parseFloat(d[`成本_${s.key}`] || 0)),
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
      yH: { type: 'linear', position: 'left', ticks: { callback: v => '$'+v, font: { size: 11 } }, title: { display: true, text: '訊息/表單', font: { size: 10 } } },
      yL: { type: 'linear', position: 'right', min: 0, max: 20, ticks: { callback: v => '$'+v, font: { size: 11 } }, grid: { drawOnChartArea: false }, title: { display: true, text: '追蹤/點擊', font: { size: 10 } } }
    }
  };

  if (loading) return <div className="loading-screen"><div className="loading-logo">定然</div><p className="loading-sub">資料載入中...</p></div>;
  if (error) return <div className="loading-screen"><div className="loading-logo">定然</div><p className="loading-sub">{error}</p></div>;

  const currentWeek = allData.find(d => d['週期開始日'] === selectedWeek) || {};
  const fbGrowth = calcGrowth('FB追蹤數');
  const igGrowth = calcGrowth('IG追蹤數');
  const lineGrowth = calcGrowth('LINE好友數');
  const totalSpend = 0;
  const totalReach = 0;
  const suggestions = [
    { title: currentWeek['建議01']?.split('｜')[0] || '', body: currentWeek['建議01']?.split('｜')[1] || '' },
    { title: currentWeek['建議02']?.split('｜')[0] || '', body: currentWeek['建議02']?.split('｜')[1] || '' },
    { title: currentWeek['建議03']?.split('｜')[0] || '', body: currentWeek['建議03']?.split('｜')[1] || '' }
  ];
  const hasSuggestions = suggestions.some(s => s.title);

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
          {allData.map(d => (
            <button key={d['週期開始日']} className={`week-btn ${d['週期開始日'] === selectedWeek ? 'active' : ''}`}
              onClick={() => setSelectedWeek(d['週期開始日'])}>
              {d['週期開始日']?.slice(5)}
            </button>
          ))}
        </div>
      </header>

      <main className="report-body">
        <section className="report-section">
          <h2 className="sec-title">集客狀況</h2>
          <div className="metric-grid">
            {[
              { label: 'Facebook 追蹤', value: parseInt(currentWeek['FB追蹤數'] || 0).toLocaleString(), growth: fbGrowth },
              { label: 'Instagram 追蹤', value: parseInt(currentWeek['IG追蹤數'] || 0).toLocaleString(), growth: igGrowth },
              { label: 'LINE OA 好友', value: parseInt(currentWeek['LINE好友數'] || 0).toLocaleString(), growth: lineGrowth }
            ].map(m => (
              <div key={m.label} className="metric-card">
                <p className="metric-label">{m.label}</p>
                <p className="metric-value">{m.value}</p>
                <p className={`metric-growth ${m.growth >= 0 ? 'pos' : 'neg'}`}>{m.growth >= 0 ? '+' : ''}{m.growth} 人</p>
              </div>
            ))}
          </div>
        </section>

        <div className="divider" />

        {allData.length > 1 && (
          <section className="report-section">
            <h2 className="sec-title">廣告成本歷史走勢（元/次）</h2>
            <div className="toggle-row">
              {AD_SERIES.map(s => (
                <button key={s.key} className={`toggle-btn ${activeLines.has(s.key) ? 'on' : ''}`}
                  style={activeLines.has(s.key) ? { background: s.color, borderColor: s.color } : {}}
                  onClick={() => { const next = new Set(activeLines); next.has(s.key) ? next.delete(s.key) : next.add(s.key); setActiveLines(next); }}>
                  {s.key}
                </button>
              ))}
            </div>
            <div className="chart-wrap"><Line data={histChartData} options={histOptions} /></div>
            <p className="chart-note">左軸：訊息 / 表單成本　右軸：追蹤 / 點擊成本</p>
          </section>
        )}

        <div className="divider" />

        <section className="report-section">
          <h2 className="sec-title" style={{ marginBottom: '0.85rem' }}>優化建議</h2>
          {hasSuggestions ? (
            <div className="suggestions-list">
              {suggestions.filter(s => s.title).map((s, i) => (
                <div key={i} className="suggestion-card">
                  <p className="suggestion-num">建議 0{i + 1}</p>
                  <p className="suggestion-title">{s.title}</p>
                  <p className="suggestion-body">{s.body}</p>
                </div>
              ))}
            </div>
          ) : (
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
