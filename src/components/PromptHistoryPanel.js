import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  Heart, 
  Trash2, 
  RotateCcw, 
  Filter,
  Search,
  Image as ImageIcon 
} from 'lucide-react';
import { 
  loadPromptHistory, 
  toggleHistoryFavorite, 
  deleteHistoryEntry, 
  clearAllHistory,
  sortHistory,
  formatTimestamp 
} from '../utils/promptHistory';
import './PromptHistoryPanel.css';

const PromptHistoryPanel = ({ 
  isOpen, 
  onClose, 
  onReloadPrompt,
  currentPrompt 
}) => {
  const [history, setHistory] = useState([]);
  const [sortBy, setSortBy] = useState('newest');
  const [searchTerm, setSearchTerm] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load history on component mount and when panel opens
  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = () => {
    const historyData = loadPromptHistory();
    setHistory(sortHistory(historyData, sortBy));
  };

  // Update sorting when sortBy changes
  useEffect(() => {
    setHistory(prevHistory => sortHistory(prevHistory, sortBy));
  }, [sortBy]);

  const handleToggleFavorite = (entryId) => {
    const updatedHistory = toggleHistoryFavorite(entryId);
    setHistory(sortHistory(updatedHistory, sortBy));
  };

  const handleDeleteEntry = (entryId) => {
    const updatedHistory = deleteHistoryEntry(entryId);
    setHistory(sortHistory(updatedHistory, sortBy));
  };

  const handleClearAll = () => {
    if (showClearConfirm) {
      const clearedHistory = clearAllHistory();
      setHistory(clearedHistory);
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  };

  const handleReloadPrompt = (entry) => {
    onReloadPrompt({
      prompt: entry.prompt,
      size: entry.size,
      quality: entry.quality
    });
    onClose();
  };

  // Filter history based on search term
  const filteredHistory = history.filter(entry =>
    entry.prompt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const truncatePrompt = (prompt, maxLength = 100) => {
    return prompt.length > maxLength ? prompt.slice(0, maxLength) + '...' : prompt;
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="history-backdrop" 
          onClick={onClose}
        />
      )}
      
      {/* Panel */}
      <div className={`history-panel ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="history-header">
          <div className="history-title">
            <Clock size={20} />
            <span>Prompt History</span>
          </div>
          <button 
            className="history-close-btn"
            onClick={onClose}
            aria-label="Close history panel"
          >
            <X size={20} />
          </button>
        </div>

        {/* Controls */}
        <div className="history-controls">
          {/* Search */}
          <div className="history-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="history-search-input"
            />
          </div>

          {/* Sort and Actions */}
          <div className="history-actions">
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="history-sort-select"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="favorited">Favorites First</option>
            </select>
            
            <button 
              className={`history-clear-btn ${showClearConfirm ? 'confirm' : ''}`}
              onClick={handleClearAll}
              title={showClearConfirm ? 'Click again to confirm' : 'Clear all history'}
            >
              <Trash2 size={16} />
              {showClearConfirm ? 'Confirm?' : 'Clear'}
            </button>
          </div>
        </div>

        {/* History List */}
        <div className="history-list">
          {filteredHistory.length === 0 ? (
            <div className="history-empty">
              {searchTerm ? (
                <>
                  <Search size={32} />
                  <p>No prompts found matching "{searchTerm}"</p>
                </>
              ) : (
                <>
                  <Clock size={32} />
                  <p>No prompt history yet</p>
                  <span>Generated images will appear here</span>
                </>
              )}
            </div>
          ) : (
            filteredHistory.map((entry) => (
              <div 
                key={entry.id} 
                className={`history-item ${entry.prompt === currentPrompt ? 'current' : ''}`}
              >
                {/* Thumbnail */}
                <div className="history-thumbnail">
                  {entry.thumbnail ? (
                    <img 
                      src={entry.thumbnail} 
                      alt="Generated" 
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="history-thumbnail-fallback">
                    <ImageIcon size={24} />
                  </div>
                </div>

                {/* Content */}
                <div className="history-content">
                  <div className="history-prompt">
                    {truncatePrompt(entry.prompt)}
                  </div>
                  
                  <div className="history-meta">
                    <span className="history-timestamp">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                    <span className="history-settings">
                      {entry.size} • {entry.quality}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="history-item-actions">
                  <button
                    className="history-action-btn"
                    onClick={() => handleReloadPrompt(entry)}
                    title="Reload this prompt"
                  >
                    <RotateCcw size={16} />
                  </button>
                  
                  <button
                    className={`history-action-btn favorite ${entry.isFavorite ? 'active' : ''}`}
                    onClick={() => handleToggleFavorite(entry.id)}
                    title={entry.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart size={16} fill={entry.isFavorite ? 'currentColor' : 'none'} />
                  </button>
                  
                  <button
                    className="history-action-btn delete"
                    onClick={() => handleDeleteEntry(entry.id)}
                    title="Delete this entry"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {filteredHistory.length > 0 && (
          <div className="history-footer">
            <span className="history-count">
              {filteredHistory.length} of {history.length} entries
              {searchTerm && ` matching "${searchTerm}"`}
            </span>
          </div>
        )}
      </div>
    </>
  );
};

export default PromptHistoryPanel;