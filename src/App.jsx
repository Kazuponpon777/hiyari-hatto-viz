import React, { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import './App.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', background: '#ffe6e6', border: '1px solid red' }}>
          <h2>Application Crash</h2>
          <pre>{this.state.error && this.state.error.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}



// ============================================================
// 【設定】Google Sheets API の情報
// ============================================================
const GOOGLE_SHEETS_CONFIG = {
  apiKey: 'AIzaSyBL_YuwXfeuHWiN4Z1FrYdn14rAhW1Rhow',  // Google Sheets API キー
  spreadsheetId: '144WSgU8ZjN-aX79KRzYX2c0cFU49x2mVCT5bGKffKDk',
  sheetName: 'フォームの回答 1', // シート名（gid ではなく名前で指定）
};

/**
 * Google Sheets API v4 からデータを取得して、行データの配列に変換する
 */
async function fetchFromGoogleSheets() {
  const { apiKey, spreadsheetId, sheetName } = GOOGLE_SHEETS_CONFIG;

  if (!apiKey) {
    console.warn('Google Sheets API Key is not set.');
    return null;
  }

  const range = encodeURIComponent(sheetName);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Sheets API error ${response.status}: ${errorBody}`);
  }

  const json = await response.json();
  const values = json.values;

  if (!values || values.length < 2) {
    throw new Error('スプレッドシートにデータがありません');
  }

  // 1行目をヘッダー、それ以降をデータとしてオブジェクト配列に変換
  const headers = values[0];
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      const header = String(headers[j]).trim();
      if (header) {
        row[header] = (values[i][j] !== undefined && values[i][j] !== null)
          ? String(values[i][j])
          : '';
      }
    }
    rows.push(row);
  }

  return rows;
}

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [lastFetched, setLastFetched] = useState(null);

  // Auto-fetch from Google Sheets API
  const handleFetchSheets = async () => {
    try {
      setFetchError('');
      const rows = await fetchFromGoogleSheets();
      if (rows && rows.length > 0) {
        console.log(`Google Sheets API: ${rows.length} rows fetched`);
        setData(rows);
        setLastFetched(new Date().toLocaleString('ja-JP'));
        return true;
      }
    } catch (e) {
      console.error('Google Sheets API error:', e);
      setFetchError(`データの取得に失敗しました: ${e.message}`);
    }
    return false;
  };

  // Load data on mount: Google Sheets API
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await handleFetchSheets();
      setLoading(false);
    };

    loadData();
  }, []);

  // Refresh
  const handleRefresh = async () => {
    setLoading(true);
    await handleFetchSheets();
    setLoading(false);
  };

  // Loading
  if (loading) {
    return (
      <div className="landing-page">
        <header className="app-header"><h1>ヒヤリハット分析ダッシュボード</h1></header>
        <main className="landing-main">
          <div style={{ fontSize: '3rem' }}>⏳</div>
          <p style={{ color: '#64748b', marginTop: '1rem' }}>
            Google Sheets からデータを取得しています...
          </p>
        </main>
        <style>{`
          .landing-page { max-width: 800px; margin: 0 auto; padding: 2rem; min-height: 100vh; display: flex; flex-direction: column; text-align: center; }
          .landing-main { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; }
          .app-header h1 { color: #1e293b; margin-bottom: 0.5rem; }
        `}</style>
      </div>
    );
  }

  // Dashboard
  if (data.length > 0) {
    return (
      <ErrorBoundary>
        <Dashboard
          data={data}
          onRefresh={handleRefresh}
          lastFetched={lastFetched}
        />
      </ErrorBoundary>
    )
  }

  // No data - show error
  return (
    <div className="landing-page">
      <header className="app-header">
        <h1>ヒヤリハット分析ダッシュボード</h1>
        <p>データの取得に失敗しました</p>
      </header>
      <main className="landing-main">
        {fetchError && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
            padding: '1rem', marginBottom: '1.5rem', color: '#dc2626', maxWidth: '500px'
          }}>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>⚠️ {fetchError}</p>
            <button onClick={handleRefresh} style={{
              background: '#3b82f6', color: 'white', border: 'none',
              padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', marginTop: '0.5rem'
            }}>🔄 再試行</button>
          </div>
        )}
      </main>
      <footer className="api-footer"><p>&copy; 2026 ヒヤリハット集計システム</p></footer>
      <style>{`
        .landing-page { max-width: 800px; margin: 0 auto; padding: 2rem; min-height: 100vh; display: flex; flex-direction: column; text-align: center; }
        .landing-main { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; }
        .app-header h1 { color: #1e293b; margin-bottom: 0.5rem; }
      `}</style>
    </div>
  )
}

export default App
