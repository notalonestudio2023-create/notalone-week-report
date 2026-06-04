import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import {
  initGoogleApi, isSignedIn, signIn,
  getBrandData, getBrandFiles, fetchAndParseExcel, parseAdData, writeRecommendations
} from '../utils/googleApi';
import { generateRecommendations } from '../utils/claudeApi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const GradeBadge = ({ grade, label }) => {
  const cls = { excellent:'badge-excellent', ok:'badge-ok', warn:'badge-warn', danger:'badge-danger' }[grade] || 'badge-ok';
  return <span className={`badge ${cls}`}>{label}</span>;
};

export default function ReportPage() {
  const { brandId } = useParams();
  const [status, setStatus] = useState('init');
  const [allData, setAllData] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [adData, setAdData] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [activeLines, setActiveLines] = useState(new Set(['Messenger','Lead Form','追蹤FB','追蹤IG','點擊詢問']));

  useEffect(() => {
    initGoogleApi().then(() => {
      setStatus('need-login');
    }).catch(() => setStatus('error'));
  }, []);

  const handleLogin = async () => {
    setStatus('loading');
    try {
      await signIn();
      const data = await getBrandData(brandId);
      if (data.length === 0) { setStatus('empty'); return; }
      setAllData(data);
      setSelectedWeek(data[data.length - 1]['週期']);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
    }
  };

  useEffect(() => {
    if (!selectedWeek || allData.length === 0) return;
    (async () => {
      try {
        const files = await getBrandFiles(brandId);
        const match = files.find(f => f.name.includes(selectedWeek.slice(0,10)));
        if (match) {
          const rows = await fetchAndParseExcel(match.id);
          setAdData(parseAdData(rows));
        }
      } catch (e) { console.error(e); }
    })();
  }, [selectedWeek, brandId, allData]);

  const calcGrowth = (field) => {
    const idx = allData.findIndex(d => d['週期'] === selectedWeek);
    if (idx <= 0) return 0;
    return (parseInt(allData[idx][field] || 0)) - (parseInt(allData[idx - 1][field] || 0));
  };

  const handleGenerateSuggestions = async () => {
    const week = allData.find(d => d['週期'] === selectedWeek);
    if (!week) return;
    setGenerating(true);
    try {
      const suggestions = await generateRecommendations({
        brandName: brandId, period: selectedWeek, adData,
        socialData: {
          fb: parseInt(week['FB追蹤'] || 0), ig: parseInt(week['IG追蹤'] || 0), line: parseInt(week['LINE好友'] || 0),
          fbGrowth: calcGrowth('FB追蹤'), igGrowth: calcGrowth('IG追蹤'), lineGrowth: calcGrowth('LINE好友')
        }
      });
      await writeRecommendations(brandId, selectedWeek, suggestions.map(s => `${s.title}｜${s.body}`));
      const updated = await getBrandData(brandId);
      setAllData(updated);
    } catch (e) { console.error(e); }
    setGenerating(false);
  };

  const histLabels = allData.map(d => d['週期']?.slice(5) || '');
  const AD_SERIES = [
    { key: 'Messenger', color: '#A32D2D', dash: [] },
    { key: 'Lead Form', color: '#0F6E56', dash: [] },
    { key: '追蹤FB', color: '#854F0B', dash: [4,3] },
    { key: '追蹤IG', color: '#1B3A6B', dash: [4,3] },
    { key: '點擊詢問', color: '#3B6D11', dash: [4,3] }
  ];
  const histChartData = {
    labels: histLabels,
    datasets: AD_SERIES.map(s => ({
      label: s.key, data: allData.map(d => parseFloat(d[`成本_${s.key}`] || 0)),
      borderColor: s.color, backgroundColor: 'transparent', borderWidth: 2, borderDash: s.dash,
      pointRadius: 5, pointBackgroundColor: s.color, tension: 0.2, hidden: !activeLines.has(s.key),
      yAxisID: (s.key === 'Messenger' || s.key === 'Lead Form') ? 'yH' : 'yL'
    }))
  };
  const histOptions = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}：$${ctx.parsed.y}` } } },
    scales: {
      x: { ticks: { font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
      yH: { type: 'linear', position: 'left', ticks: { callback: v => '$'+v, font: { size: 11 } }, title: { display: true, text: '訊息/表單', font: { size: 10 } } },
      yL: { type: 'linear', position: 'right', min: 0, max: 20, ticks: { callback: v => '$'+v, font: { size: 11 } }, grid: { drawOnChartArea: false }, title: { display: true, text: '追蹤/點擊', font: { size: 10 } } }
    }
  };

  const currentWeek = allData.find(d => d['週期'] === selectedWeek) || {};
  const fbGrowth = calcGrowth('FB追蹤');
  const igGrowth = calcGrowth('IG追蹤');
  const lineGrowth = calcGrowth('LINE好友');
  const totalSpend = adData.reduce((s, a) => s + a.spend, 0);
  const totalReach = adData.reduce((s, a) => s + a.reach, 0);
  const suggestions = [
    { title: currentWeek['建議01']?.split('｜')[0] || '', body: currentWeek['建議01']?.split('｜')[1] || '' },
    { title: currentWeek['建議02']?.split('｜')[0] || '', body: currentWeek['建議02']?.split('｜')[1] || '' },
    { title: currentWeek['建議03']?.split('｜')[0] || '', body: currentWeek['建議03']?.split('｜')[1] || '' }
  ];
  const hasSuggestions = suggestions.some(s => s.title);

  if (status === 'init' || status === 'loading') return (
    <div className="loading-screen">
      <div className="loading-logo">定然</div>
      <p className="loading-sub">{status === 'loading' ? '資料載入中...' : '初始化中...'}</p>
    </div>
  );

  if (status === 'need-login') return (
    <div className="loading-screen">
      <div className="loading-logo">定然</div>
      <p className="loading-sub" style={{marginBottom:'1.5rem'}}>請登入 Google 帳號以查看週報</p>
      <button onClick={handleLogin} style={{
        padding:'10px 28px', background:'#fff', color:'#1B3A6B',
        border:'none', borderRadius:'8px', fontSize:'14px',
        fontWeight:'500', cursor:'pointer'
      }}>
        登入 Google 帳號
      </button>
    </div>
  );

  if (status === 'error') return (
    <div className="loading-screen">
      <div className="loading-logo">定然</div>
      <p className="loading-sub">資料載入失敗，請重新整理頁面</p>
    </div>
  );

  if (status === 'empty') return (
    <div className="loading-screen">
      <div className="loading-logo">定然</div>
      <p className="loading-sub">尚無週報資料</p>
    </div>
  );

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
            <button key={d['週期']} className={`week-btn ${d['週期'] === selectedWeek ? 'active' : ''}`}
              onClick={() => setSelectedWeek(d['週期'])}>
              {d['週期']?.slice(5)}
            </button>
          ))}
        </div>
      </header>

      <main className="report-body">
        <section className="report-section">
          <h2 className="sec-title">集客狀況</h2>
          <div className="metric-grid">
            {[
              { label: 'Facebook 追蹤', value: parseInt(currentWeek['FB追蹤'] || 0).toLocaleString(), growth: fbGrowth },
              { label: 'Instagram 追蹤', value: parseInt(currentWeek['IG追蹤'] || 0).toLocaleString(), growth: igGrowth },
              { label: 'LINE OA 好友', value: parseInt(currentWeek['LINE好友'] || 0).toLocaleString(), growth: lineGrowth }
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
        <section className="report-section">
          <h2 className="sec-title">廣告成效總表</h2>
          <div className="table-wrap">
            <table className="ad-table">
              <thead><tr><th>廣告類型</th><th className="num">花費(元)</th><th className="num">成果</th><th className="num">成本/次</th><th className="num">觸及</th><th>評級</th></tr></thead>
              <tbody>
                {adData.map(a => (
                  <tr key={a.type}>
                    <td>{a.type}</td><td className="num">${a.spend.toLocaleString()}</td>
                    <td className="num">{a.result.toLocaleString()}</td><td className="num">${a.cost}</td>
                    <td className="num">{a.reach.toLocaleString()}</td><td><GradeBadge grade={a.grade} label={a.label} /></td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>本週合計</td><td className="num">${totalSpend.toLocaleString()}</td>
                  <td className="num">—</td><td className="num">—</td><td className="num">{totalReach.toLocaleString()}</td><td></td>
                </tr>
              </tbody>
            </table>
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
          <div className="suggestions-header">
            <h2 className="sec-title" style={{ marginBottom: 0 }}>優化建議</h2>
            {!hasSuggestions && (
              <button className="gen-btn" onClick={handleGenerateSuggestions} disabled={generating}>
                {generating ? '產出中...' : '✦ 產出 AI 建議'}
              </button>
            )}
          </div>
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
