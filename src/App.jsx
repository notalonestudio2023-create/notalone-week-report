// src/App.jsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import ReportPage from './pages/ReportPage';
import './index.css';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* 品牌週報頁面：yoursite.github.io/notalone-report/#/brand/喬科國際教育 */}
        <Route path="/brand/:brandId" element={<ReportPage />} />
        {/* 首頁導向（可之後加品牌列表） */}
        <Route path="/" element={
          <div className="loading-screen">
            <div className="loading-logo">定然</div>
            <p className="loading-sub">請使用品牌專屬連結查看週報</p>
          </div>
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
}
