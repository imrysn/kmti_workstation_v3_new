
interface PaginationFooterProps {
  currentPage: number
  setCurrentPage: (page: number | ((prev: number) => number)) => void
  totalPages: number
  totalItems: number
  itemsPerPage: number
  setItemsPerPage: (val: number) => void
}

export default function PaginationFooter({
  currentPage,
  setCurrentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  setItemsPerPage
}: PaginationFooterProps) {
  return (
    <div className="table-footer">
      <div className="table-footer-info">
        Showing <strong>{Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}–{Math.min(totalItems, currentPage * itemsPerPage)}</strong> of <strong>{totalItems}</strong> quotations
      </div>
      <div className="pagination-group">
        <button
          className="btn btn-ghost pagination-btn"
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
        >
          «
        </button>
        <button
          className="btn btn-ghost pagination-btn"
          onClick={() => setCurrentPage(prev => Math.max(1, typeof prev === 'number' ? prev - 1 : 1))}
          disabled={currentPage === 1}
        >
          ‹ Prev
        </button>

        {/* Page number pills */}
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let page = i + 1
          if (totalPages > 5) {
            const half = 2
            page = Math.min(
              Math.max(currentPage - half + i, 1),
              totalPages - 4 + i
            )
          }
          return (
            <button
              key={page}
              className={`btn pagination-btn pagination-page-btn ${currentPage === page ? 'pagination-page-active' : 'btn-ghost'}`}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </button>
          )
        })}

        <button
          className="btn btn-ghost pagination-btn"
          onClick={() => setCurrentPage(prev => Math.min(totalPages, typeof prev === 'number' ? prev + 1 : totalPages))}
          disabled={currentPage === totalPages}
        >
          Next ›
        </button>
        <button
          className="btn btn-ghost pagination-btn"
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
        >
          »
        </button>

        <div className="pagination-rows-label">
          Rows per page:
          <select
            value={itemsPerPage}
            onChange={e => {
              setItemsPerPage(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="filter-input pagination-rows-select"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
          </select>
        </div>
      </div>
    </div>
  )
}
