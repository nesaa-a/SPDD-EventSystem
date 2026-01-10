import { useState, useEffect } from 'react';
import { eventsAPI } from '../services/api';

function EventSearch({ onSearchResults }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await eventsAPI.getCategories();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const results = await eventsAPI.search(query, category);
      onSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClear = async () => {
    setQuery('');
    setCategory('');
    const allEvents = await eventsAPI.getAll();
    onSearchResults(allEvents);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div style={{backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '20px', marginBottom: '24px', border: '1px solid #e5e7eb'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end'}}>
          {/* Search Input */}
          <div style={{flex: '1', minWidth: '250px'}}>
            <label style={{display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px'}}>
              Search Events
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search by title, description, or location..."
              style={{width: '100%', padding: '10px 16px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px'}}
            />
          </div>

          {/* Category Filter */}
          <div style={{minWidth: '180px'}}>
            <label style={{display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px'}}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{width: '100%', padding: '10px 16px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', backgroundColor: 'white'}}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Buttons */}
          <div style={{display: 'flex', gap: '8px'}}>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              style={{padding: '10px 24px', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px'}}
            >
              {isSearching ? (
                <>
                  <span>⏳</span>
                  Searching...
                </>
              ) : (
                <>
                  🔍 Search
                </>
              )}
            </button>
            {(query || category) && (
              <button
                onClick={handleClear}
                style={{padding: '10px 16px', backgroundColor: '#e5e7eb', color: '#374151', borderRadius: '8px', border: 'none', cursor: 'pointer'}}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center'}}>
          <span style={{fontSize: '14px', color: '#6b7280', marginRight: '8px'}}>Quick filters:</span>
          {categories.slice(0, 6).map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategory(cat);
                setTimeout(handleSearch, 0);
              }}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: category === cat ? '#2563eb' : '#f3f4f6',
                color: category === cat ? 'white' : '#4b5563'
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default EventSearch;
