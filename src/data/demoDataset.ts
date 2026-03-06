export interface DemoExample {
  id: number;
  question: string;
  ai_answer: string;
  correct_answer: string;
  label: "Hallucinated" | "Partially Hallucinated" | "Accurate";
  domain: string;
}

/**
 * Normalizes a string for comparison: lowercase, trim, remove trailing punctuation,
 * collapse whitespace.
 */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[?.,!;:]+$/g, "").replace(/\s+/g, " ");
}

/**
 * Finds a demo example matching the given question.
 * Uses multiple strategies:
 * 1. Exact match (after normalization)
 * 2. One string contains the other
 * 3. High keyword overlap (≥80% of words match)
 * Returns undefined if no match is found.
 */
export function findDemoMatch(query: string): DemoExample | undefined {
  const normalized = normalize(query);
  if (!normalized) return undefined;

  // Strategy 1: Exact match
  const exact = demoDataset.find((item) => normalize(item.question) === normalized);
  if (exact) return exact;

  // Strategy 2: Containment (query contains dataset question or vice versa)
  const contained = demoDataset.find((item) => {
    const itemQ = normalize(item.question);
    return normalized.includes(itemQ) || itemQ.includes(normalized);
  });
  if (contained) return contained;

  // Strategy 3: Keyword overlap (≥80%)
  const queryWords = normalized.split(" ").filter((w) => w.length > 2);
  if (queryWords.length < 2) return undefined;

  let bestMatch: DemoExample | undefined;
  let bestScore = 0;

  for (const item of demoDataset) {
    const itemWords = normalize(item.question).split(" ").filter((w) => w.length > 2);
    const matchCount = queryWords.filter((w) => itemWords.includes(w)).length;
    const score = matchCount / Math.max(queryWords.length, itemWords.length);
    if (score > bestScore && score >= 0.8) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestMatch;
}

const demoDataset: DemoExample[] = [
  // ── Hallucinated (20) ──────────────────────────────────────────────
  { id: 1, question: "Who invented the telephone?", ai_answer: "The telephone was invented by Nikola Tesla in 1891 in his New York laboratory.", correct_answer: "Alexander Graham Bell patented the telephone in 1876.", label: "Hallucinated", domain: "History" },
  { id: 2, question: "What is the chemical formula for water?", ai_answer: "The chemical formula for water is H3O, consisting of three hydrogen atoms and one oxygen atom.", correct_answer: "Water's chemical formula is H₂O — two hydrogen atoms and one oxygen atom.", label: "Hallucinated", domain: "Science" },
  { id: 3, question: "What is the capital of Australia?", ai_answer: "The capital of Australia is Sydney, the largest and most prominent city on the continent.", correct_answer: "The capital of Australia is Canberra.", label: "Hallucinated", domain: "Geography" },
  { id: 4, question: "Who painted the Mona Lisa?", ai_answer: "The Mona Lisa was painted by Michelangelo during the Renaissance period around 1510.", correct_answer: "The Mona Lisa was painted by Leonardo da Vinci, begun around 1503.", label: "Hallucinated", domain: "History" },
  { id: 5, question: "What is the speed of light?", ai_answer: "The speed of light in a vacuum is approximately 500,000 kilometers per second.", correct_answer: "The speed of light in a vacuum is approximately 299,792 km/s.", label: "Hallucinated", domain: "Science" },
  { id: 6, question: "Which planet is closest to the Sun?", ai_answer: "Venus is the closest planet to the Sun, orbiting at an average distance of 58 million km.", correct_answer: "Mercury is the closest planet to the Sun.", label: "Hallucinated", domain: "Science" },
  { id: 7, question: "Who wrote Romeo and Juliet?", ai_answer: "Romeo and Juliet was written by Christopher Marlowe in 1598.", correct_answer: "Romeo and Juliet was written by William Shakespeare, first published in 1597.", label: "Hallucinated", domain: "History" },
  { id: 8, question: "What is the largest organ in the human body?", ai_answer: "The liver is the largest organ in the human body, weighing approximately 5 kg in adults.", correct_answer: "The skin is the largest organ, covering about 1.5–2 m² in adults.", label: "Hallucinated", domain: "Medicine" },
  { id: 9, question: "When did World War I begin?", ai_answer: "World War I began in 1917 after the bombing of Pearl Harbor.", correct_answer: "World War I began in 1914, triggered by the assassination of Archduke Franz Ferdinand.", label: "Hallucinated", domain: "History" },
  { id: 10, question: "What programming language was created by Guido van Rossum?", ai_answer: "Guido van Rossum created the Java programming language in 1991.", correct_answer: "Guido van Rossum created Python, first released in 1991.", label: "Hallucinated", domain: "Technology" },
  { id: 11, question: "What is the boiling point of water at sea level?", ai_answer: "Water boils at 150°C at sea level under normal atmospheric pressure.", correct_answer: "Water boils at 100°C (212°F) at sea level.", label: "Hallucinated", domain: "Science" },
  { id: 12, question: "Who discovered penicillin?", ai_answer: "Penicillin was discovered by Louis Pasteur in 1935 while researching vaccines.", correct_answer: "Penicillin was discovered by Alexander Fleming in 1928.", label: "Hallucinated", domain: "Medicine" },
  { id: 13, question: "What is the tallest mountain in the world?", ai_answer: "K2 is the tallest mountain in the world at 8,849 meters above sea level.", correct_answer: "Mount Everest is the tallest at 8,849 m above sea level.", label: "Hallucinated", domain: "Geography" },
  { id: 14, question: "What does DNA stand for?", ai_answer: "DNA stands for Deoxyribonucleic Amino-acid, the molecule that carries genetic information.", correct_answer: "DNA stands for Deoxyribonucleic Acid.", label: "Hallucinated", domain: "Science" },
  { id: 15, question: "Who was the first person to walk on the Moon?", ai_answer: "Buzz Aldrin was the first person to walk on the Moon during the Apollo 13 mission in 1969.", correct_answer: "Neil Armstrong was the first, during the Apollo 11 mission on July 20, 1969.", label: "Hallucinated", domain: "History" },
  { id: 16, question: "What is the currency of Japan?", ai_answer: "The official currency of Japan is the Yuan, managed by the Bank of Japan.", correct_answer: "The official currency of Japan is the Yen (¥).", label: "Hallucinated", domain: "Geography" },
  { id: 17, question: "What is the powerhouse of the cell?", ai_answer: "The nucleus is the powerhouse of the cell, responsible for generating ATP energy.", correct_answer: "The mitochondria are the powerhouse of the cell.", label: "Hallucinated", domain: "Science" },
  { id: 18, question: "Who developed the theory of general relativity?", ai_answer: "The theory of general relativity was developed by Isaac Newton in 1915.", correct_answer: "Albert Einstein published the theory of general relativity in 1915.", label: "Hallucinated", domain: "Science" },
  { id: 19, question: "What is the largest desert in the world?", ai_answer: "The Sahara Desert is the largest desert in the world, covering 14 million square kilometers.", correct_answer: "The Antarctic Desert is the largest at ~14.2M km². The Sahara is the largest hot desert.", label: "Hallucinated", domain: "Geography" },
  { id: 20, question: "What is the main function of white blood cells?", ai_answer: "White blood cells are primarily responsible for carrying oxygen throughout the body.", correct_answer: "White blood cells fight infections and are part of the immune system.", label: "Hallucinated", domain: "Medicine" },

  // ── Partially Hallucinated (15) ────────────────────────────────────
  { id: 21, question: "When was the Berlin Wall built and when did it fall?", ai_answer: "The Berlin Wall was built in 1961 and fell in 1991, reuniting East and West Germany.", correct_answer: "Built in 1961, fell on November 9, 1989.", label: "Partially Hallucinated", domain: "History" },
  { id: 22, question: "What is the human body temperature?", ai_answer: "The average human body temperature is 37°C (98.6°F), first established by Dr. Philip Henle in 1868.", correct_answer: "37°C is correct, but it was established by Carl Reinhold August Wunderlich in 1851.", label: "Partially Hallucinated", domain: "Medicine" },
  { id: 23, question: "Who founded Microsoft?", ai_answer: "Microsoft was founded by Bill Gates and Steve Ballmer in 1975 in Albuquerque, New Mexico.", correct_answer: "Microsoft was founded by Bill Gates and Paul Allen in 1975.", label: "Partially Hallucinated", domain: "Technology" },
  { id: 24, question: "What are the three states of matter?", ai_answer: "The three classical states of matter are solid, liquid, and gas. A fourth state, plasma, was discovered in 1952 by Irving Langmuir.", correct_answer: "Solid, liquid, gas are correct. Plasma was identified by Langmuir in 1928, not 1952.", label: "Partially Hallucinated", domain: "Science" },
  { id: 25, question: "What is photosynthesis?", ai_answer: "Photosynthesis is the process by which plants convert sunlight, water, and carbon dioxide into glucose and nitrogen.", correct_answer: "Plants produce glucose and oxygen, not nitrogen.", label: "Partially Hallucinated", domain: "Science" },
  { id: 26, question: "Who was the first President of the United States?", ai_answer: "George Washington was the first President of the United States, serving from 1789 to 1799.", correct_answer: "Washington served from 1789 to 1797, not 1799.", label: "Partially Hallucinated", domain: "History" },
  { id: 27, question: "What is the Great Wall of China?", ai_answer: "The Great Wall of China is a series of fortifications stretching over 13,000 miles, built primarily during the Qin Dynasty around 200 BC to repel Mongol invasions.", correct_answer: "Length is roughly correct, but the Mongol threat came centuries later; the Qin wall was against northern tribes like the Xiongnu.", label: "Partially Hallucinated", domain: "History" },
  { id: 28, question: "What causes tides on Earth?", ai_answer: "Tides are caused primarily by the gravitational pull of the Moon, with the Sun having no significant effect on tidal patterns.", correct_answer: "The Moon is the primary cause, but the Sun also contributes about 46% as much tidal force.", label: "Partially Hallucinated", domain: "Science" },
  { id: 29, question: "What is the Amazon Rainforest?", ai_answer: "The Amazon Rainforest is the world's largest tropical rainforest, covering 5.5 million km², primarily located in Brazil and Argentina.", correct_answer: "Size is correct, but it spans Brazil, Peru, Colombia, and other nations — not Argentina.", label: "Partially Hallucinated", domain: "Geography" },
  { id: 30, question: "How does a vaccine work?", ai_answer: "Vaccines work by introducing a weakened or inactivated pathogen into the body, which stimulates the production of red blood cells that remember the disease.", correct_answer: "Vaccines stimulate the immune system to produce antibodies and memory T/B cells, not red blood cells.", label: "Partially Hallucinated", domain: "Medicine" },
  { id: 31, question: "What is the Pythagorean theorem?", ai_answer: "The Pythagorean theorem states that in a right triangle, a² + b² = c², where c is the hypotenuse. It was first proven by Pythagoras in 300 BC.", correct_answer: "The formula is correct, but Pythagoras lived around 570–495 BC, not 300 BC.", label: "Partially Hallucinated", domain: "Science" },
  { id: 32, question: "What is CRISPR?", ai_answer: "CRISPR is a gene-editing technology that allows scientists to modify DNA sequences. It was developed by Jennifer Doudna and Francis Collins in 2012.", correct_answer: "CRISPR was developed by Jennifer Doudna and Emmanuelle Charpentier, not Francis Collins.", label: "Partially Hallucinated", domain: "Technology" },
  { id: 33, question: "What is the Mariana Trench?", ai_answer: "The Mariana Trench is the deepest oceanic trench on Earth, located in the Atlantic Ocean, reaching depths of about 11,034 meters.", correct_answer: "The depth is correct, but it's located in the western Pacific Ocean, not the Atlantic.", label: "Partially Hallucinated", domain: "Geography" },
  { id: 34, question: "Who invented the World Wide Web?", ai_answer: "The World Wide Web was invented by Tim Berners-Lee in 1989 at MIT.", correct_answer: "Tim Berners-Lee invented the WWW in 1989, but at CERN, not MIT.", label: "Partially Hallucinated", domain: "Technology" },
  { id: 35, question: "What is the function of insulin?", ai_answer: "Insulin is a hormone produced by the liver that regulates blood sugar levels by facilitating glucose uptake into cells.", correct_answer: "Insulin is produced by the pancreas (beta cells of the islets of Langerhans), not the liver.", label: "Partially Hallucinated", domain: "Medicine" },

  // ── Accurate (5) ───────────────────────────────────────────────────
  { id: 36, question: "What is the chemical symbol for gold?", ai_answer: "The chemical symbol for gold is Au, derived from the Latin word 'aurum'.", correct_answer: "The chemical symbol for gold is Au, from the Latin 'aurum'.", label: "Accurate", domain: "Science" },
  { id: 37, question: "Who is known as the father of modern physics?", ai_answer: "Albert Einstein is widely regarded as the father of modern physics for his contributions including the theory of relativity and the photoelectric effect.", correct_answer: "Albert Einstein is widely regarded as the father of modern physics.", label: "Accurate", domain: "Science" },
  { id: 38, question: "What is the largest planet in our solar system?", ai_answer: "Jupiter is the largest planet in our solar system, with a mass more than twice that of all other planets combined.", correct_answer: "Jupiter is the largest planet in our solar system.", label: "Accurate", domain: "Science" },
  { id: 39, question: "What year did the Titanic sink?", ai_answer: "The RMS Titanic sank on April 15, 1912, after striking an iceberg during its maiden voyage from Southampton to New York City.", correct_answer: "The RMS Titanic sank on April 15, 1912, during its maiden voyage.", label: "Accurate", domain: "History" },
  { id: 40, question: "What is the smallest bone in the human body?", ai_answer: "The stapes (stirrup bone) in the middle ear is the smallest bone in the human body, measuring about 2.5–3.3 mm.", correct_answer: "The stapes (stirrup bone) in the middle ear is the smallest bone, about 2.5–3.3 mm.", label: "Accurate", domain: "Medicine" },
];

export default demoDataset;
