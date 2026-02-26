
import React, { useMemo, useState, useEffect } from 'react';

import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#6366f1', '#8b5cf6'];

const INCIDENT_CATEGORIES = ['墜落', '転倒', '衝突', '激突', '落下', '倒れ', 'ぶつかり', 'はさまれ', '切られ', 'やけど', '感電', '交通事故'];
const CAUSE_CATEGORIES = ['設備・機械', '工具・保護具', '環境', '作業方法', '連絡・連携', '確認が不足', 'よく考えず', '考え事', '見えなかった'];

const findValue = (row, sub) => {
    const key = Object.keys(row).find(k => k.includes(sub));
    return key ? row[key] : null;
};

// Scoring helper (4-point scale: 1=Low, 4=High)
const getScore = (val, type = 'positive') => {
    if (!val) return 0;
    const v = typeof val === 'string' ? val.trim() : '';

    // Scale A: Quantity/Frequency (Fatigue, Anxiety, Depression)
    // 0: Almost never (Good for stress), 3: Almost always (Bad for stress)
    const freqScale = ['ほとんどなかった', 'ときどきあった', 'しばしばあった', 'ほとんどいつもあった'];
    let idx = freqScale.indexOf(v);
    if (idx !== -1) {
        // Negative factor (Fatigue, Anxiety, Depression): Low freq (0) is Good (4).
        if (type === 'negative') return 4 - idx;
        return idx + 1;
    }

    // Scale B: Agreement (Job Demands, Control, Engagement)
    // 0: True, 1: Somewhat True, 2: Somewhat False, 3: False
    const agreeScale = ['そうだ', 'まあそうだ', 'ややちがう', 'ちがう'];
    idx = agreeScale.indexOf(v);
    if (idx !== -1) {
        // Negative factor (Demands): False (3) is Good (4).
        // Positive factor (Control, Engagement): True (0) is Good (4).
        if (type === 'negative') return idx + 1;
        return 4 - idx;
    }

    // Scale C: Support (Supervisor, Coworker)
    // 0: Very, 1: Quite, 2: Somewhat, 3: Not at all
    const supportScale = ['非常に', 'かなり', '多少', '全くない'];
    idx = supportScale.indexOf(v);
    if (idx !== -1) {
        // Positive factor (Support): Very (0) is Good (4).
        return 4 - idx;
    }

    // Scale D: Avoidance Reasons (New Google Forms format)
    // 非常にある(4) > 多少あり(3) > あまりなし(2) > 全くなし(1)
    const avoidScale = ['全くなし', 'あまりなし', '多少あり', '非常にある'];
    idx = avoidScale.indexOf(v);
    if (idx !== -1) {
        return idx + 1;
    }

    return 0; // Unknown or N/A
};

const Dashboard = ({ data, onRefresh, lastFetched }) => {
    const [selectedMonth, setSelectedMonth] = useState('');





    // Helper to safely parse dates from various formats (Excel serial, string)
    const parseDate = (value) => {
        if (!value) return null;
        if (typeof value === 'number') {
            // Excel serial date (e.g. 45314)
            const date = new Date((value - 25569) * 86400 * 1000);
            return date;
        }
        // String date (e.g. "2026/01/30")
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
    };

    // Extract available months for the dropdown
    const availableMonths = useMemo(() => {
        const months = new Set();
        if (data) {
            data.forEach(row => {
                const dateKey = Object.keys(row).find(k => k.includes('記入日'));
                if (dateKey && row[dateKey]) {
                    const date = parseDate(row[dateKey]);
                    if (date) {
                        const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
                        const monthStr = offsetDate.toISOString().slice(0, 7); // YYYY-MM
                        months.add(monthStr);
                    }
                }
            });
        }
        return Array.from(months).sort().reverse();
    }, [data]);

    // Data Processing with Filter & Advanced Analytics
    const processedData = useMemo(() => {
        if (!data || data.length === 0) return null;

        const incidentCounts = {};
        const causeCounts = {};
        const jobCounts = {};
        const placeCounts = {};
        const levelCounts = Array(7).fill(0);

        // Advanced: Cross-tabulation (Job x Category)
        const crosstalkData = {}; // { Job: { Category: count } }

        const radarScores = {
            '仕事の量・質': { sum: 0, count: 0, type: 'negative', keys: ['仕事をしなればならなかった', '仕事が処理しきれなかった', '一生懸命働かなければ'] },
            '疲労感': { sum: 0, count: 0, type: 'negative', keys: ['ひどく疲れた', 'へとへとだ', 'だるい'] },
            '不安感': { sum: 0, count: 0, type: 'negative', keys: ['気がはりつめている', '不安だ', '落ち着かない'] },
            '抑うつ感': { sum: 0, count: 0, type: 'negative', keys: ['ゆううつだ', '何をするのも面倒', '食欲がない'] },
            '身体愁訴': { sum: 0, count: 0, type: 'negative', keys: ['よく眠れない'] },
            '仕事のコントロール': { sum: 0, count: 0, type: 'positive', keys: ['自分のペース', '仕事の順番・やり方', '自分の意見を反映'] },
            '上司の支援': { sum: 0, count: 0, type: 'positive', keys: ['話ができますか [上司]', '頼りになりますか [上司]', '聞いてくれますか [上司]'] },
            '同僚の支援': { sum: 0, count: 0, type: 'positive', keys: ['話ができますか [同僚]', '頼りになりますか [同僚]', '聞いてくれますか [同僚]'] },
            'ワーク・エンゲイジメント': { sum: 0, count: 0, type: 'positive', keys: ['はつらつとしている', '誇りを感じる', '幸せだと感じる'] }
        };

        const activityCounts = {};

        INCIDENT_CATEGORIES.forEach(c => incidentCounts[c] = 0);
        CAUSE_CATEGORIES.forEach(c => causeCounts[c] = 0);


        // Date sorting and month identification
        const allDataWithDates = data.map(row => {
            const dateKey = Object.keys(row).find(k => k.includes('記入日'));
            const date = parseDate(row[dateKey]);
            return { ...row, _date: date };
        });

        let currentData = allDataWithDates;
        let prevMonthData = [];

        if (selectedMonth) {
            currentData = allDataWithDates.filter(row => {
                if (!row._date) return false;
                return row._date.toISOString().slice(0, 7) === selectedMonth;
            });

            // Calculate previous month string
            const [y, m] = selectedMonth.split('-').map(Number);
            const prevMonthDate = new Date(y, m - 2, 1);
            const prevMonthStr = prevMonthDate.toISOString().slice(0, 7);

            prevMonthData = allDataWithDates.filter(row => {
                if (!row._date) return false;
                return row._date.toISOString().slice(0, 7) === prevMonthStr;
            });
        }

        currentData.forEach(row => {
            const job = findValue(row, '職種') || '未設定';
            if (!crosstalkData[job]) crosstalkData[job] = {};

            const incidentVal = findValue(row, 'どのような体験か');
            if (incidentVal) {
                const s = String(incidentVal);
                INCIDENT_CATEGORIES.forEach(cat => {
                    if (s.includes(cat)) {
                        incidentCounts[cat]++;
                        crosstalkData[job][cat] = (crosstalkData[job][cat] || 0) + 1;
                    }
                });
            }

            const causeVal = findValue(row, '発生原因');
            if (causeVal) {
                const s = String(causeVal);
                CAUSE_CATEGORIES.forEach(cat => {
                    if (s.includes(cat)) causeCounts[cat]++;
                });
            }

            if (job) jobCounts[job] = (jobCounts[job] || 0) + 1;

            const place = findValue(row, 'どのような場所で');
            if (place) placeCounts[place] = (placeCounts[place] || 0) + 1;

            const level = findValue(row, 'どのレベルに該当しますか');
            if (level) {
                const l = parseInt(level);
                if (l >= 1 && l <= 6) levelCounts[l]++;
            }

            Object.keys(radarScores).forEach(category => {
                const config = radarScores[category];
                config.keys.forEach(subKey => {
                    const rowVal = findValue(row, subKey);
                    if (rowVal) {
                        const s = getScore(rowVal, config.type);
                        if (s > 0) {
                            config.sum += s;
                            config.count++;
                        }
                    }
                });
            });

            const activityVal = findValue(row, '回避するのに役立ったと思われる活動');
            if (activityVal) {
                const s = String(activityVal);
                s.split(/[,、]/).forEach(act => {
                    const cleanAct = act.trim().replace(/^\d+\.\s*/, '');
                    if (cleanAct) activityCounts[cleanAct] = (activityCounts[cleanAct] || 0) + 1;
                });
            }
        });

        // Advanced: Format crosstalk for Recharts
        const crossChartData = Object.keys(crosstalkData).map(job => {
            const item = { name: job };
            INCIDENT_CATEGORIES.forEach(cat => {
                item[cat] = crosstalkData[job][cat] || 0;
            });
            return item;
        });

        // Trend badges calculation
        const reportTrend = prevMonthData.length > 0 ? ((currentData.length - prevMonthData.length) / prevMonthData.length) * 100 : 0;

        return {
            incidentChartData: Object.keys(incidentCounts).map(name => ({ name, count: incidentCounts[name] })).sort((a, b) => b.count - a.count),
            causeChartData: Object.keys(causeCounts).map(name => ({ name, count: causeCounts[name] })).sort((a, b) => b.count - a.count),
            jobChartData: Object.keys(jobCounts).map(name => ({ name, value: jobCounts[name] })),
            radarChartData: Object.keys(radarScores).map(subject => ({ subject, A: radarScores[subject].count > 0 ? parseFloat((radarScores[subject].sum / radarScores[subject].count).toFixed(2)) : 0, B: 2.5 })),
            activityChartData: Object.keys(activityCounts).map(name => ({ name, count: activityCounts[name] })).sort((a, b) => b.count - a.count).slice(0, 10),
            placeChartData: Object.keys(placeCounts).map(name => ({ name, count: placeCounts[name] })).sort((a, b) => b.count - a.count),
            totalReports: currentData.length,
            reportTrend,
            levelData: levelCounts.slice(1).map((c, i) => ({ level: `L${i + 1}`, count: c })),
            crossChartData,
            rawRows: currentData
        };
    }, [data, selectedMonth]);

    const handlePrint = () => {
        window.print();
    };

    if (!data || data.length === 0) {
        return <div className="no-data">Please upload data to view the dashboard.</div>;
    }

    return (
        <div className="app-container">
            {/* Sidebar for navigation & filtering */}
            <aside className="app-sidebar">
                <h1>ヒヤリハット<br />分析ダッシュボード</h1>

                <div className="sidebar-section">
                    <h3>月別フィルター</h3>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="sidebar-select"
                    >
                        <option value="">全期間</option>
                        {availableMonths.map(month => (
                            <option key={month} value={month}>{month}</option>
                        ))}
                    </select>
                </div>

                <div className="sidebar-section" style={{ marginTop: 'auto' }}>
                    {onRefresh && (
                        <>
                            <button onClick={onRefresh} className="sidebar-btn" style={{ background: '#10b981', marginBottom: '0.5rem' }}>
                                🔄 データを更新
                            </button>
                            {lastFetched && (
                                <p style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center', marginBottom: '0.5rem' }}>
                                    最終取得: {lastFetched}
                                </p>
                            )}
                        </>
                    )}
                    <button onClick={handlePrint} className="sidebar-btn primary" style={{ marginBottom: '0.5rem' }}>
                        レポートを印刷 (PDF)
                    </button>
                    <p className="copyright">&copy; 2026 ヒヤリハット集計システム - 労働安全衛生分析ダッシュボード</p>
                </div>
            </aside>

            {/* Main Dashboard Content */}
            <main>
                <div className="app-header no-print">
                    <div>
                        <h1>ダッシュボード概要</h1>
                        <p>現場の安全状況とトレンドを可視化します</p>
                    </div>
                    <div className="header-stat">
                        <span className="label">累計報告数</span>
                        <span className="value">{processedData.totalReports}</span>
                    </div>
                </div>

                <div className="report-header only-print">
                    <h1>ヒヤリハット月報</h1>
                    <p>対象期間: {selectedMonth || '全期間'}</p>
                    <p>累計報告数: <strong>{processedData.totalReports}</strong></p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="summary-cards"
                >
                    <div className="card summary-card">
                        <h4>累計報告数</h4>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                            <p className="value">{processedData.totalReports}</p>
                            {selectedMonth && processedData.reportTrend !== 0 && (
                                <span className={`trend-badge ${processedData.reportTrend > 0 ? 'bad' : 'good'}`}>
                                    {processedData.reportTrend > 0 ? '▲' : '▼'} {Math.abs(processedData.reportTrend).toFixed(1)}%
                                </span>
                            )}
                        </div>
                        {selectedMonth && <p className="subtitle">前月比</p>}
                    </div>
                </motion.div>

                <motion.div
                    className="dashboard-grid"
                    initial="hidden"
                    animate="visible"
                    variants={{
                        visible: { transition: { staggerChildren: 0.1 } }
                    }}
                >
                    {/* クロス集計分析 (新) */}
                    <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }} className="card full-width">
                        <h3>職種 × リスクタイプの多角的分析</h3>
                        <p className="chart-subtitle">どの職種でどのような種類の事故が発生しやすいか可視化</p>
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={processedData.crossChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" />
                                <YAxis />
                                <Tooltip />
                                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                                {INCIDENT_CATEGORIES.slice(0, 6).map((cat, i) => (
                                    <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[i % COLORS.length]} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </motion.div>

                    {/* 発生場所の分析 */}
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="card avoid-break">
                        <h3>発生場所の傾向</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={processedData.placeChartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} fontSize={12} tick={{ fill: '#475569' }} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="件数" />
                            </BarChart>
                        </ResponsiveContainer>
                    </motion.div>

                    {/* 災害レベル */}
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="card avoid-break">
                        <h3>想定される災害レベル</h3>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>L1（軽微）〜 L6（重大）</p>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={processedData.levelData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="count"
                                    label={({ level, count }) => count > 0 ? `${level}: ${count}件` : ''}
                                >
                                    {processedData.levelData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#7c3aed', '#000000'][index % 6]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </motion.div>

                    {/* 心理的負荷・環境分析 */}
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="card radar-card avoid-break">
                        <h3>心理的負荷・職場環境分析</h3>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>9軸調査結果（外側にいくほど良好/健全）</p>
                        <ResponsiveContainer width="100%" height={350}>
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={processedData.radarChartData}>
                                <PolarGrid stroke="#e2e8f0" />
                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                                <PolarRadiusAxis angle={30} domain={[0, 4]} tick={{ fontSize: 8 }} />
                                <Radar name="現場平均" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Legend />
                            </RadarChart>
                        </ResponsiveContainer>
                    </motion.div>

                    {/* ヒヤリハットの種類 */}
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="card avoid-break">
                        <h3>ヒヤリハットの種類</h3>
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={processedData.incidentChartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={120} fontSize={11} tick={{ fill: '#475569' }} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="件数" />
                            </BarChart>
                        </ResponsiveContainer>
                    </motion.div>

                    {/* 発生原因の分析 */}
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="card avoid-break">
                        <h3>発生原因の分析</h3>
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={processedData.causeChartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={120} fontSize={11} tick={{ fill: '#475569' }} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} name="件数" />
                            </BarChart>
                        </ResponsiveContainer>
                    </motion.div>

                    {/* 職種別の割合 */}
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="card avoid-break">
                        <h3>職種別の割合</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={processedData.jobChartData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    label={({ name, value }) => `${name}: ${value}`}
                                >
                                    {processedData.jobChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </motion.div>

                    {/* 回避に役立った活動 */}
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="card avoid-break full-width">
                        <h3>回避に役立った活動 TOP10</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={processedData.activityChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={80} />
                                <YAxis fontSize={12} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="件数" />
                            </BarChart>
                        </ResponsiveContainer>
                    </motion.div>

                    {/* 詳細データテーブル (ドリルダウン) */}
                    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="card full-width no-print">
                        <h3>報告詳細一覧</h3>
                        <div className="table-responsive">
                            <table className="detail-table">
                                <thead>
                                    <tr>
                                        <th>記入日</th>
                                        <th>場所</th>
                                        <th>体験内容</th>
                                        <th>どうなったか</th>
                                        <th>原因</th>
                                        <th>回避できた理由</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {processedData.rawRows.map((row, i) => {
                                        const date = parseDate(row['記入日']);
                                        const formattedDate = date ? date.toLocaleDateString('ja-JP') : row['記入日'];
                                        return (
                                            <tr key={i}>
                                                <td>{formattedDate}</td>
                                                <td>{findValue(row, 'どの場所で') || '-'}</td>
                                                <td>{findValue(row, '体験か') || '-'}</td>
                                                <td>{findValue(row, 'どうなったか') || '-'}</td>
                                                <td>{findValue(row, '発生原因') || '-'}</td>
                                                <td>{findValue(row, '回避できた理由') || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>

                </motion.div>

                <div className="dashboard-footer">
                    <p>© 2026 ヒヤリハット集計システム - 労働安全衛生分析ダッシュボード</p>
                </div>
            </main>

            <style>{`
        /* Local Component Styles supplementing App.css */
        
        .sidebar-section {
            margin-bottom: 2rem;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        .sidebar-section h3 {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #94a3b8; /* Slate 400 */
        }
        .sidebar-select {
            background: #334155;
            color: white;
            border: 1px solid #475569;
            padding: 0.75rem;
            border-radius: 0.5rem;
            width: 100%;
            outline: none;
        }
        .sidebar-btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 0.75rem;
            border-radius: 0.5rem;
            cursor: pointer;
            font-weight: 600;
            transition: background 0.2s;
        }
        .sidebar-btn:hover {
            background: #2563eb;
        }
        .copyright {
            color: #475569;
            font-size: 0.75rem;
            margin-top: 1rem;
            text-align: center;
        }

        .header-stat .label {
            display: block;
            font-size: 0.875rem;
            color: #64748b;
        }
        .header-stat .value {
            font-size: 2rem;
            font-weight: 800;
            color: #0f172a;
        }

        /* Grid Layout for Dashboard */
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(1, 1fr);
            gap: 1.5rem;
        }
        @media (min-width: 1024px) {
            .dashboard-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            .radar-card {
                grid-row: span 2; /* Make visual weight larger */
            }
            .full-width {
                grid-column: 1 / -1;
            }
        }

        .chart-subtitle {
            font-size: 0.875rem;
            color: #64748b;
            margin-bottom: 1rem;
        }
        h2, h3 {
            color: #1e293b;
            margin-bottom: 1rem;
            font-weight: 600;
        }
        
        .no-data {
            text-align: center;
            padding: 4rem;
            color: #94a3b8;
        }

        @media print {
            .app-container {
                display: block;
            }
            .app-sidebar {
                display: none;
            }
            .dashboard-grid {
                display: block;
            }
            .card {
                break-inside: avoid;
                box-shadow: none;
                border: 1px solid #e2e8f0;
                margin-bottom: 1rem;
            }
        }
      `}</style>
        </div>
    );
};

export default Dashboard;
