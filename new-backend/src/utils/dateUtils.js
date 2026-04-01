/**
 * Convert month name or number to month number (1-12)
 */
const getMonthNumber = (month) => {
    if (!month) return null;
    
    // If it's already a number or a string containing a number
    if (!isNaN(month)) {
        const m = parseInt(month);
        if (m >= 1 && m <= 12) return m;
    }

    // If it's a month name
    const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];
    
    const lowerMonth = month.toString().toLowerCase().trim();
    const index = monthNames.indexOf(lowerMonth);
    
    if (index !== -1) return index + 1;

    // Short names
    const shortMonthNames = [
        'jan', 'feb', 'mar', 'apr', 'may', 'jun',
        'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ];
    const shortIndex = shortMonthNames.indexOf(lowerMonth);
    if (shortIndex !== -1) return shortIndex + 1;

    return null;
};

module.exports = {
    getMonthNumber
};
