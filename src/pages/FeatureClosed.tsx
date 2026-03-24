import React from 'react';
import { useNavigate } from 'react-router-dom';
import './FeatureClosed.css';

const BarrierSVG = () => (
    <svg width="450" height="200" viewBox="0 0 450 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="svg-hero-barrier-v2">
        <defs>
            <linearGradient id="metal-leg" x1="0" y1="0" x2="20" y2="100" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#3a3a3a" />
                <stop offset="0.5" stopColor="#1a1a1a" />
                <stop offset="1" stopColor="#0a0a0a" />
            </linearGradient>
            <radialGradient id="strobe-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(380 30) scale(60)">
                <stop offset="0" stopColor="#FFD600" stopOpacity="0.8" />
                <stop offset="1" stopColor="#FFD600" stopOpacity="0" />
            </radialGradient>
        </defs>

        {/* Strobe Light Glow */}
        <circle cx="380" cy="30" r="40" fill="url(#strobe-glow)" className="strobe-pulse" />

        {/* Legs with Bolt Details */}
        <g className="barrier-legs">
            <rect x="80" y="80" width="18" height="110" fill="url(#metal-leg)" rx="2" stroke="#000" strokeWidth="1" />
            <rect x="352" y="80" width="18" height="110" fill="url(#metal-leg)" rx="2" stroke="#000" strokeWidth="1" />
            <circle cx="89" cy="95" r="2" fill="#555" />
            <circle cx="361" cy="95" r="2" fill="#555" />
        </g>

        {/* Board Depth (3D effect) */}
        <rect x="25" y="25" width="400" height="80" rx="4" fill="#886b00" />
        
        {/* Main Board */}
        <rect x="20" y="20" width="400" height="80" rx="4" fill="#FFD600" stroke="#000" strokeWidth="3" />
        
        {/* Stripes */}
        <mask id="board-mask-v3">
            <rect x="20" y="20" width="400" height="80" rx="4" fill="white" />
        </mask>
        <g mask="url(#board-mask-v3)">
            {[0, 80, 160, 240, 320, 400, 480].map((x) => (
                <path key={x} d={`M${x - 60} 20L${x} 100H${x + 60}L${x} 20H${x - 60}Z`} fill="#000" />
            ))}
        </g>

        {/* Warning Strobe Unit */}
        <g transform="translate(370, 15)">
            <rect width="20" height="15" rx="2" fill="#222" />
            <rect x="2" y="-5" width="16" height="8" rx="2" fill="#FFD600" className="strobe-blink" />
        </g>

        {/* Stencil Text */}
        <text x="50" y="68" fill="#000" fillOpacity="0.1" fontSize="14" fontWeight="900" style={{ letterSpacing: '4px' }}>KMTI-SECURED</text>
    </svg>
);

const ConeSVG = ({ className }: { className?: string }) => (
    <svg width="100" height="120" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
            <linearGradient id="cone-grad" x1="50" y1="0" x2="50" y2="100" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#FF3D00" />
                <stop offset="0.8" stopColor="#BF360C" />
            </linearGradient>
        </defs>
        
        {/* Hard Base (3D look) */}
        <path d="M10 100L90 100L85 115L15 115Z" fill="#111" />
        <rect x="10" y="90" width="80" height="12" rx="2" fill="#222" />
        
        {/* Cone Body with better 3D shape */}
        <path d="M50 5C53 5 80 85 80 90C80 95 20 95 20 90C20 85 47 5 50 5Z" fill="url(#cone-grad)" />
        
        {/* Reflector Band (Wrapped look) */}
        <path d="M34 50C34 50 50 45 66 50C66 50 64 68 64 68C64 68 50 64 36 68C36 68 34 50 34 50Z" fill="white" fillOpacity="0.9" />
        
        {/* Micro Detail: "KMTI" Stencil on cone */}
        <text x="43" y="85" fill="black" fillOpacity="0.15" fontSize="6" fontWeight="900" transform="rotate(-5, 50, 85)">KMTI</text>

        {/* Highlight */}
        <path d="M48 10C48 10 35 80 35 85" stroke="white" strokeOpacity="0.1" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const FullWidthTape = ({ rotation, top, speed }: { rotation: number, top: string, speed: string }) => (
    <div className="full-width-tape" style={{ rotate: `${rotation}deg`, top }}>
        <div className="tape-content" style={{ animationDuration: speed }}>
            {[...Array(12)].map((_, i) => (
                <span key={i}>● FEATURE CLOSED ● CAUTION ● NO ACCESS ● </span>
            ))}
        </div>
    </div>
);

const FeatureClosed: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="closed-page-container">
            {/* Siren Lights Ambient - MOVED TO TOP OF DOM FOR Z-INDEX CLARITY */}
            <div className="siren-light red-siren"></div>
            <div className="siren-light blue-siren"></div>

            {/* Viewport Tapes */}
            <FullWidthTape rotation={-12} top="15%" speed="20s" />
            <FullWidthTape rotation={8} top="80%" speed="25s" />

            <div className="closed-page-content">
                <div className="hero-visual-v2">
                    <BarrierSVG />
                    {/* Scattered Industrial Cones */}
                    <ConeSVG className="hero-cone-v3 c1" />
                    <ConeSVG className="hero-cone-v3 c2" />
                    <ConeSVG className="hero-cone-v3 c3" />
                </div>

                <div className="closed-page-text">
                    <h1 className="closed-title">Feature Closed</h1>
                    <p className="closed-status">This feature isn't available right now</p>
                    <p className="closed-action">Please contact Dev Team for updates</p>
                    
                    <button className="back-btn-emergency" onClick={() => navigate(-1)}>
                        <div className="btn-strobe-bg"></div>
                        <span>← Back to Safety</span>
                    </button>
                </div>
            </div>

            {/* Atmospheric Particles */}
            <div className="dust-container">
                {[...Array(24)].map((_, i) => (
                    <div key={i} className="dust-particle" style={{ 
                        left: `${Math.random() * 100}%`, 
                        top: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 8}s`,
                        opacity: Math.random() * 0.4
                    }}></div>
                ))}
            </div>

            <div className="dark-vignette-heavy"></div>
        </div>
    );
};

export default FeatureClosed;
