import { useState, useEffect, useRef } from "react";
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ReferenceLine, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from "recharts";

// ─── STATIC DATA ──────────────────────────────────────────────────────────────

const GPU_DATA = {
    "Intel Arc A770": { idle: 38, load: 225, tdp: 225, gen: "Alchemist", color: "#00C7FD", perf: 100 },
    "Intel Arc B580": { idle: 22, load: 190, tdp: 190, gen: "Battlemage", color: "#0068B5", perf: 118 },
    "Nvidia RTX 4070": { idle: 15, load: 200, tdp: 200, gen: "Ada Lovelace", color: "#76B900", perf: 145 },
    "AMD RX 7700 XT": { idle: 7, load: 245, tdp: 245, gen: "RDNA 3", color: "#ED1C24", perf: 130 },
    "Nvidia RTX 5070": { idle: 8, load: 160, tdp: 160, gen: "Blackwell", color: "#76B900", perf: 175 },
};

const GENERATION_DATA = [
    { gen: "Alchemist\n2022", perfPerWatt: 44, idleWaste: 38, competitor: 72 },
    { gen: "Battlemage\n2024", perfPerWatt: 62, idleWaste: 22, competitor: 91 },
    { gen: "Celestial\n2026E", perfPerWatt: 88, idleWaste: 10, competitor: 110 },
    { gen: "Druid\n2028E", perfPerWatt: 115, idleWaste: 6, competitor: 130 },
];

const METRICS_RADAR = [
    { metric: "Perf/Watt", intel: 62, nvidia: 91, amd: 78 },
    { metric: "Idle Eff.", intel: 42, nvidia: 88, amd: 92 },
    { metric: "Driver QA", intel: 72, nvidia: 96, amd: 85 },
    { metric: "AI Features", intel: 68, nvidia: 95, amd: 71 },
    { metric: "Ecosystem", intel: 55, nvidia: 98, amd: 82 },
    { metric: "Value", intel: 90, nvidia: 58, amd: 72 },
];

// ─── HOOKS ────────────────────────────────────────────────────────────────────

// Demo data generator (used when backend is unavailable, e.g. GitHub Pages)
const PHASES = ["Idle", "Desktop", "Game Load", "Gaming", "Cutscene", "Menu"];
function generateDemoPoint(tick) {
    const phaseIdx = Math.floor(tick / 25) % PHASES.length;
    const phase = PHASES[phaseIdx];
    const profiles = {
        Idle: { sm: [2, 8], mem: [3, 10], power: [35, 55] },
        Desktop: { sm: [5, 20], mem: [5, 25], power: [40, 70] },
        "Game Load": { sm: [30, 60], mem: [40, 70], power: [90, 140] },
        Gaming: { sm: [70, 98], mem: [60, 95], power: [160, 220] },
        Cutscene: { sm: [40, 65], mem: [50, 80], power: [100, 160] },
        Menu: { sm: [10, 30], mem: [10, 30], power: [45, 80] },
    };
    const p = profiles[phase];
    const rand = (a, b) => +(a + Math.random() * (b - a)).toFixed(1);
    const sm = rand(p.sm[0], p.sm[1]);
    const mem = rand(p.mem[0], p.mem[1]);
    const actual = rand(p.power[0], p.power[1]);
    const optimal = +(actual * (0.55 + Math.random() * 0.15)).toFixed(1);
    return {
        time: `${(tick * 0.2).toFixed(1)}s`, sm, mem,
        actual_power: actual, optimal_power: optimal,
        predicted_phase: phase, savings: +(actual - optimal).toFixed(1),
        pcie: sm > 50 ? "L0" : "L1", mwp_cwp_ratio: +(0.4 + Math.random() * 1.2).toFixed(2),
    };
}

function useTelemetryStream(isActive) {
    const [data, setData] = useState([]);
    const [latest, setLatest] = useState(null);
    const [connected, setConnected] = useState(false);
    const [stats, setStats] = useState({ totalSaved: 0, avgSavings: 0, points: 0 });
    const eventSourceRef = useRef(null);
    const demoRef = useRef(null);
    const tickRef = useRef(0);

    const pushPoint = (point) => {
        setLatest(point);
        setData(prev => { const next = [...prev, point]; if (next.length > 100) next.shift(); return next; });
        setStats(prev => {
            const points = prev.points + 1;
            const totalSaved = prev.totalSaved + (point.savings || 0);
            return { totalSaved, avgSavings: totalSaved / points, points };
        });
    };

    useEffect(() => {
        if (!isActive) {
            if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
            if (demoRef.current) { clearInterval(demoRef.current); demoRef.current = null; }
            setConnected(false);
            return;
        }

        // Try SSE first
        let sseWorked = false;
        try {
            const es = new EventSource("/stream");
            eventSourceRef.current = es;
            const timeout = setTimeout(() => {
                if (!sseWorked) {
                    es.close();
                    eventSourceRef.current = null;
                    // Fall back to demo mode
                    setConnected(true);
                    demoRef.current = setInterval(() => {
                        pushPoint(generateDemoPoint(tickRef.current++));
                    }, 200);
                }
            }, 2000);

            es.onopen = () => { sseWorked = true; clearTimeout(timeout); setConnected(true); };
            es.onerror = () => {
                if (!sseWorked) {
                    clearTimeout(timeout);
                    es.close();
                    eventSourceRef.current = null;
                    setConnected(true);
                    demoRef.current = setInterval(() => {
                        pushPoint(generateDemoPoint(tickRef.current++));
                    }, 200);
                }
            };
            es.onmessage = (event) => {
                try { pushPoint(JSON.parse(event.data)); } catch (e) { /* skip */ }
            };
        } catch (e) {
            // SSE not supported or blocked — go demo
            setConnected(true);
            demoRef.current = setInterval(() => {
                pushPoint(generateDemoPoint(tickRef.current++));
            }, 200);
        }

        return () => {
            if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
            if (demoRef.current) { clearInterval(demoRef.current); demoRef.current = null; }
            setConnected(false);
        };
    }, [isActive]);

    return { data, latest, connected, stats };
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: "rgba(0, 8, 20, 0.95)", border: "1px solid rgba(0, 104, 181, 0.2)", borderRadius: 8, padding: "14px 18px", fontFamily: "var(--font-primary)", backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
            <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 8, fontWeight: 600, letterSpacing: 0.5 }}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ color: p.color, fontSize: 13, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, opacity: 0.8 }} />
                    {p.name}: <span style={{ color: "#fff", fontWeight: 600 }}>{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</span>
                    {(p.name.includes("power") || p.name.includes("Power") || p.name === "actual" || p.name === "optimal") ? "W" : ""}
                </div>
            ))}
            {payload[0]?.payload?.savings > 0 && (
                <div style={{ color: "var(--success)", fontSize: 12, marginTop: 8, borderTop: "1px solid rgba(0,104,181,0.15)", paddingTop: 8, fontWeight: 600 }}>
                    ⚡ AI saves {payload[0].payload.savings.toFixed(1)}W
                </div>
            )}
        </div>
    );
};

const MetricCard = ({ label, value, unit, sub, accent, delta }) => (
    <div className="intel-card animate-in" style={{ borderTop: `2px solid ${accent}` }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 100, height: 100, background: `radial-gradient(circle at top right, ${accent}12, transparent 70%)` }} />
        <div className="section-label">{label}</div>
        <div className="metric-value">{value}<span className="metric-unit">{unit}</span></div>
        {delta != null && <div style={{ fontSize: 13, color: delta > 0 ? "var(--danger)" : "var(--success)", marginTop: 8, fontWeight: 600 }}>
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}% vs Nvidia
        </div>}
        {sub && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>{sub}</div>}
    </div>
);

const PhaseTag = ({ phase }) => {
    const colors = { Idle: "#7b8fa3", Desktop: "#8b9db0", "Game Load": "#ffb020", Gaming: "#00C7FD", Cutscene: "#8b5cf6", Menu: "#00c781" };
    const c = colors[phase] || "#7b8fa3";
    return <span className="intel-tag" style={{ background: `${c}15`, color: c, border: `1px solid ${c}25` }}>{phase?.toUpperCase() || "—"}</span>;
};

// ─── TAB: OVERVIEW ────────────────────────────────────────────────────────────

function OverviewTab({ selectedGPU, setSelectedGPU, hoursPerDay, setHoursPerDay, energyCost, setEnergyCost }) {
    const gpu = GPU_DATA[selectedGPU];
    const nvidiaGPU = GPU_DATA["Nvidia RTX 4070"];
    const idleHours = 24 - hoursPerDay;
    const idleWasteDaily = (gpu.idle * idleHours) / 1000;
    const nvidiaWasteDaily = (nvidiaGPU.idle * idleHours) / 1000;
    const annualWaste = idleWasteDaily * 365 * energyCost;
    const annualNvidiaWaste = nvidiaWasteDaily * 365 * energyCost;
    const annualGap = annualWaste - annualNvidiaWaste;
    const co2Annual = idleWasteDaily * 365 * 0.386;

    return (
        <div className="animate-in">
            {/* Controls Row */}
            <div className="grid-3" style={{ marginBottom: 32 }}>
                <div className="intel-card">
                    <div className="section-label">Select GPU</div>
                    <select value={selectedGPU} onChange={e => setSelectedGPU(e.target.value)} style={{
                        width: "100%", background: "rgba(0, 18, 41, 0.8)", border: "1px solid rgba(0, 104, 181, 0.2)", color: "#fff",
                        padding: "12px 14px", borderRadius: "var(--card-radius)", fontFamily: "var(--font-primary)", fontSize: 13, fontWeight: 500, cursor: "pointer", outline: "none", transition: "border-color 0.2s"
                    }}>
                        {Object.keys(GPU_DATA).map(g => <option key={g}>{g}</option>)}
                    </select>
                    <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                        <span className="intel-tag" style={{ background: `${gpu.color}15`, color: gpu.color, border: `1px solid ${gpu.color}25` }}>{gpu.gen}</span>
                        <span className="intel-tag" style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}>{gpu.tdp}W TDP</span>
                    </div>
                </div>
                <div className="intel-card">
                    <div className="section-label">Daily Usage · <span style={{ color: "var(--intel-cyan)" }}>{hoursPerDay}h gaming</span></div>
                    <div style={{ marginTop: 8 }}>
                        <input type="range" min={1} max={16} value={hoursPerDay} onChange={e => setHoursPerDay(+e.target.value)} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                        <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>1h</span>
                        <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>16h</span>
                    </div>
                </div>
                <div className="intel-card">
                    <div className="section-label">Energy Cost · <span style={{ color: "var(--intel-cyan)" }}>${energyCost}/kWh</span></div>
                    <div style={{ marginTop: 8 }}>
                        <input type="range" min={0.05} max={0.5} step={0.01} value={energyCost} onChange={e => setEnergyCost(+e.target.value)} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                        <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>$0.05</span>
                        <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>$0.50</span>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid-4" style={{ marginBottom: 32 }}>
                <MetricCard label="Idle Power Draw" value={gpu.idle} unit="W" accent="var(--danger)"
                    sub={`vs Nvidia ${nvidiaGPU.idle}W idle`} delta={Math.round((gpu.idle / nvidiaGPU.idle - 1) * 100)} />
                <MetricCard label="Annual Cost Gap" value={`$${Math.abs(annualGap).toFixed(2)}`} unit=""
                    accent={annualGap > 0 ? "var(--danger)" : "var(--success)"}
                    sub={annualGap > 0 ? "excess vs Nvidia RTX 4070" : "savings vs Nvidia RTX 4070"} />
                <MetricCard label="CO₂ Waste / Year" value={co2Annual.toFixed(1)} unit="kg"
                    accent="var(--warning)" sub="from idle power alone" />
                <MetricCard label="Perf / Watt Score" value={gpu.perf} unit="pts"
                    accent="var(--intel-cyan)" delta={Math.round((gpu.perf / 145 - 1) * 100)} sub="vs Nvidia RTX 4070 baseline" />
            </div>

            {/* Idle Power Chart */}
            <div className="intel-card">
                <div className="section-label">Idle Power Comparison — Root of Intel's Efficiency Problem</div>
                <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={Object.entries(GPU_DATA).map(([name, d]) => ({ name: name.replace("Intel ", "").replace("Nvidia ", "N:").replace("AMD ", "A:"), idle: d.idle }))}
                        margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,104,181,0.08)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-primary)", fontWeight: 500 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "var(--text-dim)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <ReferenceLine y={10} stroke="rgba(0,199,129,0.3)" strokeDasharray="4 4" label={{ value: "TARGET <10W", fill: "var(--success)", fontSize: 10, fontWeight: 600 }} />
                        <Bar dataKey="idle" radius={[6, 6, 0, 0]} fill="url(#barGrad)"
                            label={{ position: "top", fill: "var(--text-muted)", fontSize: 11, fontWeight: 600, formatter: v => `${v}W` }} />
                        <defs>
                            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#00C7FD" />
                                <stop offset="100%" stopColor="#0068B5" />
                            </linearGradient>
                        </defs>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// ─── TAB: LIVE AI ─────────────────────────────────────────────────────────────

function RealtimeTab({ aiMode }) {
    const { data, latest, connected, stats } = useTelemetryStream(true);

    return (
        <div className="animate-in">
            <div className="tab-header">
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: -0.5, marginBottom: 6 }}>Live AI Power Intelligence</h1>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 12, fontWeight: 500 }}>
                        Streaming from backend telemetry simulator
                        {connected
                            ? <span className="live-badge"><span className="dot" /> LIVE</span>
                            : <span style={{ color: "var(--danger)", fontSize: 12, fontWeight: 600 }}>● DISCONNECTED — run: python api.py</span>
                        }
                    </div>
                </div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                    {[{ label: "Actual Power", color: "var(--danger)" }, { label: "AI Optimal", color: "var(--success)" }].map(l => (
                        <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 20, height: 3, background: l.color, borderRadius: 2 }} />
                            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{l.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="intel-card" style={{ marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                        <defs>
                            <linearGradient id="actualG" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ff4d6a" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#ff4d6a" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="optimalG" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00c781" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#00c781" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,104,181,0.08)" />
                        <XAxis dataKey="time" tick={{ fill: "var(--text-dim)", fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} unit="W" />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="actual_power" stroke="#ff4d6a" strokeWidth={2.5} fill="url(#actualG)" name="Actual Power" dot={false} />
                        {aiMode && <Area type="monotone" dataKey="optimal_power" stroke="#00c781" strokeWidth={2.5} fill="url(#optimalG)" name="AI Optimal" dot={false} />}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Live Metric Cards */}
            {latest && (
                <div className="grid-5" style={{ marginBottom: 16 }}>
                    <div className="intel-card" style={{ borderTop: "2px solid var(--intel-cyan)", textAlign: "center" }}>
                        <PhaseTag phase={latest.predicted_phase} />
                        <div style={{ marginTop: 12, fontSize: 28, fontWeight: 800, color: "#fff" }}>{latest.actual_power}W</div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, fontWeight: 600, letterSpacing: 0.5 }}>ACTUAL</div>
                    </div>
                    <div className="intel-card" style={{ borderTop: "2px solid var(--success)", textAlign: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 0.5 }}>AI TARGET</div>
                        <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800, color: "var(--success)" }}>{latest.optimal_power}W</div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, fontWeight: 600, letterSpacing: 0.5 }}>OPTIMAL</div>
                    </div>
                    <div className="intel-card" style={{ borderTop: "2px solid var(--warning)", textAlign: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 0.5 }}>SM UTIL</div>
                        <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800, color: "var(--warning)" }}>{latest.sm}%</div>
                        <div className="progress-track" style={{ marginTop: 10 }}>
                            <div className="progress-fill" style={{ width: `${latest.sm}%`, background: "var(--warning)" }} />
                        </div>
                    </div>
                    <div className="intel-card" style={{ borderTop: "2px solid var(--purple)", textAlign: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 0.5 }}>MEM BW</div>
                        <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800, color: "var(--purple)" }}>{latest.mem}%</div>
                        <div className="progress-track" style={{ marginTop: 10 }}>
                            <div className="progress-fill" style={{ width: `${latest.mem}%`, background: "var(--purple)" }} />
                        </div>
                    </div>
                    <div className="intel-card" style={{ borderTop: "2px solid var(--danger)", textAlign: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 0.5 }}>SAVINGS</div>
                        <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800, color: latest.savings > 20 ? "var(--success)" : "var(--intel-cyan)" }}>{latest.savings}W</div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, fontWeight: 600, letterSpacing: 0.5 }}>THIS TICK</div>
                    </div>
                </div>
            )}

            {/* AI Summary */}
            {aiMode && stats.points > 0 && (
                <div className="savings-bar savings-summary">
                    <div>
                        <div style={{ fontSize: 13, color: "var(--success)", fontWeight: 700, letterSpacing: 1 }}>AI POWER SAVINGS — LIVE SESSION</div>
                        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4, fontWeight: 500 }}>Cumulative savings from predictive DVFS over {stats.points} data points</div>
                    </div>
                    <div className="savings-metrics">
                        {[{ label: "Avg Savings", value: `${stats.avgSavings.toFixed(1)}W` }, { label: "Total Saved", value: `${stats.totalSaved.toFixed(0)}W·t` }, { label: "Perf Impact", value: "<1%" }].map(m => (
                            <div key={m.label} style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 26, fontWeight: 800, color: "var(--success)" }}>{m.value}</div>
                                <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600, letterSpacing: 0.5 }}>{m.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── TAB: ML PIPELINE ─────────────────────────────────────────────────────────

function PipelineTab() {
    const { latest, connected } = useTelemetryStream(true);

    const stages = [
        {
            title: "INPUT LAYER", sub: "1,000+ On-Die Sensors @ 1ms", metrics: latest ? [
                { k: "SM Utilization", v: `${latest.sm}%` }, { k: "Memory BW", v: `${latest.mem}%` },
                { k: "PCIe State", v: latest.pcie }, { k: "Raw Power", v: `${latest.actual_power}W` },
            ] : [], color: "var(--intel-cyan)"
        },
        {
            title: "PHASE CLASSIFIER", sub: "Gradient Boosting · <1ms", metrics: latest ? [
                { k: "Predicted Phase", v: latest.predicted_phase }, { k: "MWP/CWP Ratio", v: latest.mwp_cwp_ratio },
            ] : [], color: "var(--warning)"
        },
        {
            title: "POWER PREDICTOR", sub: "LSTM · 200ms Horizon", metrics: latest ? [
                { k: "Optimal Target", v: `${latest.optimal_power}W` }, { k: "Energy Savings", v: `${latest.savings}W` },
            ] : [], color: "var(--success)"
        },
        {
            title: "DVFS CONTROLLER", sub: "Core Freq · Voltage · Cores", metrics: latest ? [
                { k: "Action", v: latest.savings > 20 ? "SCALE DOWN" : latest.savings > 5 ? "OPTIMIZE" : "HOLD" },
                { k: "Confidence", v: latest.savings > 10 ? "HIGH" : "MEDIUM" },
            ] : [], color: "var(--purple)"
        },
    ];

    return (
        <div className="animate-in">
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: -0.5, marginBottom: 6 }}>AI/ML Pipeline Visualization</h1>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 28, display: "flex", alignItems: "center", gap: 12, fontWeight: 500 }}>
                Real-time data flowing through the ML inference pipeline
                {connected ? <span className="live-badge"><span className="dot" /> LIVE</span> : <span style={{ color: "var(--text-dim)", fontSize: 12 }}>OFFLINE</span>}
            </div>

            {/* Pipeline Stages */}
            <div className="grid-pipeline" style={{ marginBottom: 24 }}>
                {stages.map((st, i) => (
                    <div key={st.title} className="pipeline-stage" style={{ borderTop: `2px solid ${st.color}` }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: st.color, letterSpacing: 1.5, marginBottom: 4 }}>{st.title}</div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 16, fontWeight: 500 }}>{st.sub}</div>
                        {st.metrics.map(m => (
                            <div key={m.k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{m.k}</span>
                                <span style={{ fontSize: 13, color: "#fff", fontWeight: 700 }}>{m.v}</span>
                            </div>
                        ))}
                        {i < 3 && <div style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", fontSize: 18, zIndex: 1 }}>→</div>}
                    </div>
                ))}
            </div>

            {/* Correlation Insights */}
            <div className="grid-2">
                <div className="intel-card" style={{ borderLeft: "3px solid var(--intel-cyan)" }}>
                    <div className="section-label">Correlation A: Memory BW ↔ Power (R² {'>'} 0.89)</div>
                    <div style={{ fontSize: 13, color: "var(--text-light)", lineHeight: 1.7 }}>
                        Memory-related counters are the single most predictive feature group. When MEM BW &gt; 60%, power enters high-draw regime — predictable 300ms in advance.
                    </div>
                    {latest && <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: latest.mem > 60 ? "var(--danger)" : "var(--success)" }}>
                        Current: MEM {latest.mem}% → {latest.mem > 60 ? "HIGH DRAW REGIME ⚠️" : "NORMAL RANGE ✓"}
                    </div>}
                </div>
                <div className="intel-card" style={{ borderLeft: "3px solid var(--success)" }}>
                    <div className="section-label">Correlation B: MWP {'<'} CWP → Safe Power Reduction</div>
                    <div style={{ fontSize: 13, color: "var(--text-light)", lineHeight: 1.7 }}>
                        When memory warp parallelism drops below compute warp parallelism, compute cores are idle-waiting. Safe core reduction with zero FPS loss.
                    </div>
                    {latest && <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: latest.mwp_cwp_ratio < 1.0 ? "var(--success)" : "var(--warning)" }}>
                        MWP/CWP: {latest.mwp_cwp_ratio} → {latest.mwp_cwp_ratio < 1.0 ? "SAFE REDUCTION WINDOW ✓" : "MEMORY BOUND — HOLD"}
                    </div>}
                </div>
            </div>
        </div>
    );
}

// ─── TAB: ROADMAP ─────────────────────────────────────────────────────────────

function RoadmapTab() {
    return (
        <div className="animate-in">
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: -0.5, marginBottom: 6 }}>Intel GPU Generation Efficiency Trajectory</h1>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 28, fontWeight: 500 }}>Performance-per-watt vs idle waste across GPU generations</div>
            <div className="intel-card" style={{ marginBottom: 20 }}>
                <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={GENERATION_DATA}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,104,181,0.08)" />
                        <XAxis dataKey="gen" tick={{ fill: "var(--text-muted)", fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "var(--text-dim)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="perfPerWatt" stroke="#00C7FD" strokeWidth={2.5} dot={{ fill: "#00C7FD", r: 5, strokeWidth: 0 }} name="Intel Perf/Watt" />
                        <Line type="monotone" dataKey="competitor" stroke="#76B900" strokeWidth={2.5} strokeDasharray="6 3" dot={{ fill: "#76B900", r: 5, strokeWidth: 0 }} name="Nvidia Baseline" />
                        <Line type="monotone" dataKey="idleWaste" stroke="#ff4d6a" strokeWidth={2.5} dot={{ fill: "#ff4d6a", r: 5, strokeWidth: 0 }} name="Intel Idle (W)" />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className="grid-4">
                {[
                    { gen: "Alchemist", year: "2022", status: "SHIPPED", perf: 44, idle: 38, color: "#7b8fa3", note: "Driver struggles, poor idle mgmt" },
                    { gen: "Battlemage", year: "2024", status: "CURRENT", perf: 62, idle: 22, color: "#00C7FD", note: "Major improvement, gap remains" },
                    { gen: "Celestial", year: "2026E", status: "SAMPLING", perf: 88, idle: 10, color: "#ffb020", note: "AI power mgmt target" },
                    { gen: "Druid", year: "2028E", status: "DESIGN", perf: 115, idle: 6, color: "#8b5cf6", note: "Long-term parity goal" },
                ].map(g => (
                    <div key={g.gen} className="intel-card" style={{ borderTop: `2px solid ${g.color}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                            <span style={{ fontWeight: 800, color: "#fff", fontSize: 16 }}>{g.gen}</span>
                            <span className="intel-tag" style={{ background: `${g.color}15`, color: g.color, border: `1px solid ${g.color}25` }}>{g.status}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 14, fontWeight: 500 }}>{g.year}</div>
                        <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
                            <div><div style={{ fontSize: 24, fontWeight: 800, color: g.color }}>{g.perf}</div><div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600 }}>perf/watt</div></div>
                            <div><div style={{ fontSize: 24, fontWeight: 800, color: "var(--danger)" }}>{g.idle}W</div><div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600 }}>idle draw</div></div>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6, fontWeight: 500 }}>{g.note}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── TAB: COMPETITIVE ─────────────────────────────────────────────────────────

function CompetitiveTab() {
    return (
        <div className="animate-in">
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: -0.5, marginBottom: 6 }}>Competitive Intelligence Matrix</h1>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 28, fontWeight: 500 }}>Intel vs Nvidia vs AMD — 6-axis capability comparison</div>
            <div className="grid-2">
                <div className="intel-card">
                    <div className="section-label">Capability Radar</div>
                    <ResponsiveContainer width="100%" height={320}>
                        <RadarChart data={METRICS_RADAR}>
                            <PolarGrid stroke="rgba(0,104,181,0.12)" />
                            <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--text-muted)", fontSize: 11, fontWeight: 500 }} />
                            <Radar name="Intel" dataKey="intel" stroke="#00C7FD" fill="#00C7FD" fillOpacity={0.12} strokeWidth={2.5} />
                            <Radar name="Nvidia" dataKey="nvidia" stroke="#76B900" fill="#76B900" fillOpacity={0.05} strokeWidth={2} strokeDasharray="4 2" />
                            <Radar name="AMD" dataKey="amd" stroke="#ED1C24" fill="#ED1C24" fillOpacity={0.05} strokeWidth={2} strokeDasharray="4 2" />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {METRICS_RADAR.map(m => (
                        <div key={m.metric} className="intel-card" style={{ padding: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                <span style={{ fontSize: 13, color: "var(--text-light)", fontWeight: 600 }}>{m.metric}</span>
                                <div style={{ display: "flex", gap: 14 }}>
                                    {[{ v: m.intel, c: "#00C7FD", l: "Intel" }, { v: m.nvidia, c: "#76B900", l: "NV" }, { v: m.amd, c: "#ED1C24", l: "AMD" }].map(x => (
                                        <span key={x.l} style={{ fontSize: 12, color: x.c, fontWeight: 700 }}>{x.v}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="progress-track" style={{ position: "relative" }}>
                                <div className="progress-fill" style={{ width: `${m.intel}%`, background: "rgba(0,199,253,0.25)" }} />
                                <div style={{ position: "absolute", top: 0, height: "100%", width: `${m.nvidia}%`, borderRight: "2px solid #76B900" }} />
                            </div>
                        </div>
                    ))}
                    <div className="intel-card" style={{ background: "rgba(0,104,181,0.06)", borderColor: "rgba(0,199,253,0.12)" }}>
                        <div className="section-label">AI Power Opportunity</div>
                        <div style={{ fontSize: 13, color: "var(--text-light)", lineHeight: 1.7 }}>
                            Intel's strongest gap vs Nvidia is <span style={{ color: "var(--danger)", fontWeight: 700 }}>Idle Efficiency (42 vs 88)</span>.
                            AI-driven dynamic profiling could close this to <span style={{ color: "var(--success)", fontWeight: 700 }}>70+ by Celestial</span> —
                            a <span style={{ color: "var(--success)", fontWeight: 700 }}>67% improvement</span> in the single most visible pain point.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
    const [activeTab, setActiveTab] = useState("overview");
    const [hoursPerDay, setHoursPerDay] = useState(8);
    const [energyCost, setEnergyCost] = useState(0.15);
    const [selectedGPU, setSelectedGPU] = useState("Intel Arc B580");
    const [aiMode, setAiMode] = useState(true);

    const tabs = [
        { id: "overview", label: "Overview" },
        { id: "realtime", label: "Live AI" },
        { id: "pipeline", label: "ML Pipeline" },
        { id: "roadmap", label: "Roadmap" },
        { id: "competitive", label: "Competitive" },
    ];

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-hero)", position: "relative" }}>
            {/* Hero Glow Effect */}
            <div className="hero-glow" />

            {/* ─── HEADER ─── */}
            <header className="app-header">
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <img src={`${import.meta.env.BASE_URL}gpu-logo.png`} alt="GPU" style={{ width: 32, height: 32, borderRadius: 6 }} />
                    <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: 0.5, color: "#fff" }}>GPU</span>
                    <div style={{ width: 1, height: 20, background: "rgba(0,104,181,0.2)" }} />
                    <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500, letterSpacing: 1 }}>Power Intelligence System</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className={`status-dot ${aiMode ? "active" : "inactive"}`} />
                        <span style={{ fontSize: 12, color: aiMode ? "var(--success)" : "var(--text-dim)", fontWeight: 600 }}>
                            {aiMode ? "AI Active" : "Static Mode"}
                        </span>
                    </div>
                    <button onClick={() => setAiMode(m => !m)} className={aiMode ? "intel-btn intel-btn-outline" : "intel-btn intel-btn-ghost"}
                        style={{ fontSize: 12 }}>
                        {aiMode ? "Disable AI" : "Enable AI"}
                    </button>
                </div>
            </header>

            {/* ─── TABS ─── */}
            <nav className="app-nav">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`intel-tab ${activeTab === tab.id ? "active" : ""}`}>
                        {tab.label}
                    </button>
                ))}
            </nav>

            {/* ─── CONTENT ─── */}
            <main className="app-main">
                {activeTab === "overview" && <OverviewTab {...{ selectedGPU, setSelectedGPU, hoursPerDay, setHoursPerDay, energyCost, setEnergyCost }} />}
                {activeTab === "realtime" && <RealtimeTab aiMode={aiMode} />}
                {activeTab === "pipeline" && <PipelineTab />}
                {activeTab === "roadmap" && <RoadmapTab />}
                {activeTab === "competitive" && <CompetitiveTab />}
            </main>

            {/* ─── FOOTER ─── */}
            <footer className="app-footer">
                <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>
                    Data: Tom's Hardware · Phoronix · Intel VTune · Public Benchmarks · arXiv Research
                </span>
                <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>
                    GPU Power Intelligence Platform v1.0 — AI/ML-Centric Prototype
                </span>
            </footer>
        </div>
    );
}
