export function shortenCategories(categories, maxLen = 40) {
    if (!categories || categories.length === 0) return "N/A";
    const joined = categories.join(', ');
    return joined.length > maxLen
        ? joined.substring(0, maxLen).trim() + '…'
        : joined;
}

// You can add other shared utility functions here