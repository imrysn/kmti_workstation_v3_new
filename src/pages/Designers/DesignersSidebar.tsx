import React from 'react'

interface DesignersSidebarProps {
  categories: string[]
  selectedCategory: string
  setSelectedCategory: (cat: string) => void
}

export default function DesignersSidebar({
  categories,
  selectedCategory,
  setSelectedCategory
}: DesignersSidebarProps) {
  return (
    <aside className="designers-sidebar">
      <div className="sidebar-card">
        <h3 className="sidebar-title">Categories</h3>
        <div className="category-pills-container">
          <button
            className={`category-pill all-pill ${selectedCategory === '' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('')}
          >
            All Designers
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
