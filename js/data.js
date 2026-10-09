// Local demo data — no API, no backend.
// Facet codes: L Visionary Leader · G Golfer · F Family Man · M Mentor · W Global Leader · H Humanitarian · J Journey

window.FACETS = [
  { code: 'L', name: 'Visionary Leader', short: 'Leader', img: 'leader', heads: [[0.45, 0.17, 0.2, 0.15]],
    ink: ['#6B4FA0', '#322741'],
    line: "He saw the road ahead long before anyone else, and built it.",
    anchor: [0.84, 0.52],   // the detail the note's line points to
    story: ["A leader who pairs long-range vision with an unhurried calm: setting direction with conviction, then inviting everyone around him to grow into it.", "Colleagues speak less of the strategy than of the clarity: a sense that the destination was always visible to him, and that he wanted everyone to see it too."] },
  { code: 'G', name: 'Sports Enthusiast', short: 'Golfer', img: 'golf', heads: [[0.17, 0.12, 0.2, 0.1]],
    strokes: [[0.393, 0.85, 0.308, 1.0]],   // the putter shaft, below his hands
    ink: ['#3B8D5D', '#203929'],
    line: "On the course, as in life: patience first, then precision.",
    anchor: [0.42, 0.79],   // the detail the note's line points to
    story: ["The same qualities show up on the green as in the boardroom: a steady swing, a competitor\u2019s focus and a deep respect for fair play.", "Partners remember the calm before a difficult putt, and the generosity after it, win or lose."] },
  { code: 'F', name: 'Family Man', short: 'Family', img: 'family', headScale: 1.3, heads: [[0.147, 0.192, 0.052, 0.098], [0.258, 0.213, 0.048, 0.092], [0.408, 0.116, 0.06, 0.124], [0.58, 0.208, 0.052, 0.098], [0.712, 0.271, 0.048, 0.092], [0.825, 0.199, 0.052, 0.098]],
    ink: ['#BF5B76', '#4b2931'],
    line: "Before every title, he is a father, a husband and a grandfather.",
    anchor: [0.84, 0.32],   // the detail the note's line points to
    story: ["The values he carries into every boardroom were shaped at home, and are still kept there.", "Family members describe a man who listens first, laughs easily and is never too busy to be present."] },
  { code: 'M', name: 'Mentor', short: 'Mentor', img: 'mentor', headScale: 1.1, headWeight: 600, heads: [[0.175, 0.203, 0.073, 0.145], [0.471, 0.151, 0.064, 0.145], [0.824, 0.221, 0.064, 0.156]],
    ink: ['#C9A227', '#594919'],
    line: "He believed in people before they believed in themselves.",
    anchor: [0.422, 0.568],   // the detail the note's line points to
    story: ["Generations of leaders remember a conversation, a nudge, a door held open at exactly the right moment.", "His greatest work may be the people he shaped, many of whom now lead in their own right."] },
  { code: 'W', name: 'Global Leader', short: 'Global', img: 'global', headScale: 1.15, heads: [[0.27, 0.2, 0.1, 0.16], [0.69, 0.22, 0.095, 0.16]],
    ink: ['#3F72B5', '#233348'],
    line: "An Indian story, told to the world, one handshake at a time.",
    anchor: [0.53, 0.6],   // the detail the note's line points to
    story: ["Built on relationships and mutual respect, his reach extends across markets and cultures, always with India at its heart.", "Partners abroad speak of trust earned slowly and kept for decades."] },
  { code: 'H', name: 'Humanitarian', short: 'Humanitarian', img: 'humanitarian', heads: [[0.6, 0.17, 0.13, 0.11]],
    ink: ['#D9822B', '#6b431c'],
    line: "Progress means little unless it lifts someone else.",
    anchor: [0.72, 0.68],   // the detail the note's line points to
    story: ["Education, health, opportunity and dignity: a quieter body of work, driven by the belief that business exists to serve society.", "Much of it happens far from cameras, in villages, classrooms and communities that rarely make the news."] },
  { code: 'J', name: 'Journey', short: 'Journey', img: 'journey', heads: [[0.32, 0.14, 0.14, 0.15]],
    ink: ['#B23A3A', '#401d1c'],
    line: "Millions of miles travelled, and he is still riding.",
    anchor: [0.38, 0.56],   // the detail the note's line points to
    story: ["Milestones, memories and miles, measured not only in what was built but in everyone who came along for the ride.", "The journey is far from over, and the road ahead is still the one he looks at most."] }
];

// The opening and closing portrait: the studio photograph, warm grey ink
window.STUDIO = { img: 'studio', heads: [[0.46, 0.22, 0.27, 0.23]], ink: ['#8d8174', '#161311'] };

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
window.FALLBACK_WORDS = ['gratitude', 'inspiration', 'journey', 'legacy', 'celebration', 'respect', 'blessings', 'milestones', 'memories', 'thanks'];

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

// Long-form demo letters (fictional) for the full list of messages, each with a connection category.
window.LETTER_GROUPS = [['family', 'Family'], ['colleagues', 'Colleagues'], ['shopfloor', 'Shop floor'], ['partners', 'Partners'], ['students', 'Students'], ['friends', 'Friends']];
// perceived scale for the prototype only: how the 2,418 voices would split across connections
window.LETTER_COUNTS = { family: 312, colleagues: 1204, shopfloor: 486, partners: 233, students: 141, friends: 42 };
window.LETTERS = [
  { name: 'Ramesh Kumar', rel: 'Plant associate, Gurugram', cat: 'shopfloor', paras: [
    'Dear Sir, I joined the Gurugram plant in 1996 as a helper on the assembly line. I had come from my village with one bag and a lot of fear. In my second month you walked down our line during an inspection, stopped at my station and asked my name and where I was from.',
    'A year later you came again. You remembered my name and asked if my mother had recovered from her illness. I do not know how you remembered. That day I understood that leadership is not about the big office. It is about seeing every person, even the newest one on the floor.',
    'Today I lead a team of forty people. I try to remember every name, every family, every worry. Whatever dignity I give them, I learned from you. Happy birthday, Sir. Thank you for everything.' ] },
  { name: 'Ritika Sharma', rel: 'Colleague, Hero MotoCorp', cat: 'colleagues', paras: [
    'Dear Mr. Munjal, when I presented my first strategy paper to the leadership team, my hands were shaking. Halfway through, the projector failed. You smiled, put your pen down and said, “Tell us without the slides. That is usually the better version.”',
    'It was. And it was the beginning of a lesson you taught me again and again over twelve years: that the idea matters more than the polish, and that people do their best work when someone believes in them first. You always believed in us and pushed us to do better.',
    'Your guidance shaped my whole career and, honestly, the kind of person I try to be at work. Wishing you a joyful birthday and many more years of good health.' ] },
  { name: 'A. M.', rel: 'Family', cat: 'family', paras: [
    'Papa, I have tried to write this letter for a week, and every version became too long, because how do you fit a whole life of warmth into a page?',
    'I remember Sunday mornings when you put the newspaper down the moment any of us walked in. I remember you teaching me to drive in the factory compound, laughing every time I stalled. I remember that you never once made us feel that your work was more important than us, even when the whole country seemed to need you.',
    'Your warmth and laughter are the heart of our family. Everything good in us, we learned at your dining table. Thank you for every memory, and for the ones still to come. Happy birthday. With all our love.' ] },
  { name: 'Hiroshi Tanaka', rel: 'Global partner, Japan', cat: 'partners', paras: [
    'Dear Pawan-san, we first met across a negotiating table in 1987, two companies from two very different cultures, each a little unsure of the other. What I remember most is not the agreement we signed but the dinner afterwards, when you asked about my children by name.',
    'Over the years our relationship grew from partnership into friendship. You showed me that trust is built slowly and kept carefully, and that respect can cross any border. You built bridges between cultures and markets with grace and openness.',
    'India is proud of you, and so are your friends in Japan. I wish you a very happy birthday and continued strength for the road ahead.' ] },
  { name: 'Kavya Iyer', rel: 'Former trainee', cat: 'students', paras: [
    'Dear Sir, I was one of forty trainees in the 2009 batch. On our last day you spoke to us for twenty minutes without notes, about patience, about failure, about the difference between ambition and greed.',
    'The humility with which you carry such stature is the greatest lesson I have learned. You stayed afterwards and answered every single question, even the silly ones, as if each of us were the most important person in the room.',
    'I now teach engineering students myself. Every year I tell them about that afternoon. Thank you for showing us that success and simplicity can live together. Happy birthday.' ] },
  { name: 'Sunita Rao', rel: 'NGO partner, Rajasthan', cat: 'partners', paras: [
    'Dear Mr. Munjal, eleven years ago our foundation ran three schools with leaking roofs and borrowed books. Today we run twenty-six, and nine hundred girls go to class each morning who might otherwise not have gone at all.',
    'What I admire most is that you never wanted your name on the buildings. You asked about attendance, about the teachers, about whether the girls were staying in school past grade eight. You cared about the impact, not the credit.',
    'Thank you for giving thousands of children access to education and hope. On your birthday, the children of Village Kherwara send their love, and a drawing of a motorcycle that I promised to describe to you as “very fast”.' ] },
  { name: 'Daniel Okafor', rel: 'Golf partner', cat: 'friends', paras: [
    'Pawan, after twenty years of Sunday rounds I still cannot beat you on the back nine, and I have stopped pretending it is my knees.',
    'Watching you on the golf course taught me that patience and precision win more than power ever will. You never rush a shot, never blame the wind, and you are the most gracious winner I know, which is more annoying than if you were not.',
    'Happy birthday, my friend. Here is to many more rounds, and to the day I finally win one. I am counting on you to let me.' ] },
  { name: 'Neha Gupta', rel: 'Mentee', cat: 'students', paras: [
    'Dear Sir, when I was twenty-four and sure I knew everything, you asked me one question in a review meeting that I could not answer. Instead of embarrassing me, you said, “Find out, and come and teach me.”',
    'I did, and that became the pattern of our mentorship for six years. You taught me that leadership is service, and that compassion is a strength, not a weakness to be hidden in the boardroom.',
    'You believed in me before I believed in myself. I will spend my career trying to do the same for others. Happy birthday.' ] },
  { name: 'Vikram Singh', rel: 'Dealer partner, 30 years', cat: 'partners', paras: [
    'Respected Munjal ji, my father opened our dealership in Ludhiana in 1989 with two motorcycles on display and a handshake agreement with your team. That handshake has lasted thirty-five years and two generations.',
    'In the difficult years, when sales fell and many of us were worried, you came to the dealer meet yourself and said that we would get through it together. We did. Your resilience gave all of us the confidence to keep going.',
    'From the first factory to the world stage, what a journey it has been. My father sends his blessings, and so does our whole family. Happy birthday.' ] },
  { name: 'Meera Kapoor', rel: 'Board member', cat: 'colleagues', paras: [
    'Dear Pawan, in fifteen years of board meetings I have rarely heard you raise your voice, and never heard you speak first. You listen more than you speak, and when you speak it is always with wisdom.',
    'I have seen you take the harder decision because it was the right one, and then carry its weight quietly so that others would not have to. Your integrity and conviction set the standards for an entire industry.',
    'It has been a privilege to sit at the same table. Wishing you a very happy birthday and good health.' ] },
  { name: 'Lakshmi Devi', rel: 'Community partner', cat: 'partners', paras: [
    'Dear Sir, I run a women’s self-help group in our block. When the skill centre opened, forty women from six villages signed up for tailoring and two-wheeler repair. My neighbours laughed at the second one. Now they bring their scooters to us.',
    'You empower women and villages through opportunity, not charity. That is real impact. Our group now earns enough to send every member’s daughter to school.',
    'We do not know how to write big letters, so I will say it simply: thank you, and happy birthday from all of us.' ] },
  { name: 'Anil Joshi', rel: 'Colleague since 1990', cat: 'colleagues', paras: [
    'Pawan, we were both young men with more hair and less patience when we started. I have watched you grow a company, a family and a reputation, and somehow remain exactly the same person.',
    'Decades of milestones, and you still dream bigger than all of us. Every time we thought we had arrived, you would ask, “What next?” It was exhausting and it was wonderful.',
    'Here is to the road ahead, old friend. Happy birthday.' ] },
  { name: 'Priya Nair', rel: 'Innovation team', cat: 'colleagues', paras: [
    'Dear Mr. Munjal, the first time I pitched an idea to you it was half-baked and I knew it. You did not say yes or no. You asked five questions, each better than the last, and by the end the idea was twice as good and still mine.',
    'Your curiosity is contagious. Every conversation with you opens a new possibility. Our whole team has learned to ask your five questions before we bring you anything, and our work is better for it.',
    'Happy birthday from all of us in the innovation lab.' ] },
  { name: 'Farah Siddiqui', rel: 'Family friend', cat: 'friends', paras: [
    'Dear Pawan bhai, when my father was in hospital in 2014, you were the first to call and the last to leave. You never spoke about it afterwards, and you would not want me to write about it now. I am writing anyway.',
    'Grateful for your generosity, your kindness and the gentle way you care for everyone, especially when no one is watching.',
    'Wishing you a birthday full of the same warmth you give to others.' ] },
  { name: 'Arjun Mehta', rel: 'Industry peer', cat: 'colleagues', paras: [
    'Dear Pawan, we have been competitors for most of our careers, and it has been an honour to lose to you so often.',
    'A true visionary. You saw the future of Indian mobility long before anyone else, and you had the courage to build it when it would have been easier to wait. The whole industry, my company included, followed the road you opened.',
    'With respect and warm wishes on your birthday.' ] }
];
