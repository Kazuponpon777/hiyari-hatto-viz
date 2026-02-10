# Hiyari Hatto Visualization App

This application visualizes the Hiyari Hatto (Near-Miss) report data from Excel or Google Sheets (CSV).

## Getting Started

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Start the Development Server**

   ```bash
   npm run dev
   ```

   The app will open at `http://localhost:5173`.

3. **Upload Data**
   - Click "Select Hiyari Hatto Excel File".
   - You can upload:
     - Excel files (`.xlsx`, `.xls`)
     - Google Sheets exports (`.csv`)
   - The app automatically detects the header row (searching for '職種').
   - The dashboard will automatically populate with charts.

## Features

- **Incident Types**: Bar chart showing frequency of different near-miss types.
- **Root Causes**: Analysis of causes like "Equipment issues" or "Human error".
- **Job Distribution**: Pie chart of incidents by job role.
