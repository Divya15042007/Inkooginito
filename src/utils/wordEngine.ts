export type Difficulty = 'easy' | 'medium' | 'hard';

const CATEGORY_SETS: Record<string, string[]> = {
  Animals: [
    'Elephant', 'Giraffe', 'Penguin', 'Chameleon', 'Octopus', 'Kangaroo', 'Flamingo', 'Hedgehog', 'Dolphin', 'Panda',
    'Koala', 'Platypus', 'Cheetah', 'Sloth', 'Hamster', 'Tiger', 'Lynx', 'Falcon', 'Otter', 'Bison',
    'Narwhal', 'Meerkat', 'Rabbit', 'Shark', 'Jellyfish', 'Puma', 'Badger', 'Wombat', 'Armadillo', 'Squirrel',
    'Raccoon', 'Gazelle', 'Polar Bear', 'Wolf', 'Hippo', 'Fennec Fox', 'Komodo Dragon', 'Dragonfly', 'Butterfly', 'Peacock',
    'Pharaoh Hound', 'Tardigrade', 'Antelope', 'Yeti Crab', 'Stingray', 'Seahorse', 'Lobster', 'Mantis', 'Velociraptor'
  ],
  Food: [
    'Pizza Slice', 'Sushi Roll', 'Taco', 'Ice Cream Cone', 'Hamburger', 'Croissant', 'Pancake Stack', 'Avocado', 'Watermelon', 'Cupcake',
    'Ramen Bowl', 'Donut', 'Hot Dog', 'Popcorn', 'Bubble Tea', 'Biryani', 'Burrito', 'Lasagna', 'Pasta', 'Samosa',
    'Falafel', 'Pav Bhaji', 'Mango', 'Banana', 'Strawberry', 'Tomato', 'Cucumber', 'Mochi', 'Brownie', 'Waffle',
    'Bagel', 'Spring Roll', 'Kebab', 'Paella', 'Curry', 'Pho', 'Naan', 'Cheeseburger', 'Milkshake', 'Coconut', 'Pudding', 'Tandoori Chicken'
  ],
  Objects: [
    'Submarine', 'Hot Air Balloon', 'Telescope', 'Guitar', 'Microscope', 'Hourglass', 'Skateboard', 'Compass', 'Boombox', 'Umbrella',
    'Lantern', 'Typewriter', 'Camera', 'Binoculars', 'Helicopter', 'Keyboard', 'Laptop', 'Smartphone', 'Robot', 'Drone',
    'VR Headset', 'Bluetooth Speaker', 'Backpack', 'Watch', 'Globe', 'Desk Lamp', 'Suitcase', 'Coffeemaker', 'Flashlight', 'Rocket',
    'Fountain Pen', 'Bicycle', 'Airplane', 'Sunglasses', 'Safe', 'Wheelchair', 'Toaster', 'Candle', 'Stapler', 'Headphones'
  ],
  Places: [
    'Eiffel Tower', 'Pyramids of Giza', 'Statue of Liberty', 'Volcano', 'Haunted House', 'Desert Island', 'Lighthouse', 'Space Station', 'Castle', 'Igloo',
    'Colosseum', 'Taj Mahal', 'Amusement Park', 'Airport', 'Waterfall', 'Mount Fuji', 'Grand Canyon', 'Canyon', 'Village', 'Harbor',
    'Oasis', 'Library', 'Museum', 'Railway Station', 'Café', 'Temple', 'Market', 'Skyscraper', 'Bridge', 'Forest', 'Beach', 'Desert', 'Underground Cave'
  ],
  Activities: [
    'Scuba Diving', 'Bungee Jumping', 'Baking Cookies', 'Playing Chess', 'Surfing', 'Astronaut Spacewalk', 'Painting a Canvas', 'Karaoke', 'Gardening', 'Yoga',
    'Archery', 'Rock Climbing', 'Fishing', 'Magic Trick', 'Ice Skating', 'Snowboarding', 'Camping', 'Pottery', 'Hiking', 'Chess Tournament',
    'Kayaking', 'Skiing', 'Rooftop Picnic', 'Reading', 'Running', 'Zumba', 'Travelling', 'Skydiving', 'Paragliding', 'Singing', 'Gardening'
  ],
  Cinema: [
    'Darth Vader', 'Lightsaber', 'Popcorn Bucket', 'Film Reel', 'Oscar Trophy', 'Superhero Cape', 'DeLorean Car', 'Wizard Wand', 'Alien UFO', 'Treasure Chest',
    'Spider-Man', 'Batman', 'Wonder Woman', 'Iron Man', 'Kung Fu Master', 'Time Machine', 'Zombie Apocalypse', 'Moon Landing', 'Kung Fu Panda', 'The Matrix',
    'Inception', 'Interstellar', 'Jurassic Park', 'Titanic', 'Frozen Castle', 'Secret Agent', 'Cinema Screen', 'Robot Rebellion', 'Film Camera', 'Movie Theater'
  ],
  'People & Professions': [
    'Doctor', 'Pilot', 'Chef', 'Police Officer', 'Astronaut', 'Photographer', 'Engineer', 'Teacher', 'Farmer', 'Nurse',
    'Scientist', 'Architect', 'Mechanic', 'Journalist', 'Builder', 'Bartender', 'Dentist', 'Singer', 'Artist', 'Lawyer',
    'Firefighter', 'Librarian', 'Designer', 'Programmer', 'Detective', 'Soldier', 'Surgeon', 'Dancer', 'Athlete', 'Tailor', 'Welder'
  ],
  Technology: [
    'Laptop', 'Smartphone', 'Robot', 'AI', 'Drone', 'Keyboard', 'VR Headset', 'Laptop', 'Server Rack', 'Microchip',
    'Smartwatch', 'Printer', 'Projector', 'Router', '3D Printer', 'tablet', 'Game Console', 'Microphone', 'Camera Lens', 'Satellite',
    'Wireless Charger', 'Screen', 'USB Cable', 'Mouse', 'Headphones', 'Joystick', 'Virtual Assistant', 'Smart Home', 'Power Bank'
  ],
  Sports: [
    'Cricket', 'Football', 'Basketball', 'Tennis', 'Swimming', 'F1', 'Cycling', 'Badminton', 'Golf', 'Boxing',
    'Table Tennis', 'Rugby', 'Hockey', 'Volleyball', 'Marathon', 'Ski Jump', 'Wrestling', 'Surfing', 'Gymnastics', 'Snooker',
    'Judo', 'Archery', 'Weightlifting', 'Sprint', 'Karate', 'Skateboarding', 'Formula One', 'Tug of War'
  ],
  Entertainment: [
    'Movie Night', 'TV Series', 'Anime', 'Game Console', 'Superhero', 'Fantasy Book', 'Board Game', 'Concert', 'Podcast', 'Streaming Service',
    'Live Show', 'Theater', 'Drama', 'Comedy Show', 'Music Festival', 'Cinema Hall', 'Cartoon', 'Comic Book', 'Reality Show', 'PlayStation',
    'Arcade', 'Video Game', 'Character Design', 'Storytelling', 'Dance Battle', 'YouTube Creator'
  ],
  Space: [
    'Saturn Ring', 'Black Hole', 'Shooting Star', 'Lunar Rover', 'Satellite Dish', 'Solar Eclipse', 'Astronaut Helmet', 'Alien Planet', 'Space Rocket', 'Constellation',
    'Moon Base', 'Nebula', 'Meteor Shower', 'Comet', 'Mars Rover', 'Asteroid', 'Galaxy', 'Solar System', 'Launch Pad', 'Orbit',
    'Planetarium', 'Cosmic Dust', 'Space Suit', 'Starlight', 'Sputnik', 'Pluto', 'Alien Life', 'Deep Space'
  ],
  Mythology: [
    'Fire Dragon', 'Pegasus', 'Phoenix Bird', 'Cyclops', 'Mermaid', 'Centaur', 'Golden Griffin', 'Medusa Head', 'Thunderbolt', 'Unicorn Horn',
    'Titan', 'Sphinx', 'Werewolf', 'Kraken', 'Sea Serpent', 'Valkyrie', 'Odin', 'Hades', 'Zeus', 'Ares', 'Poseidon', 'Hercules', 'Goblin', 'Elf', 'Dragon'
  ],
  Music: [
    'Grand Piano', 'Drum Set', 'Violin', 'Saxophone', 'Headphones', 'Microphone', 'Turntable Vinyl', 'Electric Bass', 'Trumpet', 'Harmonica',
    'Synthesizer', 'Acoustic Guitar', 'Keyboard', 'Choir', 'Orchestra', 'DJ Deck', 'Banjo', 'Ukulele', 'Trombone', 'Flute', 'Cymbals', 'Tambourine', 'Cello'
  ],
  Vehicles: [
    'Car', 'Motorcycle', 'Train', 'Bus', 'Airplane', 'Bicycle', 'Submarine', 'Helicopter', 'Rocket', 'Boat', 'Truck', 'Taxi', 'Ambulance', 'Scooter', 'Segway', 'Van',
    'Tanker', 'Helicopter', 'Tram', 'Skateboard', 'Snowmobile', 'Hoverboard', 'Vespa', 'Jet Ski'
  ],
  Nature: [
    'River', 'Mountain', 'Forest', 'Waterfall', 'Sunflower', 'Desert', 'Rainforest', 'Canyon', 'Cloud', 'Meadow', 'Aurora', 'Thunderstorm', 'Aurora Borealis', 'Coral Reef',
    'Glacier', 'Volcano', 'Lakeside', 'Dandelion', 'Ocean', 'Beach', 'Raincloud', 'Sunset', 'Rainbow', 'Leaf', 'Snowfield'
  ]
};

const DEFAULT_DIFFICULTY_ORDER: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };
const PROFANITY = ['damn', 'hell', 'crap', 'shit', 'fuck'];

export function buildWordDatabase(): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(CATEGORY_SETS).map(([category, words]) => [category, [...new Set(words.map(normalizeWord).filter(Boolean))]])
  );
}

export function normalizeWord(word: string): string {
  return String(word || '').trim().replace(/\s+/g, ' ');
}

export function pickRandomWord(category: string, difficulty: Difficulty = 'medium', exclude: string[] = []): string {
  const db = buildWordDatabase();
  const list = (db[category] || db.Animals || []).filter((word) => !exclude.includes(word));
  const difficultyWeighted = list.length ? list : buildWordDatabase().Animals;

  const filtered = difficultyWeighted.filter((word) => {
    const score = word.length;
    if (difficulty === 'easy') return score <= 10;
    if (difficulty === 'medium') return score >= 6 && score <= 15;
    if (difficulty === 'hard') return score >= 8 && score <= 20;
    return true;
  });

  const candidates = filtered.length ? filtered : difficultyWeighted;
  if (!candidates.length) return 'Elephant';

  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function chooseFakeArtistCount(playerCount: number): number[] {
  if (playerCount <= 2) return [1];
  if (playerCount <= 6) return [1];
  if (playerCount <= 8) return [2];
  return [2, 3];
}

export function resolveTieVotes(votes: Record<string, string>, playerIds: string[]): string {
  const tally: Record<string, number> = {};
  for (const votedId of Object.values(votes)) {
    tally[votedId] = (tally[votedId] || 0) + 1;
  }

  const maxVotes = Math.max(0, ...Object.values(tally));
  const leaders = Object.entries(tally)
    .filter(([, count]) => count === maxVotes)
    .map(([playerId]) => playerId);

  if (leaders.length === 1) return leaders[0];

  const sortedPlayers = [...new Set(playerIds)].sort((a, b) => a.localeCompare(b));
  return sortedPlayers.filter((playerId) => leaders.includes(playerId)).at(-1) || leaders[0];
}

export function validateGeneratedWords(words: unknown, category: string, difficulty: Difficulty = 'medium'): string[] {
  const allowedCategory = normalizeWord(category || 'Animals');
  const sourceWords = Array.isArray(words) ? words : [];
  const unique = new Set<string>();

  for (const raw of sourceWords) {
    const word = normalizeWord(String(raw));
    if (!word || word.length < 2 || word.length > 30) continue;
    if (word.toLowerCase().includes('sex') || PROFANITY.some((term) => word.toLowerCase().includes(term))) continue;
    const normalized = word.toLowerCase();
    if (normalized.includes('nude') || normalized.includes('adult')) continue;
    if (!unique.has(word)) unique.add(word);
  }

  const allWords = [...unique].sort((a, b) => a.localeCompare(b));
  const filtered = allWords.filter((word) => {
    const score = word.length;
    if (difficulty === 'easy') return score <= 12;
    if (difficulty === 'medium') return score <= 18;
    if (difficulty === 'hard') return score <= 24;
    return true;
  });

  if (!filtered.length) {
    const fallback = buildWordDatabase()[allowedCategory] || buildWordDatabase().Animals;
    return fallback.slice(0, 10);
  }

  return filtered.slice(0, 10);
}

export function getWordOptionsForDifficulty(category: string, difficulty: Difficulty = 'medium'): string[] {
  const pool = buildWordDatabase()[category] || buildWordDatabase().Animals;

  return [...pool].sort((a, b) => {
    const left = DEFAULT_DIFFICULTY_ORDER[difficulty] * 0.1 + (a.length / 100);
    const right = DEFAULT_DIFFICULTY_ORDER[difficulty] * 0.1 + (b.length / 100);
    return left - right;
  });
}

export function buildShareLink(baseOrigin: string, roomId: string, roomMode: 'whiteboard' | 'game' = 'game'): string {
  const origin = (baseOrigin || '').replace(/\/$/, '');
  return `${origin}?room=${encodeURIComponent(roomId)}&mode=${encodeURIComponent(roomMode)}`;
}
