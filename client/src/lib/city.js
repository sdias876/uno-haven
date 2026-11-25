// Each table gets one of Spade Haven's city scenes, picked from its code (same for everyone at the table).
export const CITIES = [['newyork', 'New York'], ['monaco', 'Monaco'], ['seattle', 'Seattle'], ['chicago', 'Chicago'], ['miami', 'Miami'], ['lasvegas', 'Las Vegas'], ['london', 'London']];
export const cityFor = (code) => { let h = 0; for (const ch of String(code)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return CITIES[h % CITIES.length]; };
