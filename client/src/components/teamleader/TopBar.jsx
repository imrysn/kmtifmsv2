const TopBar = ({
  toggleSidebar,
  searchQuery,
  setSearchQuery
}) => {
  return (
    <header className="tl-top-bar">
      <button className="tl-hamburger" onClick={toggleSidebar}>
        <span></span>
        <span></span>
        <span></span>
      </button>

      <div className="tl-search">
        <svg className="tl-search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M9 17C13.4183 17 17 13.4183 17 9C17 4.58172 13.4183 1 9 1C4.58172 1 1 4.58172 1 9C1 13.4183 4.58172 17 9 17Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M19 19L14.65 14.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <input
          type="text"
          placeholder="Search here..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>




    </header>
  )
}

export default TopBar
