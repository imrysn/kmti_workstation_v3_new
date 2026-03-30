import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('KMTI Workstation Caught Fatal Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', width: '100vw', backgroundColor: '#f1f5f9', color: '#1e293b',
          fontFamily: 'Inter, system-ui, sans-serif', padding: '40px', boxSizing: 'border-box', textAlign: 'center'
        }}>
          <div style={{ marginBottom: '24px' }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <h1 style={{ fontSize: '28px', marginBottom: '12px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            System Encountered an Error
          </h1>
          <p style={{ fontSize: '15px', color: '#64748b', marginBottom: '32px', maxWidth: '500px', lineHeight: 1.6 }}>
            The Workstation interface has crashed unexpectedly. Your data is safe on the NAS, but this window needs to be reloaded.
          </p>
          
          <div style={{ 
            backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', 
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', textAlign: 'left', width: '100%', maxWidth: '800px',
            marginBottom: '32px', overflow: 'auto', border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' }}>ERROR DETAILS</div>
            <pre style={{ margin: 0, color: '#e11d48', fontSize: '13px', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {this.state.error?.toString() || "Unknown Error"}
            </pre>
          </div>

          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 32px', backgroundColor: '#e11d48', color: 'white', fontSize: '14px',
              fontWeight: 600, border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s',
              boxShadow: '0 4px 12px rgba(225, 29, 72, 0.2)'
            }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = '#be123c'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = '#e11d48'}
          >
            RELOAD APPLICATION
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
