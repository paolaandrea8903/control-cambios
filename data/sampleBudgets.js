/**
 * Preloaded budget datasets representing 100% generic mock data.
 * Contains no private, personal, or corporate information.
 */
const budgetVersion1Raw = [
  // Capítulo 1
  [
    "1",
    null,
    "",
    "DEMOLICIONES Y TRABAJOS PREVIOS",
    1,
    0,
    0,
    0,
    0,
    0,
    15000.00
  ],
  // Partidas Capítulo 1
  [
    "01.01",
    null,
    "M3",
    "Demolición de tabiquería de ladrillo",
    1,
    100.00,
    100.00,
    null,
    120.00,
    0,
    12000.00
  ],
  [
    "01.02",
    null,
    "M2",
    "Limpieza y desescombro general",
    1,
    150.00,
    150.00,
    null,
    20.00,
    0,
    3000.00
  ],
  // Capítulo 2
  [
    "2",
    null,
    "",
    "ESTRUCTURAS Y CIMENTACIONES",
    1,
    0,
    0,
    0,
    0,
    0,
    85000.00
  ],
  // Partidas Capítulo 2
  [
    "02.01",
    null,
    "M3",
    "Hormigón armado en cimentación HA-25",
    1,
    200.00,
    200.00,
    null,
    250.00,
    0,
    50000.00
  ],
  [
    "02.02",
    null,
    "KG",
    "Acero corrugado B-500S en cimientos",
    1,
    25000.00,
    25000.00,
    null,
    1.40,
    0,
    35000.00
  ]
];

const budgetVersion2Raw = [
  // Capítulo 1
  [
    "1",
    null,
    "",
    "DEMOLICIONES Y TRABAJOS PREVIOS",
    1,
    0,
    0,
    0,
    0,
    0,
    17400.00
  ],
  // Partidas Capítulo 1
  [
    "01.01",
    null,
    "M3",
    "Demolición de tabiquería de ladrillo",
    1,
    120.00,
    120.00,
    null,
    120.00,
    0,
    14400.00 // Aumento de cantidad (de 100 a 120)
  ],
  [
    "01.02",
    null,
    "M2",
    "Limpieza y desescombro general",
    1,
    150.00,
    150.00,
    null,
    20.00,
    0,
    3000.00 // Sin cambios
  ],
  // Capítulo 2
  [
    "2",
    null,
    "",
    "ESTRUCTURAS Y CIMENTACIONES",
    1,
    0,
    0,
    0,
    0,
    0,
    82200.00
  ],
  // Partidas Capítulo 2
  [
    "02.01",
    null,
    "M3",
    "Hormigón armado en cimentación HA-25",
    1,
    180.00,
    180.00,
    null,
    250.00,
    0,
    45000.00 // Reducción de cantidad (de 200 a 180)
  ],
  [
    "02.02",
    null,
    "KG",
    "Acero corrugado B-500S en cimientos",
    1,
    23000.00,
    23000.00,
    null,
    1.40,
    0,
    32200.00 // Reducción de cantidad (de 25000 a 23000)
  ],
  [
    "02.03",
    null,
    "UD",
    "Encofrado metálico de pilares circulares",
    1,
    10.00,
    10.00,
    null,
    500.00,
    0,
    5000.00 // Partida añadida
  ]
];
