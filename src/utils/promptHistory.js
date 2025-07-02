const HISTORY_KEY = 'prompt-history';
const MAX_HISTORY_LENGTH = 50;

// Load prompt history from localStorage
export const loadPromptHistory = () => {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('Error loading prompt history:', error);
    return [];
  }
};

// Save prompt to history
export const savePromptToHistory = (prompt, imageUrl, size, quality, thumbnail = null) => {
  try {
    const history = loadPromptHistory();
    
    // Create new history entry
    const newEntry = {
      id: Date.now() + Math.random(),
      prompt: prompt.trim(),
      timestamp: new Date().toISOString(),
      size,
      quality,
      imageUrl,
      thumbnail: thumbnail || imageUrl, // Use provided thumbnail or fallback to imageUrl
      isFavorite: false
    };

    // Add to beginning of array (newest first)
    const updatedHistory = [newEntry, ...history];

    // Trim to max length
    const trimmedHistory = updatedHistory.slice(0, MAX_HISTORY_LENGTH);

    // Save back to localStorage
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedHistory));
    
    return newEntry;
  } catch (error) {
    console.error('Error saving prompt to history:', error);
    return null;
  }
};

// Toggle favorite status of a history entry
export const toggleHistoryFavorite = (entryId) => {
  try {
    const history = loadPromptHistory();
    const updatedHistory = history.map(entry => 
      entry.id === entryId 
        ? { ...entry, isFavorite: !entry.isFavorite }
        : entry
    );
    
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
    return updatedHistory;
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return loadPromptHistory();
  }
};

// Delete a history entry
export const deleteHistoryEntry = (entryId) => {
  try {
    const history = loadPromptHistory();
    const updatedHistory = history.filter(entry => entry.id !== entryId);
    
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
    return updatedHistory;
  } catch (error) {
    console.error('Error deleting history entry:', error);
    return loadPromptHistory();
  }
};

// Clear all history
export const clearAllHistory = () => {
  try {
    localStorage.removeItem(HISTORY_KEY);
    return [];
  } catch (error) {
    console.error('Error clearing history:', error);
    return loadPromptHistory();
  }
};

// Sort history entries
export const sortHistory = (history, sortBy) => {
  switch (sortBy) {
    case 'newest':
      return [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    case 'oldest':
      return [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    case 'favorited':
      return [...history].sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return new Date(b.timestamp) - new Date(a.timestamp); // Secondary sort by newest
      });
    default:
      return history;
  }
};

// Format timestamp for display
export const formatTimestamp = (timestamp) => {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  } catch (error) {
    return 'Unknown date';
  }
};