import React, { useState } from 'react'
import ExcelReader from './components/ExcelReader'
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

function App() {
  const [data, setData] = useState(() => {
    // 1. Try URL Hash first (priority for sharing)
    try {
      const hash = window.location.hash.substring(1);
      if (hash) {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(hash))));
        if (Array.isArray(decoded) && decoded.length > 0) {
          console.log("Loaded data from URL hash:", decoded.length);
          return decoded;
        }
      }
    } catch (e) {
      console.warn("Failed to parse URL hash data", e);
    }

    // 2. Try LocalStorage
    try {
      const saved = localStorage.getItem('hiyari_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log("Loaded data from localStorage:", parsed.length);
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to parse localStorage data", e);
    }

    return [];
  });

  const handleDataUpload = (uploadedData) => {
    setData(uploadedData);
    try {
      localStorage.setItem('hiyari_data', JSON.stringify(uploadedData));
    } catch (e) {
      console.error("Failed to save to localStorage (data might be too large)", e);
    }
  };

  const handleClearData = () => {
    setData([]);
    localStorage.removeItem('hiyari_data');
    window.location.hash = '';
  };

  // If data exists, render the full Dashboard
  if (data.length > 0) {
    return (
      <ErrorBoundary>
        <Dashboard data={data} onClear={handleClearData} />
      </ErrorBoundary>
    )
  }

  // Otherwise, render the Landing / Upload Page
  return (
    <div className="landing-page">
      <header className="app-header">
        <h1>Hiyari Hatto Visualization</h1>
        <p>Upload your Excel report to analyze safety data.</p>
      </header>

      <main className="landing-main">
        <ExcelReader onDataUpload={handleDataUpload} />
      </main>

      <footer className="api-footer">
        <p>&copy; 2026 Construction Safety AI</p>
      </footer>

      {/* Inline styles for Landing Page to avoid conflicts with Dashboard CSS */}
      <style>{`
        .landing-page {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          text-align: center;
        }
        .landing-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        .app-header h1 {
            color: #1e293b;
            margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  )
}

export default App
