/**
 * Collection de citations inspirantes sur l'écriture
 * Affichées aléatoirement au démarrage de l'application
 */

export interface WritingQuote {
  text: string
  author: string
  source?: string
}

export const WRITING_QUOTES: WritingQuote[] = [
  // Citations inspirantes et motivantes
  {
    text: "Écrire, c'est dessiner une porte sur un mur infranchissable, et puis l'ouvrir.",
    author: "Christian Bobin"
  },
  {
    text: "L'écriture est la plus noble conquête de l'homme.",
    author: "Elsa Triolet"
  },
  {
    text: "L'écriture a cette vertu de nous faire exister quand nous n'existons plus pour personne. De là sa magie, sa divine hérédité.",
    author: "Georges Perros"
  },
  {
    text: "L'écriture, c'est à la fois une respiration, une nécessité, un vrai bonheur.",
    author: "Philippe Claudel"
  },
  {
    text: "L'écriture est un exercice spirituel ; elle aide à devenir libre.",
    author: "Jean Rouaud"
  },
  {
    text: "L'écriture a ceci de mystérieux qu'elle parle.",
    author: "Paul Claudel"
  },
  {
    text: "Écrire, c'est brûler vif, mais aussi renaître de ses cendres.",
    author: "Blaise Cendrars",
    source: "L'Homme foudroyé"
  },
  {
    text: "Je ne trempe pas ma plume dans un encrier mais dans la vie.",
    author: "Blaise Cendrars",
    source: "L'Homme foudroyé"
  },
  {
    text: "Il est beau d'écrire parce que cela réunit les deux joies : parler seul et parler à une foule.",
    author: "Cesare Pavese",
    source: "Le Métier de vivre"
  },
  {
    text: "L'écrivain original n'est pas celui qui n'imite personne, mais celui que personne ne peut imiter.",
    author: "François-René de Chateaubriand",
    source: "Génie du christianisme"
  },
  {
    text: "Entre moi et le monde, une vitre. Écrire est une façon de la traverser sans la briser.",
    author: "Christian Bobin"
  },
  {
    text: "Les choses les plus belles sont celles que souffle la folie et qu'écrit la raison.",
    author: "André Gide"
  },
  {
    text: "Partir, c'est mourir un peu. Écrire, c'est vivre davantage.",
    author: "André Comte-Sponville"
  },
  {
    text: "Écrivez ! Noircir le papier est idéal pour s'éclaircir l'esprit.",
    author: "Aldous Huxley"
  },
  {
    text: "Ceux qui écrivent clairement ont des lecteurs ; ceux qui écrivent obscurément ont des commentateurs.",
    author: "Albert Camus"
  },
  {
    text: "Le récit n'est plus l'écriture d'une aventure, mais l'aventure d'une écriture.",
    author: "Jean Ricardou"
  },
  {
    text: "La mémoire se perd ; mais l'écriture demeure.",
    author: "Proverbe oriental"
  },
  {
    text: "Chaque ligne d'écriture est un fil tendu entre la vie et la mort.",
    author: "Jean-Marie Laclavetine"
  },
  {
    text: "L'accent circonflexe est l'hirondelle de l'écriture.",
    author: "Jules Renard"
  },
  {
    text: "L'expérience de l'écriture est extatique : il faut s'y jeter à corps perdu.",
    author: "Pierre Michon"
  },
  {
    text: "Écrire est un apaisement de soi-même.",
    author: "Jules Barbey d'Aurevilly"
  },
  {
    text: "L'écriture est la peinture de la voix.",
    author: "Voltaire"
  },
  {
    text: "Écrire, c'est une façon de parler sans être interrompu.",
    author: "Jules Renard"
  },
  {
    text: "Le poète est celui qui inspire bien plus que celui qui est inspiré.",
    author: "Paul Éluard"
  },
  {
    text: "Un livre doit être la hache qui brise la mer gelée en nous.",
    author: "Franz Kafka"
  },
  {
    text: "Le moment le plus effrayant est toujours juste avant de commencer.",
    author: "Stephen King"
  },
  {
    text: "L'écriture, comme la parole, est à tout le monde. Prenez-la.",
    author: "Martin Winckler"
  },
  {
    text: "Caressez longuement votre phrase, et elle finira par sourire.",
    author: "Anatole France"
  },
  {
    text: "L'écriture me donne le sentiment d'ajouter des jours à ma vie.",
    author: "J.M.G. Le Clézio"
  },
  {
    text: "Écrire tous les jours, génie ou pas.",
    author: "Stendhal"
  },
  {
    text: "J'écris parce que je ne sais pas parler.",
    author: "Annie Ernaux"
  },
  {
    text: "Écrire, c'est respirer sous l'eau.",
    author: "Jean-Marie Gustave Le Clézio"
  },
  {
    text: "J'écris pour savoir ce que je pense.",
    author: "Joan Didion"
  },
  {
    text: "Écrire, c'est hurler sans bruit.",
    author: "Marguerite Yourcenar"
  },
  {
    text: "J'écris parce que je suis né trop fragile pour me taire.",
    author: "Christiane Singer"
  },
  {
    text: "Écrire, c'est voler du temps à la mort.",
    author: "Romain Gary"
  },
  {
    text: "J'écris pour habiter le monde autrement.",
    author: "Hélène Cixous"
  },
  {
    text: "Ce que j'aime, dans l'écriture, c'est plutôt la rêverie qui la précède.",
    author: "Patrick Modiano"
  },
  {
    text: "Tout le talent d'écrire ne consiste après tout que dans le choix des mots.",
    author: "Gustave Flaubert"
  },
  {
    text: "Il faut avec les mots de tout le monde écrire comme personne.",
    author: "Colette"
  },
  {
    text: "Le secret, c'est d'écrire n'importe quoi, parce que lorsqu'on écrit n'importe quoi, on commence à dire les choses les plus importantes.",
    author: "Julien Green"
  },
  {
    text: "Les mots qui vont surgir savent de nous des choses que nous ignorons d'eux.",
    author: "René Char"
  },
  {
    text: "Écrire est un acte d'amour. S'il ne l'est pas il n'est qu'écriture.",
    author: "Jean Cocteau"
  },
  {
    text: "On pense à partir de ce qu'on écrit et pas le contraire.",
    author: "Louis Aragon"
  },
  {
    text: "L'art de l'écrivain consiste surtout à nous faire oublier qu'il emploie des mots.",
    author: "Henri Bergson"
  },
  {
    text: "Ce qu'on ne peut pas dire, il ne faut surtout pas le taire, mais l'écrire.",
    author: "Jacques Derrida"
  },
  {
    text: "L'art de l'écriture est l'art de découvrir ce que tu crois.",
    author: "Gustave Flaubert"
  },
  {
    text: "N'écrire que des phrases telles qu'il faille lever la tête après les avoir lues.",
    author: "Emil Cioran"
  },
  {
    text: "L'écrivain apparaît inspiré quand les mots attendus sont ceux qu'il n'attend pas.",
    author: "Pierre Perrin"
  },
  {
    text: "Seule la prière approche de cette concision et de cette pureté qui fondent la vérité de l'écriture.",
    author: "Elie Wiesel"
  },
  {
    text: "L'écriture, toute écriture, reste une audace et un courage.",
    author: "Michèle Mailhot"
  },
  {
    text: "La lecture apporte à l'homme plénitude, le discours assurance et l'écriture exactitude.",
    author: "Francis Bacon"
  },
  {
    text: "L'écriture n'est pas une fin en soi ; elle est la nostalgie d'un ravissement.",
    author: "Yasmina Reza"
  },
  {
    text: "Se trouver dans un trou, au fond d'un trou, dans une solitude quasi totale et découvrir que seule l'écriture vous sauvera.",
    author: "Marguerite Duras"
  },
  {
    text: "À force d'écrire, je suis devenu écrivain.",
    author: "Georges Perec"
  },
  {
    text: "C'est tout de même agréable d'écrire.",
    author: "Raymond Queneau"
  },
  {
    text: "Il faut écrire, que l'on soit de bonne ou mauvaise humeur.",
    author: "Salman Rushdie"
  },
  {
    text: "Le métier d'écrivain, c'est d'apprendre à écrire.",
    author: "Jules Renard"
  },
  {
    text: "Je n'ai vécu que pour écrire.",
    author: "Paul Léautaud"
  },
  {
    text: "L'unique but de ma vie, c'était d'écrire.",
    author: "Jean-Paul Sartre"
  },
  {
    text: "Je ne peux m'empêcher d'écrire.",
    author: "Virginia Woolf"
  },
  {
    text: "Même quand je n'ai pas l'air d'écrire, je ne fais que me préparer à le faire.",
    author: "Louis Aragon"
  },
  {
    text: "Écrire, c'est dévoiler le monde et le proposer comme une tâche à la générosité du lecteur.",
    author: "Jean-Paul Sartre"
  },
  {
    text: "L'acte d'écrire peut ouvrir tant de portes, comme si un stylo n'était pas vraiment une plume, mais une étrange variété de passe-partout.",
    author: "Stephen King"
  },
  {
    text: "La lecture est l'apothéose de l'écriture.",
    author: "Alberto Manguel"
  },
  {
    text: "L'écriture est une pulsion incontrôlable qui donne un sens à ma vie.",
    author: "Will Self"
  },
  {
    text: "Voilà ce qu'est l'écriture : un effort pour transcender l'individualité et la misère humaine.",
    author: "Rosa Montero"
  },
  {
    text: "L'écriture, c'est comme la vie : on ne peut pas revenir en arrière.",
    author: "Jacques Poulin"
  },
  {
    text: "J'écris tous les jours depuis l'âge de treize ans. J'avais déjà l'intuition que le bonheur viendrait de l'écriture.",
    author: "Erik Orsenna"
  },
  {
    text: "Bien écrire, c'est tout à la fois bien penser, bien sentir et bien rendre.",
    author: "Antoine Albalat"
  },
  {
    text: "Le premier jet de n'importe quoi est merdique.",
    author: "Ernest Hemingway"
  },
  {
    text: "Si vous voulez devenir écrivain, il y a deux choses que vous devez faire : lisez beaucoup et écrivez beaucoup.",
    author: "Stephen King"
  }
]

/**
 * Retourne une citation aléatoire
 */
export function getRandomQuote(): WritingQuote {
  const index = Math.floor(Math.random() * WRITING_QUOTES.length)
  return WRITING_QUOTES[index]
}

/**
 * Retourne une citation différente de la précédente
 */
export function getRandomQuoteExcluding(previousQuote: WritingQuote | null): WritingQuote {
  if (!previousQuote || WRITING_QUOTES.length <= 1) {
    return getRandomQuote()
  }

  let quote: WritingQuote
  do {
    quote = getRandomQuote()
  } while (quote.text === previousQuote.text)

  return quote
}
