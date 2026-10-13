/**
 * Начальные данные M-TREND.
 *  — справочники (категории, цвета, склады, магазины, доставка, оплата, страницы);
 *  — ДЕМОНСТРАЦИОННЫЕ товары (isDemo = true) для проверки дизайна и функций.
 *    Цены, составы, скидки и остатки демо-товаров условные и не являются данными для реальных продаж.
 *
 * Запуск: npm run db:seed   (повторный запуск безопасен — используется upsert)
 * SEED_DEMO=false — не создавать демо-товары.
 */
import { PrismaClient, type FitType, type Season } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { recomputeAllProductAggregates } from "../src/lib/product-aggregates";

const prisma = new PrismaClient();

const categories: { slug: string; ru: string; kz: string; children?: [string, string, string][]; home?: boolean; image?: string }[] = [
  {
    slug: "kostyumy",
    ru: "Костюмы",
    kz: "Костюмдер",
    home: true,
    image: "/demo/suit-navy-1.svg",
    children: [
      ["kostyumy-dvoyki", "Костюмы двойки", "Екі бөлікті костюмдер"],
      ["kostyumy-troyki", "Костюмы тройки", "Үш бөлікті костюмдер"],
      ["kostyumy-odnobortnye", "Однобортные", "Бір өңірлі"],
      ["kostyumy-dvubortnye", "Двубортные", "Екі өңірлі"],
      ["kostyumy-slim-fit", "Slim Fit", "Slim Fit"],
      ["kostyumy-regular-fit", "Regular Fit", "Regular Fit"],
      ["kostyumy-demisezonnye", "Демисезонные", "Демимаусымдық"],
      ["kostyumy-uteplennye", "Утеплённые", "Жылытылған"],
    ],
  },
  {
    slug: "bryuki-i-dzhinsy",
    ru: "Брюки и джинсы",
    kz: "Шалбарлар мен джинсы",
    home: true,
    image: "/demo/trousers-graphite-1.svg",
    children: [
      ["klassicheskie-bryuki", "Классические брюки", "Классикалық шалбарлар"],
      ["slaksy", "Слаксы", "Слакстар"],
      ["bryuki-regular-fit", "Regular Fit", "Regular Fit"],
      ["bryuki-slim-fit", "Slim Fit", "Slim Fit"],
      ["uteplennye-bryuki", "Утеплённые брюки", "Жылытылған шалбарлар"],
      ["dzhinsy", "Джинсы", "Джинсы"],
    ],
  },
  {
    slug: "verhnyaya-odezhda",
    ru: "Верхняя одежда",
    kz: "Сырт киім",
    home: true,
    image: "/demo/coat-camel-1.svg",
    children: [
      ["kurtki", "Куртки", "Күртелер"],
      ["vetrovki", "Ветровки", "Желден қорғайтын күртелер"],
      ["bombery", "Бомберы", "Бомберлер"],
      ["palto", "Пальто", "Пальтолар"],
      ["trenchi", "Тренчи", "Тренчтер"],
      ["kozhanye-kurtki", "Кожаные куртки", "Былғары күртелер"],
    ],
  },
  {
    slug: "trikotazh",
    ru: "Трикотаж",
    kz: "Трикотаж",
    home: true,
    image: "/demo/knit-beige-1.svg",
    children: [
      ["dzhempery", "Джемперы", "Джемперлер"],
      ["kardigany", "Кардиганы", "Кардигандар"],
      ["vodolazki", "Водолазки", "Водолазкалар"],
      ["polo", "Поло", "Поло"],
      ["zhilety", "Жилеты", "Жилеттер"],
    ],
  },
  {
    slug: "rubashki",
    ru: "Рубашки",
    kz: "Жейделер",
    home: true,
    image: "/demo/shirt-white-1.svg",
    children: [
      ["rubashki-klassicheskie", "Классические", "Классикалық"],
      ["rubashki-povsednevnye", "Повседневные", "Күнделікті"],
      ["rubashki-slim-fit", "Slim Fit", "Slim Fit"],
      ["rubashki-regular-fit", "Regular Fit", "Regular Fit"],
    ],
  },
  {
    slug: "obuv",
    ru: "Обувь",
    kz: "Аяқ киім",
    home: true,
    image: "/demo/loafers-brown-1.svg",
    children: [
      ["tufli", "Туфли", "Туфлилер"],
      ["lofery", "Лоферы", "Лоферлер"],
      ["krossovki", "Кроссовки", "Кроссовкалар"],
      ["botinki", "Ботинки", "Бәтеңкелер"],
    ],
  },
  { slug: "futbolki", ru: "Футболки", kz: "Футболкалар", image: "/demo/tshirt-white-1.svg" },
  { slug: "sportivnaya-odezhda", ru: "Спортивная одежда", kz: "Спорттық киім", image: "/demo/sport-graphite-1.svg" },
  { slug: "termobele", ru: "Термобельё", kz: "Термоішкиім", image: "/demo/thermo-black-1.svg" },
  { slug: "aksessuary", ru: "Аксессуары", kz: "Аксессуарлар", home: true, image: "/demo/belt-brown-1.svg" },
];

const colors: [string, string, string, string][] = [
  ["navy", "Тёмно-синий", "Қою көк", "#1f2a44"],
  ["black", "Чёрный", "Қара", "#1c1c1c"],
  ["graphite", "Графитовый", "Графит", "#4a4a4a"],
  ["grey", "Серый", "Сұр", "#8d8d8d"],
  ["beige", "Бежевый", "Беж", "#cbb59a"],
  ["camel", "Кэмел", "Кэмел", "#b08559"],
  ["brown", "Коричневый", "Қоңыр", "#6b4a32"],
  ["white", "Белый", "Ақ", "#f4f2ee"],
  ["lightblue", "Голубой", "Көгілдір", "#a9c1d9"],
  ["blue", "Синий", "Көк", "#5b7fa6"],
  ["olive", "Оливковый", "Зәйтүн", "#5f6146"],
  ["burgundy", "Бордовый", "Қызыл күрең", "#6d2533"],
  ["cream", "Молочный", "Сүтті", "#e8dcc6"],
  ["khaki", "Хаки", "Хаки", "#9b8b63"],
  ["indigo", "Индиго", "Индиго", "#2f3e5c"],
];

// ДЕМО-таблицы замеров (см). Обязательно замените реальными замерами моделей M-TREND.
const suitSlimRows = [
  { size: "46", chestMin: 90, chestMax: 93, waistMin: 76, waistMax: 79 },
  { size: "48", chestMin: 94, chestMax: 97, waistMin: 80, waistMax: 83 },
  { size: "50", chestMin: 98, chestMax: 101, waistMin: 84, waistMax: 87 },
  { size: "52", chestMin: 102, chestMax: 105, waistMin: 88, waistMax: 91 },
  { size: "54", chestMin: 106, chestMax: 109, waistMin: 92, waistMax: 95 },
  { size: "56", chestMin: 110, chestMax: 113, waistMin: 96, waistMax: 100 },
].flatMap((r) =>
  [
    ["176", 170, 178],
    ["182", 179, 185],
    ["188", 186, 194],
  ].map(([h, a, b]) => ({ ...r, height: h as string, heightMin: a as number, heightMax: b as number })),
);
const suitRegularRows = suitSlimRows.map((r) => ({ ...r, waistMin: r.waistMin + 3, waistMax: r.waistMax + 4 }));
const shirtRows = [
  { size: "38", chestMin: 92, chestMax: 96, waistMin: 78, waistMax: 84 },
  { size: "39", chestMin: 96, chestMax: 100, waistMin: 82, waistMax: 88 },
  { size: "40", chestMin: 100, chestMax: 104, waistMin: 86, waistMax: 92 },
  { size: "41", chestMin: 104, chestMax: 108, waistMin: 90, waistMax: 96 },
  { size: "42", chestMin: 108, chestMax: 112, waistMin: 94, waistMax: 100 },
  { size: "43", chestMin: 112, chestMax: 116, waistMin: 98, waistMax: 104 },
];
const letterRows = [
  { size: "S", chestMin: 90, chestMax: 96, waistMin: 76, waistMax: 82, heightMin: 168, heightMax: 176 },
  { size: "M", chestMin: 96, chestMax: 102, waistMin: 82, waistMax: 88, heightMin: 172, heightMax: 180 },
  { size: "L", chestMin: 102, chestMax: 108, waistMin: 88, waistMax: 94, heightMin: 176, heightMax: 184 },
  { size: "XL", chestMin: 108, chestMax: 114, waistMin: 94, waistMax: 100, heightMin: 178, heightMax: 188 },
  { size: "XXL", chestMin: 114, chestMax: 120, waistMin: 100, waistMax: 108, heightMin: 180, heightMax: 192 },
];
const trouserRows = [
  { size: "46", waistMin: 76, waistMax: 79, hipsMin: 92, hipsMax: 95 },
  { size: "48", waistMin: 80, waistMax: 83, hipsMin: 96, hipsMax: 99 },
  { size: "50", waistMin: 84, waistMax: 87, hipsMin: 100, hipsMax: 103 },
  { size: "52", waistMin: 88, waistMax: 91, hipsMin: 104, hipsMax: 107 },
  { size: "54", waistMin: 92, waistMax: 95, hipsMin: 108, hipsMax: 111 },
];

type DemoProduct = {
  article: string;
  category: string;
  ru: string;
  kz: string;
  shape: string;
  colors: string[];
  sizes: string[];
  heights?: string[];
  price: number;
  oldPrice?: number;
  fit?: FitType;
  season?: Season;
  materialRu: string;
  materialKz: string;
  compositionRu: string;
  compositionKz: string;
  descRu: string;
  descKz: string;
  chart?: "suitSlim" | "suitRegular" | "shirt" | "letter" | "trousers";
  isNew?: boolean;
  hit?: boolean;
  /** явные остатки: [colorCode, size, height|null, AST, AKT] */
  stocks?: [string, string, string | null, number, number][];
};

const demoProducts: DemoProduct[] = [
  {
    article: "9293",
    category: "kostyumy-dvoyki",
    ru: "Костюм-двойка классический",
    kz: "Классикалық екі бөлікті костюм",
    shape: "suit",
    colors: ["navy", "graphite"],
    sizes: ["50", "52", "54", "56"],
    heights: ["176", "182"],
    price: 89000,
    fit: "SLIM",
    season: "DEMI",
    materialRu: "Шерсть",
    materialKz: "Жүн",
    compositionRu: "70% шерсть, 30% полиэстер (демо)",
    compositionKz: "70% жүн, 30% полиэстер (демо)",
    descRu: "Демонстрационная карточка костюма-двойки: пиджак на двух пуговицах и брюки со стрелками. Используется для проверки выбора цвета, размера и ростовки.",
    descKz: "Екі бөлікті костюмнің демонстрациялық карточкасы: екі түймелі пиджак және қырлы шалбар. Түс, өлшем және бой ұзындығын таңдауды тексеру үшін қолданылады.",
    chart: "suitSlim",
    isNew: true,
    hit: true,
    // Пример из ТЗ: тёмно-синий — 50: 2 шт., 52: 0 шт., 54: 4 шт., 56: 1 шт.
    stocks: [
      ["navy", "50", "176", 1, 0],
      ["navy", "50", "182", 0, 1],
      ["navy", "52", "176", 0, 0],
      ["navy", "52", "182", 0, 0],
      ["navy", "54", "176", 2, 0],
      ["navy", "54", "182", 1, 1],
      ["navy", "56", "176", 0, 0],
      ["navy", "56", "182", 1, 0],
    ],
  },
  {
    article: "DEMO-1102",
    category: "kostyumy-troyki",
    ru: "Костюм-тройка с жилетом",
    kz: "Жилеті бар үш бөлікті костюм",
    shape: "suit",
    colors: ["graphite", "brown"],
    sizes: ["48", "50", "52", "54"],
    heights: ["176", "182", "188"],
    price: 115000,
    oldPrice: 135000,
    fit: "REGULAR",
    season: "WINTER",
    materialRu: "Шерсть",
    materialKz: "Жүн",
    compositionRu: "80% шерсть, 20% полиэстер (демо)",
    compositionKz: "80% жүн, 20% полиэстер (демо)",
    descRu: "Демо: костюм-тройка — пиджак, жилет и брюки. Посадка Regular Fit.",
    descKz: "Демо: үш бөлікті костюм — пиджак, жилет және шалбар. Regular Fit пішімі.",
    chart: "suitRegular",
  },
  {
    article: "DEMO-1205",
    category: "kostyumy-dvubortnye",
    ru: "Костюм двубортный",
    kz: "Екі өңірлі костюм",
    shape: "suit",
    colors: ["black"],
    sizes: ["48", "50", "52"],
    heights: ["182", "188"],
    price: 98000,
    fit: "REGULAR",
    season: "ALL_SEASON",
    materialRu: "Шерсть",
    materialKz: "Жүн",
    compositionRu: "60% шерсть, 40% вискоза (демо)",
    compositionKz: "60% жүн, 40% вискоза (демо)",
    descRu: "Демо: двубортный костюм для торжественных мероприятий.",
    descKz: "Демо: салтанатты іс-шараларға арналған екі өңірлі костюм.",
    chart: "suitRegular",
    isNew: true,
  },
  {
    article: "DEMO-2101",
    category: "klassicheskie-bryuki",
    ru: "Брюки классические",
    kz: "Классикалық шалбар",
    shape: "trousers",
    colors: ["graphite", "navy", "beige"],
    sizes: ["46", "48", "50", "52", "54"],
    price: 27000,
    fit: "REGULAR",
    season: "ALL_SEASON",
    materialRu: "Полиэстер / вискоза",
    materialKz: "Полиэстер / вискоза",
    compositionRu: "65% полиэстер, 35% вискоза (демо)",
    compositionKz: "65% полиэстер, 35% вискоза (демо)",
    descRu: "Демо: классические брюки со стрелками.",
    descKz: "Демо: қырлы классикалық шалбар.",
    chart: "trousers",
    hit: true,
  },
  {
    article: "DEMO-2203",
    category: "dzhinsy",
    ru: "Джинсы прямые",
    kz: "Түзу джинсы",
    shape: "trousers",
    colors: ["indigo", "black"],
    sizes: ["46", "48", "50", "52"],
    price: 24000,
    oldPrice: 29000,
    fit: "REGULAR",
    season: "ALL_SEASON",
    materialRu: "Хлопок",
    materialKz: "Мақта",
    compositionRu: "98% хлопок, 2% эластан (демо)",
    compositionKz: "98% мақта, 2% эластан (демо)",
    descRu: "Демо: прямые джинсы повседневного кроя.",
    descKz: "Демо: күнделікті пішімдегі түзу джинсы.",
    chart: "trousers",
  },
  {
    article: "DEMO-3101",
    category: "palto",
    ru: "Пальто шерстяное",
    kz: "Жүн пальто",
    shape: "coat",
    colors: ["camel", "black"],
    sizes: ["48", "50", "52", "54"],
    price: 145000,
    fit: "REGULAR",
    season: "WINTER",
    materialRu: "Шерсть",
    materialKz: "Жүн",
    compositionRu: "70% шерсть, 30% полиамид (демо)",
    compositionKz: "70% жүн, 30% полиамид (демо)",
    descRu: "Демо: классическое пальто прямого силуэта.",
    descKz: "Демо: тік силуэтті классикалық пальто.",
    isNew: true,
    hit: true,
  },
  {
    article: "DEMO-3205",
    category: "kurtki",
    ru: "Куртка утеплённая",
    kz: "Жылытылған күрте",
    shape: "jacket",
    colors: ["olive", "black"],
    sizes: ["M", "L", "XL", "XXL"],
    price: 69000,
    oldPrice: 79000,
    fit: "REGULAR",
    season: "WINTER",
    materialRu: "Полиэстер",
    materialKz: "Полиэстер",
    compositionRu: "Верх: 100% полиэстер (демо)",
    compositionKz: "Беті: 100% полиэстер (демо)",
    descRu: "Демо: утеплённая куртка на молнии.",
    descKz: "Демо: сыдырмалы жылытылған күрте.",
    chart: "letter",
  },
  {
    article: "DEMO-3307",
    category: "bombery",
    ru: "Бомбер",
    kz: "Бомбер",
    shape: "jacket",
    colors: ["navy", "khaki"],
    sizes: ["M", "L", "XL"],
    price: 42000,
    fit: "REGULAR",
    season: "DEMI",
    materialRu: "Полиэстер",
    materialKz: "Полиэстер",
    compositionRu: "100% полиэстер (демо)",
    compositionKz: "100% полиэстер (демо)",
    descRu: "Демо: лёгкий бомбер на демисезон.",
    descKz: "Демо: демимаусымға арналған жеңіл бомбер.",
    chart: "letter",
    isNew: true,
  },
  {
    article: "DEMO-4101",
    category: "dzhempery",
    ru: "Джемпер из мериноса",
    kz: "Меринос джемпері",
    shape: "knit",
    colors: ["beige", "grey", "navy"],
    sizes: ["S", "M", "L", "XL"],
    price: 32000,
    fit: "REGULAR",
    season: "DEMI",
    materialRu: "Шерсть",
    materialKz: "Жүн",
    compositionRu: "50% шерсть мериноса, 50% акрил (демо)",
    compositionKz: "50% меринос жүні, 50% акрил (демо)",
    descRu: "Демо: тонкий джемпер с круглым вырезом.",
    descKz: "Демо: дөңгелек ойындысы бар жұқа джемпер.",
    chart: "letter",
    hit: true,
  },
  {
    article: "DEMO-4205",
    category: "vodolazki",
    ru: "Водолазка",
    kz: "Водолазка",
    shape: "knit",
    colors: ["black", "cream"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    price: 19000,
    oldPrice: 23000,
    fit: "SLIM",
    season: "WINTER",
    materialRu: "Вискоза",
    materialKz: "Вискоза",
    compositionRu: "70% вискоза, 30% нейлон (демо)",
    compositionKz: "70% вискоза, 30% нейлон (демо)",
    descRu: "Демо: базовая водолазка приталенного кроя.",
    descKz: "Демо: қынамалы пішімдегі базалық водолазка.",
    chart: "letter",
  },
  {
    article: "DEMO-4310",
    category: "polo",
    ru: "Поло трикотажное",
    kz: "Трикотаж поло",
    shape: "polo",
    colors: ["navy", "white", "burgundy"],
    sizes: ["S", "M", "L", "XL"],
    price: 16000,
    fit: "REGULAR",
    season: "SUMMER",
    materialRu: "Хлопок",
    materialKz: "Мақта",
    compositionRu: "100% хлопок (демо)",
    compositionKz: "100% мақта (демо)",
    descRu: "Демо: поло из хлопкового пике.",
    descKz: "Демо: мақта пикеден жасалған поло.",
    chart: "letter",
    isNew: true,
  },
  {
    article: "DEMO-5101",
    category: "rubashki-klassicheskie",
    ru: "Рубашка классическая",
    kz: "Классикалық жейде",
    shape: "shirt",
    colors: ["white", "lightblue"],
    sizes: ["38", "39", "40", "41", "42", "43"],
    price: 18000,
    fit: "SLIM",
    season: "ALL_SEASON",
    materialRu: "Хлопок",
    materialKz: "Мақта",
    compositionRu: "100% хлопок (демо)",
    compositionKz: "100% мақта (демо)",
    descRu: "Демо: классическая рубашка под костюм. Размер — по обхвату шеи.",
    descKz: "Демо: костюмге арналған классикалық жейде. Өлшемі — мойын көлемі бойынша.",
    chart: "shirt",
    hit: true,
  },
  {
    article: "DEMO-5204",
    category: "rubashki-povsednevnye",
    ru: "Рубашка повседневная оксфорд",
    kz: "Күнделікті оксфорд жейде",
    shape: "shirt",
    colors: ["blue", "cream"],
    sizes: ["S", "M", "L", "XL"],
    price: 17000,
    oldPrice: 21000,
    fit: "REGULAR",
    season: "ALL_SEASON",
    materialRu: "Хлопок",
    materialKz: "Мақта",
    compositionRu: "100% хлопок (демо)",
    compositionKz: "100% мақта (демо)",
    descRu: "Демо: повседневная рубашка из ткани оксфорд.",
    descKz: "Демо: оксфорд матасынан жасалған күнделікті жейде.",
    chart: "letter",
  },
  {
    article: "DEMO-6101",
    category: "tufli",
    ru: "Туфли кожаные дерби",
    kz: "Былғары дерби туфли",
    shape: "shoes",
    colors: ["black", "brown"],
    sizes: ["40", "41", "42", "43", "44"],
    price: 46000,
    season: "ALL_SEASON",
    materialRu: "Натуральная кожа",
    materialKz: "Табиғи былғары",
    compositionRu: "Верх: натуральная кожа, подошва: ТЭП (демо)",
    compositionKz: "Беті: табиғи былғары, табаны: ТЭП (демо)",
    descRu: "Демо: классические туфли дерби.",
    descKz: "Демо: классикалық дерби туфлилері.",
    hit: true,
  },
  {
    article: "DEMO-6205",
    category: "lofery",
    ru: "Лоферы замшевые",
    kz: "Күдері лоферлер",
    shape: "loafers",
    colors: ["brown", "navy"],
    sizes: ["40", "41", "42", "43", "44"],
    price: 39000,
    oldPrice: 45000,
    season: "SUMMER",
    materialRu: "Замша",
    materialKz: "Күдері",
    compositionRu: "Верх: натуральная замша (демо)",
    compositionKz: "Беті: табиғи күдері (демо)",
    descRu: "Демо: лоферы для smart casual образов.",
    descKz: "Демо: smart casual образдарына арналған лоферлер.",
    isNew: true,
  },
  {
    article: "DEMO-6307",
    category: "krossovki",
    ru: "Кроссовки кожаные",
    kz: "Былғары кроссовкалар",
    shape: "sneakers",
    colors: ["white", "black"],
    sizes: ["40", "41", "42", "43", "44", "45"],
    price: 36000,
    season: "ALL_SEASON",
    materialRu: "Натуральная кожа",
    materialKz: "Табиғи былғары",
    compositionRu: "Верх: натуральная кожа (демо)",
    compositionKz: "Беті: табиғи былғары (демо)",
    descRu: "Демо: минималистичные кожаные кроссовки.",
    descKz: "Демо: минималистік былғары кроссовкалар.",
  },
  {
    article: "DEMO-6410",
    category: "botinki",
    ru: "Ботинки зимние",
    kz: "Қысқы бәтеңкелер",
    shape: "boots",
    colors: ["brown", "black"],
    sizes: ["41", "42", "43", "44"],
    price: 52000,
    season: "WINTER",
    materialRu: "Натуральная кожа",
    materialKz: "Табиғи былғары",
    compositionRu: "Верх: натуральная кожа, подкладка: шерсть (демо)",
    compositionKz: "Беті: табиғи былғары, астары: жүн (демо)",
    descRu: "Демо: зимние ботинки на шерстяной подкладке.",
    descKz: "Демо: жүн астарлы қысқы бәтеңкелер.",
  },
  {
    article: "DEMO-7101",
    category: "futbolki",
    ru: "Футболка базовая",
    kz: "Базалық футболка",
    shape: "tshirt",
    colors: ["white", "black", "grey"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    price: 8000,
    fit: "REGULAR",
    season: "SUMMER",
    materialRu: "Хлопок",
    materialKz: "Мақта",
    compositionRu: "100% хлопок (демо)",
    compositionKz: "100% мақта (демо)",
    descRu: "Демо: базовая футболка из плотного хлопка.",
    descKz: "Демо: тығыз мақтадан жасалған базалық футболка.",
    chart: "letter",
  },
  {
    article: "DEMO-8101",
    category: "aksessuary",
    ru: "Ремень кожаный",
    kz: "Былғары белдік",
    shape: "belt",
    colors: ["black", "brown"],
    sizes: ["110", "115", "120"],
    price: 12000,
    season: "ALL_SEASON",
    materialRu: "Натуральная кожа",
    materialKz: "Табиғи былғары",
    compositionRu: "Натуральная кожа, металлическая пряжка (демо)",
    compositionKz: "Табиғи былғары, металл тоға (демо)",
    descRu: "Демо: классический кожаный ремень.",
    descKz: "Демо: классикалық былғары белдік.",
  },
  {
    article: "DEMO-9101",
    category: "termobele",
    ru: "Комплект термобелья",
    kz: "Термоішкиім жиынтығы",
    shape: "thermo",
    colors: ["black", "graphite"],
    sizes: ["M", "L", "XL"],
    price: 15000,
    season: "WINTER",
    materialRu: "Полиэстер",
    materialKz: "Полиэстер",
    compositionRu: "90% полиэстер, 10% эластан (демо)",
    compositionKz: "90% полиэстер, 10% эластан (демо)",
    descRu: "Демо: комплект термобелья для холодного сезона.",
    descKz: "Демо: суық маусымға арналған термоішкиім жиынтығы.",
    chart: "letter",
  },
];

// детерминированный «случайный» генератор остатков, чтобы seed был воспроизводимым
function pseudo(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Math.abs(h);
}

async function main() {
  const seedDemo = process.env.SEED_DEMO !== "false";

  // Склады
  const ast = await prisma.warehouse.upsert({
    where: { code: "AST" },
    update: {},
    create: { code: "AST", name: "Склад Астана", city: "Астана", priority: 0 },
  });
  const akt = await prisma.warehouse.upsert({
    where: { code: "AKT" },
    update: {},
    create: { code: "AKT", name: "Склад Актобе", city: "Актобе", priority: 1 },
  });

  // Магазины (часы работы и телефоны заполняет администратор)
  const stores = [
    { key: "ast-sunrise", city: "Астана", nameRu: "ТК Sunrise", nameKz: "Sunrise СО", addrRu: "ул. Сығанақ, 11, ТК Sunrise", addrKz: "Сығанақ к-сі, 11, Sunrise СО", wh: ast.id, citySlug: "astana" },
    { key: "ast-sarykol", city: "Астана", nameRu: "ТК Сарыколь", nameKz: "Сарыкөл СО", addrRu: "пр. Р. Қошқарбаева, 15, ТК Сарыколь", addrKz: "Р. Қошқарбаев д-лы, 15, Сарыкөл СО", wh: ast.id, citySlug: "astana" },
    { key: "akt-imanova", city: "Актобе", nameRu: "ул. А. Иманова, 49", nameKz: "Ә. Иманов к-сі, 49", addrRu: "ул. А. Иманова, 49", addrKz: "Ә. Иманов к-сі, 49", wh: akt.id, citySlug: "aktobe" },
    { key: "akt-mega", city: "Актобе", nameRu: "ТЦ Мега Шығыс", nameKz: "Мега Шығыс СО", addrRu: "ТЦ Мега Шығыс, 1 этаж, блок 1, бутик 10А", addrKz: "Мега Шығыс СО, 1-қабат, 1-блок, 10А бутик", wh: akt.id, citySlug: "aktobe" },
    { key: "akt-astana", city: "Актобе", nameRu: "ТД Астана", nameKz: "Астана СҮ", addrRu: "ТД Астана, 2 этаж, блок Б, бутик 83", addrKz: "Астана СҮ, 2-қабат, Б блогы, 83 бутик", wh: akt.id, citySlug: "aktobe" },
  ];
  if ((await prisma.store.count()) === 0) {
    for (const [i, s] of stores.entries()) {
      await prisma.store.create({
        data: {
          city: s.city,
          nameRu: s.nameRu,
          nameKz: s.nameKz,
          addressRu: s.addrRu,
          addressKz: s.addrKz,
          warehouseId: s.wh,
          // ссылка на поиск адреса в 2ГИС; точные координаты и iframe карты задаются в админ-панели
          mapUrl: `https://2gis.kz/${s.citySlug}/search/${encodeURIComponent(s.addrRu)}`,
          sortOrder: i,
          isPickup: true,
        },
      });
    }
  }

  // Цвета
  for (const [i, [code, ru, kz, hex]] of colors.entries()) {
    await prisma.color.upsert({ where: { code }, update: {}, create: { code, nameRu: ru, nameKz: kz, hex, sortOrder: i } });
  }

  // Категории
  await prisma.category.upsert({
    where: { slug: "unsorted" },
    update: {},
    create: { slug: "unsorted", nameRu: "Без категории (импорт)", nameKz: "Санатсыз (импорт)", isActive: false, sortOrder: 999 },
  });
  for (const [i, c] of categories.entries()) {
    const parent = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { slug: c.slug, nameRu: c.ru, nameKz: c.kz, sortOrder: i, showOnHome: !!c.home, imageUrl: c.image ?? null },
    });
    for (const [j, [slug, ru, kz]] of (c.children ?? []).entries()) {
      await prisma.category.upsert({ where: { slug }, update: {}, create: { slug, nameRu: ru, nameKz: kz, parentId: parent.id, sortOrder: j } });
    }
  }

  // Доставка — тарифы задаёт администратор; по умолчанию стоимость сообщает менеджер
  const delivery = [
    { code: "pickup", type: "PICKUP" as const, nameRu: "Самовывоз из магазина", nameKz: "Дүкеннен өзі алып кету", descRu: "Заберите заказ в одном из магазинов M-TREND после звонка менеджера.", descKz: "Менеджер қоңырау шалғаннан кейін тапсырысты M-TREND дүкендерінің бірінен алыңыз.", price: 0, cities: ["Астана", "Актобе"], etaRu: "После подтверждения заказа", etaKz: "Тапсырыс расталғаннан кейін", calcByManager: false },
    { code: "courier_city", type: "COURIER" as const, nameRu: "Курьер по городу", nameKz: "Қала бойынша курьер", descRu: "Доставка курьером по Астане и Актобе.", descKz: "Астана мен Ақтөбе бойынша курьерлік жеткізу.", price: 0, cities: ["Астана", "Актобе"], etaRu: "1–2 дня", etaKz: "1–2 күн", calcByManager: true },
    { code: "kz_delivery", type: "POST" as const, nameRu: "Доставка по Казахстану", nameKz: "Қазақстан бойынша жеткізу", descRu: "Отправка курьерской службой в любой город Казахстана.", descKz: "Қазақстанның кез келген қаласына курьерлік қызметпен жіберу.", price: 0, cities: [], etaRu: "Сроки зависят от города", etaKz: "Мерзімі қалаға байланысты", calcByManager: true },
  ];
  for (const [i, d] of delivery.entries()) {
    await prisma.deliveryMethod.upsert({ where: { code: d.code }, update: {}, create: { ...d, sortOrder: i } });
  }

  // Оплата: онлайн-провайдеры неактивны, пока не подключены по договору
  const payments = [
    { code: "manager", provider: "manual", nameRu: "Оплата после подтверждения менеджером", nameKz: "Менеджер растағаннан кейін төлеу", descRu: "Менеджер свяжется с вами, подтвердит наличие и сообщит способ оплаты (Kaspi, перевод, карта).", descKz: "Менеджер сізбен хабарласып, қолжетімділікті растайды және төлем тәсілін хабарлайды (Kaspi, аударым, карта).", isActive: true },
    { code: "on_pickup", provider: "cash", nameRu: "Оплата при получении в магазине", nameKz: "Дүкенде алған кезде төлеу", descRu: "Наличными или картой при самовывозе.", descKz: "Өзі алып кету кезінде қолма-қол немесе картамен.", isActive: true },
    { code: "kaspi_pay", provider: "kaspi", nameRu: "Kaspi Pay", nameKz: "Kaspi Pay", descRu: "Онлайн-оплата через Kaspi (требует подключения).", descKz: "Kaspi арқылы онлайн төлем (қосуды қажет етеді).", isActive: false },
    { code: "card_online", provider: "card_gateway", nameRu: "Банковская карта онлайн", nameKz: "Банк картасымен онлайн", descRu: "Требует подключения эквайринга.", descKz: "Эквайрингті қосуды қажет етеді.", isActive: false },
  ];
  for (const [i, p] of payments.entries()) {
    await prisma.paymentMethod.upsert({ where: { code: p.code }, update: {}, create: { ...p, sortOrder: i } });
  }

  // Страницы (шаблоны — требуют проверки и заполнения)
  const pages = [
    {
      slug: "delivery",
      titleRu: "Доставка и оплата",
      titleKz: "Жеткізу және төлем",
      contentRu:
        "## Доставка\n\n- Самовывоз из магазинов M-TREND в Астане и Актобе.\n- Курьерская доставка по Астане и Актобе.\n- Доставка во все города Казахстана курьерской службой.\n\nСтоимость и сроки доставки менеджер сообщает при подтверждении заказа.\n\n## Оплата\n\nПосле оформления заказа менеджер свяжется с вами для подтверждения наличия и согласования способа оплаты.\n\n**Шаблон страницы — отредактируйте в админ-панели (Страницы).**",
      contentKz:
        "## Жеткізу\n\n- Астана мен Ақтөбедегі M-TREND дүкендерінен өзі алып кету.\n- Астана мен Ақтөбе бойынша курьерлік жеткізу.\n- Қазақстанның барлық қалаларына курьерлік қызметпен жеткізу.\n\nЖеткізу құны мен мерзімін менеджер тапсырысты растау кезінде хабарлайды.\n\n## Төлем\n\nТапсырыс рәсімделгеннен кейін менеджер қолжетімділікті растау және төлем тәсілін келісу үшін сізбен хабарласады.\n\n**Бет үлгісі — әкімші панелінде өңдеңіз.**",
    },
    {
      slug: "returns",
      titleRu: "Обмен и возврат",
      titleKz: "Айырбастау және қайтару",
      contentRu:
        "Обмен и возврат товара надлежащего качества осуществляется в соответствии с Законом Республики Казахстан «О защите прав потребителей».\n\nДля оформления обмена или возврата свяжитесь с нами по телефону или WhatsApp, указанным на сайте.\n\n**Шаблон страницы — уточните условия и отредактируйте в админ-панели.**",
      contentKz:
        "Сапасы тиісті тауарды айырбастау және қайтару Қазақстан Республикасының «Тұтынушылардың құқықтарын қорғау туралы» Заңына сәйкес жүзеге асырылады.\n\nАйырбастау немесе қайтаруды рәсімдеу үшін сайтта көрсетілген телефон немесе WhatsApp арқылы бізбен хабарласыңыз.\n\n**Бет үлгісі — шарттарды нақтылап, әкімші панелінде өңдеңіз.**",
    },
    {
      slug: "about",
      titleRu: "О компании",
      titleKz: "Компания туралы",
      contentRu: "M-TREND — магазины мужской одежды, обуви и аксессуаров в Астане и Актобе. Современная классика, деловой стиль, smart casual и повседневная мода.\n\n**Шаблон страницы — дополните историю бренда в админ-панели.**",
      contentKz: "M-TREND — Астана мен Ақтөбедегі ерлер киімі, аяқ киімі және аксессуарлар дүкендері. Заманауи классика, іскерлік стиль, smart casual және күнделікті сән.\n\n**Бет үлгісі — бренд тарихын әкімші панелінде толықтырыңыз.**",
    },
    {
      slug: "privacy",
      titleRu: "Политика конфиденциальности",
      titleKz: "Құпиялылық саясаты",
      contentRu:
        "Мы обрабатываем персональные данные (имя, телефон, email, адрес доставки) исключительно для оформления и доставки заказов и связи с покупателем, в соответствии с Законом РК «О персональных данных и их защите».\n\nДанные не передаются третьим лицам, за исключением служб доставки в объёме, необходимом для исполнения заказа.\n\n**Шаблон — требует проверки юристом и указания реквизитов оператора персональных данных.**",
      contentKz:
        "Біз дербес деректерді (аты, телефон, email, жеткізу мекенжайы) ҚР «Дербес деректер және оларды қорғау туралы» Заңына сәйкес тек тапсырыстарды рәсімдеу, жеткізу және сатып алушымен байланысу үшін өңдейміз.\n\n**Үлгі — заңгердің тексеруін қажет етеді.**",
    },
    {
      slug: "offer",
      titleRu: "Публичная оферта",
      titleKz: "Жария оферта",
      contentRu: "**Шаблон. Текст публичной оферты должен быть подготовлен юристом с указанием реквизитов продавца (ИП/ТОО, БИН/ИИН).**",
      contentKz: "**Үлгі. Жария оферта мәтінін сатушының деректемелерін көрсете отырып заңгер дайындауы тиіс.**",
    },
  ];
  for (const [i, p] of pages.entries()) {
    await prisma.page.upsert({ where: { slug: p.slug }, update: {}, create: { ...p, sortOrder: i } });
  }

  // Баннеры
  if ((await prisma.banner.count()) === 0) {
    await prisma.banner.createMany({
      data: [
        {
          titleRu: "СТИЛЬ, КОТОРЫЙ ГОВОРИТ ЗА ТЕБЯ",
          titleKz: "СЕН ҮШІН СӨЙЛЕЙТІН СТИЛЬ",
          subtitleRu: "Новая коллекция костюмов и smart casual",
          subtitleKz: "Костюмдер мен smart casual жаңа коллекциясы",
          buttonRu: "Смотреть коллекцию",
          buttonKz: "Коллекцияны көру",
          link: "/catalog",
          imageUrl: "/demo/hero.svg",
          sortOrder: 0,
        },
        {
          titleRu: "Костюмы для важных дней",
          titleKz: "Маңызды күндерге арналған костюмдер",
          buttonRu: "Выбрать костюм",
          buttonKz: "Костюм таңдау",
          link: "/catalog/kostyumy",
          imageUrl: "/demo/hero-2.svg",
          textColor: "dark",
          sortOrder: 1,
        },
      ],
    });
  }

  // Настройки по умолчанию
  const defaults: Record<string, string> = { showDemoNotice: "true" };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  // Администратор
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@mtrend.kz").toLowerCase();
  if (!(await prisma.user.findUnique({ where: { email: adminEmail } }))) {
    const password = process.env.ADMIN_PASSWORD || randomBytes(9).toString("base64url");
    await prisma.user.create({
      data: { email: adminEmail, name: "Администратор", role: "ADMIN", position: "Администратор", passwordHash: await bcrypt.hash(password, 12) },
    });
    console.log(`\n  Администратор: ${adminEmail}\n  Пароль: ${process.env.ADMIN_PASSWORD ? "(из ADMIN_PASSWORD)" : password}\n  Смените пароль после первого входа!\n`);
  }

  if (!seedDemo) {
    console.log("SEED_DEMO=false — демо-товары не создаются");
    return;
  }

  // ─── ДЕМО-товары ───
  const charts = {
    suitSlim: await upsertChart("ДЕМО: Костюм Slim Fit", "SUIT", "SLIM", suitSlimRows),
    suitRegular: await upsertChart("ДЕМО: Костюм Regular Fit", "SUIT", "REGULAR", suitRegularRows),
    shirt: await upsertChart("ДЕМО: Рубашка классическая (размер по вороту)", "SHIRT", null, shirtRows),
    letter: await upsertChart("ДЕМО: Буквенная сетка S–XXL", "GENERIC", null, letterRows),
    trousers: await upsertChart("ДЕМО: Брюки", "TROUSERS", null, trouserRows),
  };
  const colorIds = new Map((await prisma.color.findMany()).map((c) => [c.code, c.id]));

  for (const [idx, d] of demoProducts.entries()) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: d.category } });
    const slug = `${d.article.toLowerCase()}-${d.shape}-demo`;
    const existing = await prisma.product.findUnique({ where: { article: d.article } });
    if (existing) continue;
    const product = await prisma.product.create({
      data: {
        slug,
        article: d.article,
        nameRu: `${d.ru} (демо)`,
        nameKz: `${d.kz} (демо)`,
        descriptionRu: d.descRu,
        descriptionKz: d.descKz,
        compositionRu: d.compositionRu,
        compositionKz: d.compositionKz,
        materialRu: d.materialRu,
        materialKz: d.materialKz,
        careRu: "Демо: следуйте рекомендациям на этикетке изделия.",
        careKz: "Демо: бұйым жапсырмасындағы ұсыныстарды орындаңыз.",
        fitAdviceRu: d.fit === "SLIM" ? "Модель приталенная. Если вы между размерами — выбирайте больший." : d.fit === "REGULAR" ? "Классическая посадка. Выбирайте свой обычный размер." : null,
        fitAdviceKz: d.fit === "SLIM" ? "Модель қынамалы. Екі өлшем арасында болсаңыз — үлкенін таңдаңыз." : d.fit === "REGULAR" ? "Классикалық пішім. Әдеттегі өлшеміңізді таңдаңыз." : null,
        season: d.season ?? null,
        fit: d.fit ?? null,
        categoryId: category.id,
        sizeChartId: d.chart ? charts[d.chart] : null,
        status: "ACTIVE",
        isNew: !!d.isNew,
        isBestseller: !!d.hit,
        isDemo: true,
        hasHeights: !!d.heights?.length,
        publishedAt: new Date(Date.now() - idx * 86400_000),
        createdAt: new Date(Date.now() - idx * 86400_000),
        salesCount: d.hit ? 5 + (pseudo(d.article) % 20) : pseudo(d.article) % 4,
      },
    });

    let sort = 0;
    for (const c of d.colors) {
      for (const v of [1, 2]) {
        await prisma.productImage.create({
          data: { productId: product.id, url: `/demo/${d.shape}-${c}-${v}.svg`, colorId: colorIds.get(c), sortOrder: sort++, altRu: `${d.ru} — демо-изображение`, altKz: `${d.kz} — демо-сурет` },
        });
      }
    }

    for (const c of d.colors) {
      for (const size of d.sizes) {
        for (const height of d.heights ?? [null]) {
          const sku = [d.article, c.toUpperCase(), size, height].filter(Boolean).join("-");
          const variant = await prisma.productVariant.create({
            data: { productId: product.id, sku, colorId: colorIds.get(c)!, size, height, price: d.price, oldPrice: d.oldPrice ?? null },
          });
          const explicit = d.stocks?.find((s) => s[0] === c && s[1] === size && s[2] === height);
          const r = pseudo(sku);
          const astQty = explicit ? explicit[3] : r % 5 === 0 ? 0 : r % 4;
          const aktQty = explicit ? explicit[4] : (r >> 3) % 6 === 0 ? 0 : (r >> 3) % 3;
          await prisma.stock.createMany({
            data: [
              { variantId: variant.id, warehouseId: ast.id, quantity: astQty },
              { variantId: variant.id, warehouseId: akt.id, quantity: aktQty },
            ],
          });
        }
      }
    }
  }

  await prisma.promoCode.upsert({
    where: { code: "DEMO10" },
    update: {},
    create: { code: "DEMO10", type: "PERCENT", value: 10, minOrder: 0, description: "Демо-промокод для проверки корзины. Отключите перед запуском." },
  });

  if ((await prisma.look.count()) === 0) {
    const byArticle = async (a: string) => (await prisma.product.findUnique({ where: { article: a } }))?.id;
    const looks = [
      { titleRu: "Деловой образ", titleKz: "Іскерлік образ", imageUrl: "/demo/suit-navy-2.svg", items: ["9293", "DEMO-5101", "DEMO-6101", "DEMO-8101"] },
      { titleRu: "Smart casual на каждый день", titleKz: "Күнделікті smart casual", imageUrl: "/demo/knit-beige-2.svg", items: ["DEMO-4101", "DEMO-2101", "DEMO-6205"] },
      { titleRu: "Зимний город", titleKz: "Қысқы қала", imageUrl: "/demo/coat-camel-2.svg", items: ["DEMO-3101", "DEMO-4205", "DEMO-6410"] },
    ];
    for (const [i, l] of looks.entries()) {
      const ids = (await Promise.all(l.items.map(byArticle))).filter((x): x is string => !!x);
      await prisma.look.create({
        data: { titleRu: l.titleRu, titleKz: l.titleKz, imageUrl: l.imageUrl, sortOrder: i, items: { create: ids.map((productId, j) => ({ productId, sortOrder: j })) } },
      });
    }
  }

  await recomputeAllProductAggregates(prisma);
  console.log(`Демо-товаров: ${await prisma.product.count({ where: { isDemo: true } })}, SKU: ${await prisma.productVariant.count()}`);
}

async function upsertChart(name: string, kind: string, fit: FitType | null, rows: object[]) {
  const existing = await prisma.sizeChart.findFirst({ where: { name } });
  if (existing) return existing.id;
  const chart = await prisma.sizeChart.create({
    data: {
      name,
      kind,
      fit,
      rows,
      isDemo: true,
      notesRu: "Демонстрационная таблица. Замените реальными замерами модели.",
      notesKz: "Демонстрациялық кесте. Модельдің нақты өлшемдерімен ауыстырыңыз.",
    },
  });
  return chart.id;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
