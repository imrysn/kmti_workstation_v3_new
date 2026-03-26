import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFlags } from '../context/FlagsContext';
import './Maintenance.css';

const ServerHeroSVG = () => (
    <svg width="340" height="420" viewBox="0 0 340 420" fill="none" xmlns="http://www.w3.org/2000/svg" className="svg-server-hero">
        <defs>
            <linearGradient id="glass-shine" x1="0" y1="0" x2="340" y2="420" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="white" stopOpacity="0.1" />
                <stop offset="0.45" stopColor="white" stopOpacity="0.02" />
                <stop offset="0.5" stopColor="white" stopOpacity="0.15" />
                <stop offset="0.55" stopColor="white" stopOpacity="0.02" />
                <stop offset="1" stopColor="white" stopOpacity="0.05" />
            </linearGradient>
            <radialGradient id="cord-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(170 210) rotate(90) scale(200 170)">
                <stop offset="0" stopColor="#0099FF" stopOpacity="0.2" />
                <stop offset="1" stopColor="#0099FF" stopOpacity="0" />
            </radialGradient>
        </defs>

        {/* Backdrop Glow */}
        <circle cx="170" cy="210" r="150" fill="url(#cord-glow)" />

        {/* Rack Frame */}
        <rect x="40" y="20" width="260" height="380" rx="4" fill="#0c0c0e" stroke="#0099FF" strokeWidth="2" strokeOpacity="0.6" />

        {/* Server Units */}
        {[60, 115, 170, 225, 280, 335].map((y, i) => (
            <g key={y} className="server-unit">
                {/* Unit Body */}
                <rect x="50" y={y} width="240" height="45" rx="2" fill="#141416" />

                {/* Ventilation Grille */}
                <g opacity="0.3">
                    {[55, 65, 75, 85].map(gx => (
                        <rect key={gx} x={gx} y={y + 10} width="2" height="25" fill="#333" />
                    ))}
                </g>

                {/* Status LED Clusters */}
                <g transform={`translate(260, ${y + 15})`}>
                    <circle cx="0" cy="0" r="2.5" fill={i === 2 ? "#FF3D00" : "#00E5FF"} className="status-led pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                    <circle cx="8" cy="0" r="2.5" fill="#00E5FF" className="status-led pulse" style={{ animationDelay: `${i * 0.5}s` }} />
                </g>

                {/* Branding/Label on first unit */}
                {i === 0 && (
                    <text x="100" y={y + 28} fill="#0099FF" fontSize="10" fontWeight="900" style={{ letterSpacing: '2px', opacity: 0.8 }}>KMTI-WORKSTATION</text>
                )}
            </g>
        ))}

        {/* Cable Management (Fiber Optic Cords) */}
        <g className="fiber-cords" opacity="0.6">
            <path d="M50 70C20 100 20 150 50 180" stroke="#00D2FF" strokeWidth="1.5" strokeLinecap="round" className="cord-glow-path" />
            <path d="M290 120C320 150 320 200 290 230" stroke="#00D2FF" strokeWidth="1.5" strokeLinecap="round" className="cord-glow-path" style={{ animationDelay: '0.5s' }} />
            <path d="M290 290C330 320 330 360 290 380" stroke="#00D2FF" strokeWidth="1.5" strokeLinecap="round" className="cord-glow-path" style={{ animationDelay: '1s' }} />
        </g>

        {/* Integrated Gears */}
        <g className="integrated-gears-v2">
            <GearSVG x={285} y={80} size={40} speed="12s" />
            <GearSVG x={55} y={350} size={30} speed="18s" reverse />
        </g>

        {/* Glass Front Plate Overlay */}
        <rect x="40" y="20" width="260" height="380" rx="4" fill="url(#glass-shine)" style={{ pointerEvents: 'none' }} />
    </svg>
);

const GearSVG = ({ x, y, size, speed, reverse }: { x: number, y: number, size: number, speed: string, reverse?: boolean }) => (
    <g transform={`translate(${x}, ${y})`} className="gear-group-v2" style={{ animationDuration: speed, animationDirection: reverse ? 'reverse' : 'normal' }}>
        <circle cx="0" cy="0" r={size / 4} stroke="#00D2FF" strokeWidth="2" fill="none" strokeOpacity="0.5" />
        {[0, 60, 120, 180, 240, 300].map((angle) => (
            <rect key={angle} x={-size / 12} y={-size / 2} width={size / 6} height={size / 4} rx="0.5" fill="#00D2FF" fillOpacity="0.6" transform={`rotate(${angle})`} />
        ))}
    </g>
);

const SystemTape = ({ rotation, top, speed }: { rotation: number, top: string, speed: string }) => (
    <div className="system-update-tape" style={{ rotate: `${rotation}deg`, top }}>
        <div className="tape-scroller" style={{ animationDuration: speed }}>
            {[...Array(12)].map((_, i) => (
                <span key={i}>● SYSTEM UPDATE IN PROGRESS ● </span>
            ))}
        </div>
    </div>
);

const Maintenance: React.FC = () => {
    const { logout } = useAuth();
    const { flags } = useFlags();
    const navigate = useNavigate();

    const handleReturn = () => {
        if (flags.maintenance_mode) {
            logout();
            return;
        }

        // Define the standard shell modules and their flags
        const modules = [
            { path: '/parts', v: 'purchased_parts_enabled', m: 'purchased_parts_maintenance' },
            { path: '/characters', v: 'character_search_enabled', m: 'character_search_maintenance' },
            { path: '/heat-treatment', v: 'heat_treatment_enabled', m: 'heat_treatment_maintenance' },
            { path: '/calculator', v: 'calculator_enabled', m: 'calculator_maintenance' },
        ];

        // Find the first "safe" module (not hidden AND not in maintenance)
        const safeModule = modules.find(mod => flags[mod.v] && !flags[mod.m]);

        if (safeModule) {
            navigate(safeModule.path);
        } else {
            // If nothing is safe, treat as global maintenance
            logout();
        }
    };

    return (
        <div className="maint-root">
            {/* Viewport Tapes */}
            <SystemTape rotation={-10} top="12%" speed="18s" />
            <SystemTape rotation={6} top="84%" speed="22s" />

            {/* Dynamic Scanning Line */}
            <div className="scanner-line"></div>

            <div className="maint-content-wrapper">
                <div className="maint-hero">
                    <ServerHeroSVG />
                </div>

                <div className="maint-text-block">
                    <h1 className="maint-title-premium">Under Maintenance</h1>
                    <p className="maint-primary-msg">We're currently performing some updates.</p>
                    <p className="maint-secondary-msg">The system will be back online shortly.</p>

                    <button className="maint-btn-tech" onClick={handleReturn}>
                        <div className="btn-bg-glitch"></div>
                        <span className="btn-content">← Return to Shell</span>
                    </button>
                </div>
            </div>

            {/* Background Atmosphere */}
            <div className="tech-vignette-heavy"></div>
            <div className="circuit-circles">
                <div className="circle c-blue"></div>
                <div className="circle c-cyan"></div>
            </div>
        </div>
    );
};

export default Maintenance;
