// Each table gets one of Spade Haven's city scenes, picked from its code (same for everyone at the table).
export const CITIES = [['newyork', 'New York'], ['monaco', 'Monaco'], ['seattle', 'Seattle'], ['chicago', 'Chicago'], ['miami', 'Miami'], ['lasvegas', 'Las Vegas'], ['london', 'London']];
export const cityFor = (code) => { let h = 0; for (const ch of String(code)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return CITIES[h % CITIES.length]; };
// Online lobby tables: the city goes up with the bet, like Spade Haven.
export const BET_CITY = { 100: 'newyork', 500: 'chicago', 1000: 'miami', 2500: 'seattle', 5000: 'lasvegas', 10000: 'london' };
export const cityForBet = (bet) => CITIES.find(([k]) => k === (BET_CITY[bet] ?? 'newyork'));
/** A room's city: public tables name theirs, private ones get one from their code. */
export const cityOf = (room) => (room?.settings?.city && CITIES.find(([, n]) => n === room.settings.city)) || cityFor(room?.code);
