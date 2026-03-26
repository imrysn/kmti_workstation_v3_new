import React from 'react'
import './HeatTreatment.css'

interface HeatTreatmentSidebarProps {
  categories: string[]
  selectedCategory: string
  setSelectedCategory: (category: string) => void
}

const HeatTreatmentSidebar: React.FC<HeatTreatmentSidebarProps> = React.memo(({
  categories,
  selectedCategory,
  setSelectedCategory,
}) => {
  return (
    <div className="heat-treatment-sidebar">
      <div className="card sidebar-card">
        <h3 className="sidebar-title">Categories</h3>
        <div className="category-pills-container">
          <button
            onClick={() => setSelectedCategory('')}
            className={`category-pill ${selectedCategory === '' ? 'active' : ''}`}
            style={{ gridColumn: 'span 2' }}
          >
            All
          </button>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setSelectedCategory(selectedCategory === c ? '' : c)}
              className={`category-pill ${selectedCategory === c ? 'active' : ''}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
})

export default HeatTreatmentSidebar
