
import React, { useState } from 'react';
import * as XLSX from 'xlsx';

const ExcelReader = ({ onDataUpload }) => {
  const [fileName, setFileName] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      const arrayBuffer = evt.target.result;
      const data = new Uint8Array(arrayBuffer);

      // Try UTF-8 first
      let content = new TextDecoder('utf-8').decode(data);
      let wb = XLSX.read(content, { type: 'string' });
      let ws = wb.Sheets[wb.SheetNames[0]];
      let rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Check if we found valid Japanese headers. If not, try Shift-JIS.
      const hasValidHeader = (rows) => rows.some(row =>
        row && row.some(cell => typeof cell === 'string' && (cell.includes('タイムスタンプ') || cell.includes('記入日') || cell.includes('職種')))
      );

      if (!hasValidHeader(rawData.slice(0, 10))) {
        console.log("UTF-8 header not found or mangled, trying Shift-JIS...");
        content = new TextDecoder('shift-jis').decode(data);
        wb = XLSX.read(content, { type: 'string' });
        ws = wb.Sheets[wb.SheetNames[0]];
        rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
      }

      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(rawData.length, 20); i++) {
        const row = rawData[i];
        if (row && row.some(cell => typeof cell === 'string' && (cell.includes('職種') || cell.includes('タイムスタンプ')))) {
          headerRowIndex = i;
          break;
        }
      }

      const json = XLSX.utils.sheet_to_json(ws, { header: headerRowIndex, range: headerRowIndex, defval: "" });
      console.log('Final Parsed Count:', json.length);
      onDataUpload(json);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="excel-reader">
      <input
        type="file"
        accept=".xlsx, .xls, .csv"
        onChange={handleFileUpload}
        id="file-upload"
        className="file-input"
      />
      <label htmlFor="file-upload" className="file-label">
        {fileName ? `Loaded: ${fileName}` : 'Select Hiyari Hatto Excel File'}
      </label>
      <style>{`
        .excel-reader {
          margin: 20px 0;
          padding: 20px;
          border: 2px dashed #ccc;
          border-radius: 8px;
          text-align: center;
          transition: border-color 0.3s;
        }
        .excel-reader:hover {
          border-color: #007bff;
        }
        .file-input {
          display: none;
        }
        .file-label {
          cursor: pointer;
          font-weight: bold;
          color: #007bff;
        }
      `}</style>
    </div>
  );
};

export default ExcelReader;
