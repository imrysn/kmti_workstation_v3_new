import React, { useMemo } from 'react';
import './SpecFilter.css';

interface SpecFilterProps {
  searchResults: any[];
  selectedSpecs: string[];
  onSpecClick: (spec: string) => void;
  dynamicCategories?: string[];
}

const FALLBACK_SPECS = [
  'BOLT', 'WHEEL', 'CRANK', 'PLATE', 'SHAFT', 'GEAR', 'BRACKET', 
  'BUSHING', 'WASHER', 'PIN', 'SPRING', 'CABLE', 'CONNECTOR'
];

export const SpecFilter: React.FC<SpecFilterProps> = ({ 
  searchResults, selectedSpecs, onSpecClick, dynamicCategories = [] 
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = React.useState(false);
  const [showRight, setShowRight] = React.useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeft(scrollLeft > 10);
      setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  React.useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [dynamicCategories]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const specs = useMemo(() => {
    // 1. Always use the full master list
    const masterList = dynamicCategories.length > 0 ? dynamicCategories : FALLBACK_SPECS;
    
    const counts: Record<string, number> = {};
    if (searchResults.length > 0) {
      searchResults.forEach(item => {
        const name = (item.fileName || '').toUpperCase();
        const path = (item.filePath || '').toUpperCase();
        
        masterList.forEach(spec => {
          const upperSpec = spec.toUpperCase();
          if (name.includes(upperSpec) || path.includes(`/${upperSpec}/`)) {
            counts[spec] = (counts[spec] || 0) + 1;
          }
        });
      });
    }

    return masterList.map(name => ({
      name,
      count: counts[name] || 0
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [searchResults, dynamicCategories]);

  return (
    <div className="spec-filter-container">
      <div className="spec-filter-label">Quick Filter:</div>
      
      <div className="spec-filter-wrapper">
        {showLeft && (
          <button className="scroll-btn left" onClick={() => scroll('left')}>
            ‹
          </button>
        )}
        
        <div 
          className="spec-filter-list" 
          ref={scrollRef} 
          onScroll={checkScroll}
        >
          <button 
            className={`spec-pill ${selectedSpecs.length === 0 ? 'active' : ''}`}
            onClick={() => onSpecClick('')}
          >
            ALL
          </button>
          {specs.map(({ name, count }) => (
            <button 
              key={name}
              className={`spec-pill ${selectedSpecs.includes(name) ? 'active' : ''}`}
              onClick={() => onSpecClick(name)}
            >
              {name} 
              {count > 0 && <span className="spec-count">{count}</span>}
            </button>
          ))}
        </div>

        {showRight && (
          <button className="scroll-btn right" onClick={() => scroll('right')}>
            ›
          </button>
        )}
      </div>
    </div>
  );
};
