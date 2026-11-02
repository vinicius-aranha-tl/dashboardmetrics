/** Decorative illustration; it does not represent real metrics. */
export function LoginArtwork() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-xl border border-[#50545a] bg-[#34373c] p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-[#777d85]" /><span className="h-2 w-20 rounded-full bg-[#62676e]" /></div>
      <svg viewBox="0 0 620 230" fill="none" className="block w-full" focusable="false">
        {[40, 85, 130, 175, 220].map(y => <line key={`h${y}`} x1="0" x2="445" y1={y} y2={y} stroke="#5b5e63" strokeDasharray="2 5" />)}
        {[40, 120, 200, 280, 360, 440].map(x => <line key={`v${x}`} x1={x} x2={x} y1="35" y2="220" stroke="#5b5e63" strokeDasharray="2 5" />)}
        <polyline points="5,188 45,175 85,153 125,158 165,139 205,119 245,125 285,95 325,103 365,68 405,60 445,32" stroke="#83b7ff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points="5,210 45,198 85,187 125,190 165,165 205,158 245,170 285,140 325,150 365,123 405,120 445,94" stroke="#72dfb0" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points="5,226 45,222 85,210 125,211 165,196 205,182 245,192 285,174 325,164 365,176 405,153 445,144" stroke="#c4a3ff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points="5,230 85,230 125,228 165,218 205,213 245,218 285,203 325,192 365,196 405,181 445,170" stroke="#ffb76b" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <rect x="475" y="14" width="145" height="205" rx="10" fill="#3e4248" stroke="#585d64" />
        <rect x="492" y="30" width="64" height="7" rx="3.5" fill="#777d85" /><rect x="492" y="47" width="40" height="7" rx="3.5" fill="#62676e" />
        <rect x="492" y="104" width="14" height="28" rx="3" fill="#83b7ff" /><rect x="515" y="92" width="14" height="40" rx="3" fill="#83b7ff" />
        <rect x="538" y="80" width="14" height="52" rx="3" fill="#c4a3ff" /><rect x="561" y="66" width="14" height="66" rx="3" fill="#c4a3ff" /><rect x="584" y="51" width="14" height="81" rx="3" fill="#c4a3ff" />
        {["#83b7ff", "#72dfb0", "#c4a3ff", "#ffb76b"].map((color, i) => <g key={color}><circle cx="500" cy={154 + i * 17} r="5" fill={color} /><rect x="513" y={151 + i * 17} width="72" height="6" rx="3" fill="#686d74" /></g>)}
      </svg>
    </div>
  );
}
