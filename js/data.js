// Local demo data — no API, no backend.
// Facet codes: L Visionary Leader · G Golfer · F Family Man · M Mentor · W Global Leader · H Humanitarian · J Journey

window.FACETS = [
  {
    code: 'L', name: 'Visionary Leader', short: 'Leader',
    kicker: 'He saw further — and built toward it.',
    lede: 'Colleagues describe a leader who pairs long-range vision with an unhurried calm: setting direction with conviction, then inviting everyone to grow into it.',
    stops: ['#120a2e', '#5b1a8a', '#ff2e88', '#ffb000', '#fff4dc'],
    c1: '#ff2e88', c2: '#ffb000', shape: 'photo'
  },
  {
    code: 'G', name: 'Sports Enthusiast', short: 'Golfer',
    kicker: 'Patience, precision, and the quiet joy of the game.',
    lede: 'On the course the same qualities show up: a steady swing, a competitor’s focus, and a deep respect for fair play.',
    stops: ['#04201b', '#08604a', '#0fbf7f', '#c6f35a', '#f5ffe2'],
    c1: '#0fbf7f', c2: '#c6f35a', shape: 'golf'
  },
  {
    code: 'F', name: 'Family Man', short: 'Family',
    kicker: 'Behind every title, a home full of warmth.',
    lede: 'A father and grandfather first — the values he carries into every boardroom were shaped, and are still kept, at home.',
    stops: ['#2a070e', '#8a1626', '#ff4b2b', '#ffb36b', '#fff1e3'],
    c1: '#ff4b2b', c2: '#ffb36b', shape: 'family'
  },
  {
    code: 'M', name: 'Mentor', short: 'Mentor',
    kicker: 'He believed in people before they believed in themselves.',
    lede: 'Generations of leaders remember a conversation, a nudge, a door held open. His greatest product may be the people he shaped.',
    stops: ['#0a1030', '#1d3a9e', '#2f6bff', '#8fd3ff', '#eef8ff'],
    c1: '#2f6bff', c2: '#8fd3ff', shape: 'mentor'
  },
  {
    code: 'W', name: 'Global Leader', short: 'Global',
    kicker: 'An Indian story, told to the world.',
    lede: 'Built on relationships and mutual respect, his reach extends across markets, cultures and continents — always with India at its heart.',
    stops: ['#071430', '#0a5a7a', '#00b3c7', '#ffd23f', '#fff8dc'],
    c1: '#00b3c7', c2: '#ffd23f', shape: 'global'
  },
  {
    code: 'H', name: 'Humanitarian', short: 'Humanitarian',
    kicker: 'Progress means little unless it lifts others.',
    lede: 'Education, health, opportunity, dignity: a quieter body of work, driven by the belief that business exists to serve society.',
    stops: ['#22071f', '#7a1260', '#e0218a', '#ff9fc0', '#fff0f6'],
    c1: '#e0218a', c2: '#ff9fc0', shape: 'humanitarian'
  },
  {
    code: 'J', name: 'Journey', short: 'Journey',
    kicker: 'Decades of roads travelled, and still moving.',
    lede: 'Milestones, memories and millions of miles — a life measured not only in what was built, but in everyone who came along for the ride.',
    stops: ['#1a0f03', '#6e3609', '#e0741a', '#ffcc33', '#fffae6'],
    c1: '#e0741a', c2: '#ffcc33', shape: 'journey'
  }
];

window.FINAL_STOPS = ['#160a2c', '#7a1fa0', '#ff2e88', '#ff7a1a', '#ffd23f', '#fffaf0'];

// Visitor colour palette (pick one)
window.ACCENTS = [
  { name: 'Saffron', hex: '#FFB000' },
  { name: 'Magenta', hex: '#FF2E88' },
  { name: 'Electric', hex: '#3D7BFF' },
  { name: 'Emerald', hex: '#10D48E' },
  { name: 'Coral', hex: '#FF5A36' }
];

// Curated vocabulary: "word[,alias…]|FACETS"
window.VOCAB_RAW = [
  'vision,visionary,visions|LW', 'leadership,leader,leaders,lead,leading|LW', 'courage,courageous,brave|LM',
  'conviction|L', 'ambition,ambitious|LJ', 'innovation,innovative,innovate,innovator|L', 'boldness,bold|L',
  'decisive,decisiveness|L', 'strategy,strategic|L', 'future|LJ', 'foresight|L', 'pioneer,pioneering,pioneered|LJ',
  'builder,build,built,building|LJ', 'excellence,excellent|LG', 'quality|L', 'discipline,disciplined|LG',
  'resilience,resilient|LJ', 'determination,determined|LG', 'integrity|LM', 'trust,trusted,trustworthy|LFW',
  'clarity|L', 'focus,focused|LG', 'purpose,purposeful|HJ', 'legacy|LJF', 'scale|LW', 'progress|LH',
  'transformation,transform,transformed,transformative|L', 'grit|LG', 'drive,driven|L', 'commitment,committed|LF',
  'principles,principled|LM', 'wisdom,wise|ML', 'patience,patient|MG', 'calm,calmness|LG', 'composure|LG',
  'dignity,dignified|HL', 'institution,institutions|L', 'ethics,ethical|LH', 'execution|L', 'conviction|L',
  'golf,golfer,golfing|G', 'passion,passionate|GL', 'precision,precise|GL', 'sport,sports,sporting|G',
  'sportsmanship,sportsman|G', 'game|G', 'swing|G', 'champion,champions,championship|G',
  'competitive,competition,compete|G', 'fairness,fair|GM', 'fitness,fit|G', 'energy,energetic|GL',
  'spirit,spirited|GJ', 'teamwork,team,teams|GM', 'victory,win,winning|G', 'balance,balanced|GF',
  'practice|G', 'rhythm|G', 'joy,joyful|GF', 'play,playing|G', 'course|G', 'concentration|G',
  'family,families|F', 'father,dad,papa|F', 'love,loved,loving|F', 'warmth,warm|F', 'home|F',
  'children|F', 'grandfather|F', 'care,caring,cared|FH', 'kindness,kind|FH', 'laughter,laugh,laughing|F',
  'tradition,traditions|FJ', 'values|FL', 'roots|FJ', 'togetherness,together|F', 'gentle,gentleness|F',
  'affection,affectionate|F', 'devotion,devoted|F', 'respect,respected,respectful|FWM',
  'humility,humble|MF', 'generosity,generous|FH', 'presence|FW', 'gratitude,grateful|FJ', 'belonging|F',
  'bond,bonds|F', 'heart|FH', 'protector,protective|F', 'smile,smiles|F', 'simplicity,simple|F',
  'mentor,mentored,mentoring,mentorship|M', 'guidance,guide,guided,guiding|M', 'teacher,teach,taught,teaching|M',
  'belief,believe,believed,believing|M', 'encouragement,encourage,encouraged,encouraging|M',
  'listener,listen,listened,listening|M', 'inspiration,inspire,inspired,inspiring,inspires,inspirational|MLJ',
  'empowerment,empower,empowered|MH', 'growth,grow,grew,grown|ML', 'confidence,confident|M',
  'opportunity,opportunities|MH', 'nurture,nurtured,nurturing|MF', 'lessons,lesson|MJ', 'example|M',
  'potential|M', 'coach,coached|MG', 'curiosity,curious|M', 'learning,learn,learned,learnt|M',
  'possibility,possibilities,possible|M', 'standards|ML', 'empathy,empathetic|MH', 'approachable|M',
  'honesty,honest|M', 'generations,generation|MJ', 'patience|M', 'faith|M',
  'global,globally|W', 'world,worldwide|W', 'relationships,relationship|WF', 'partnership,partnerships,partner,partners|W',
  'india,indian|W', 'pride,proud|WF', 'ambassador|W', 'bridges,bridge|W', 'diplomacy|W', 'network|W',
  'collaboration,collaborate,collaborative|W', 'openness,open|W', 'horizons|WJ', 'nations|W',
  'cultures,culture,cultural|W', 'reach|W', 'influence|W', 'stature|W', 'connection,connect,connected,connections|W',
  'mobility|WJ', 'markets|W', 'goodwill|WH',
  'compassion,compassionate|H', 'service,serve,served,serving|H', 'giving,give,gave,giver|H', 'education|H',
  'health,healthcare|H', 'community,communities|H', 'hope|H', 'upliftment,uplift,uplifting|H', 'society|H',
  'responsibility,responsible|H', 'change|HJ', 'impact|HL', 'humanity,humane,human|H',
  'philanthropy,philanthropic|H', 'selfless,selflessness|H', 'sustainability,sustainable|H', 'equality|H',
  'inclusion,inclusive|H', 'villages,village|H', 'women|H',
  'journey,journeys|J', 'road,roads|J', 'milestones,milestone|J', 'memories,memory|J', 'story,stories|J',
  'decades|J', 'chapter|J', 'history|J', 'path|J', 'dreams,dream,dreamer|J', 'adventure|J',
  'perseverance,persevere|J', 'evolution,evolve,evolved|J', 'beginnings|J', 'celebration,celebrate|J',
  'life|J', 'horizon|J', 'freedom|J', 'miles|J', 'motion|J', 'ride,riding|J', 'wonder|J',
  'thanks,thank,thankful|J', 'birthday|J', 'blessings,blessed|J', 'years|J'
];

// Fallback words when nothing meaningful matches — these map to Journey.
window.FALLBACK_WORDS = ['gratitude', 'inspiration', 'journey', 'legacy', 'celebration', 'respect'];

// Demo messages (fictional contributors)
window.SAMPLE_MESSAGES = [
  { text: 'You always believed in us and pushed us to do better. Your guidance shaped my whole career.', name: 'Ritika Sharma', rel: 'Colleague, Hero MotoCorp' },
  { text: 'A true visionary. You saw the future of Indian mobility long before anyone else and had the courage to build it.', name: 'Arjun Mehta', rel: 'Industry peer' },
  { text: 'The humility with which you carry such stature is the greatest lesson I have learned.', name: 'Kavya Iyer', rel: 'Former trainee' },
  { text: 'Watching you on the golf course taught me that patience and precision win more than power ever will.', name: 'Daniel Okafor', rel: 'Golf partner' },
  { text: 'Papa, your warmth and laughter are the heart of our family. Thank you for every memory.', name: 'A. M.', rel: 'Family' },
  { text: 'Your relationships across the world turned partners into friends. India is proud of you.', name: 'Hiroshi Tanaka', rel: 'Global partner' },
  { text: 'Thank you for giving thousands of children access to education and hope.', name: 'Sunita Rao', rel: 'NGO partner' },
  { text: 'From the first factory to the world stage — what a journey. Happy birthday!', name: 'Vikram Singh', rel: 'Dealer partner, 30 years' },
  { text: 'You listen more than you speak, and when you speak it is always with wisdom.', name: 'Meera Kapoor', rel: 'Board member' },
  { text: 'Your integrity and conviction set the standards for an entire industry.', name: 'Rahul Bansal', rel: 'Supplier' },
  { text: 'You taught me that leadership is service, and that compassion is a strength.', name: 'Neha Gupta', rel: 'Mentee' },
  { text: 'A fair and passionate competitor, and the most gracious champion.', name: 'Sameer Khan', rel: 'Sports foundation' },
  { text: 'Thank you for the dignity and respect you show every single person on the shop floor.', name: 'Ramesh Kumar', rel: 'Plant associate, Gurugram' },
  { text: 'Your curiosity is contagious. Every conversation with you opens a new possibility.', name: 'Priya Nair', rel: 'Innovation team' },
  { text: 'You built bridges between cultures and markets with grace and openness.', name: 'Elena Rossi', rel: 'International partner' },
  { text: 'Grateful for your generosity, your kindness and the gentle way you care for everyone.', name: 'Farah Siddiqui', rel: 'Family friend' },
  { text: 'You empower women and villages through opportunity, not charity. That is real impact.', name: 'Lakshmi Devi', rel: 'Community partner' },
  { text: 'Decades of milestones, and you still dream bigger than all of us. Here’s to the road ahead.', name: 'Anil Joshi', rel: 'Colleague since 1990' },
  { text: 'Your resilience in difficult years gave all of us the confidence to keep going.', name: 'Sanjay Verma', rel: 'Leadership team' },
  { text: 'An inspiring mentor who nurtured generations of leaders with patience and faith.', name: 'Deepa Menon', rel: 'Alumni network' },
  { text: 'Your discipline and focus on the course mirror the way you lead.', name: 'Tom Whitaker', rel: 'Golf partner' },
  { text: 'Thank you for treating us as family and showing us what simplicity and values look like.', name: 'Pooja Arora', rel: 'Executive assistant' }
];
