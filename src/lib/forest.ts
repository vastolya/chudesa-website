import { create } from "zustand";

/* ───────── open world ───────── */
export const WORLD_R = 74; // walkable radius
export const SPAWN = { x: 0, z: 6 };
export const REACH = 14; // how close you must be to interact with a wonder

export type Mech = "lantern" | "still" | "layers" | "gaze" | "behind" | "swarm" | "orbit";

/** Superformula preset index pairs: [theta-profile, phi-profile] — see creatureMaterial.ts */
export type Form = { a: [number, number]; b: [number, number] };

export type WonderDef = {
  id: string;
  service: string;
  x: number;
  z: number;
  y: number;
  mech: Mech;
  form: Form;
  size: number;
  hue: number;
  color: string;
  riddle: string;
  hint: string;
};

export const wonders: WonderDef[] = [
  {
    id: "research",
    service: "01",
    x: -18,
    z: -22,
    y: 2.0,
    mech: "lantern",
    form: { a: [0, 0], b: [5, 0] },
    size: 0.6,
    hue: 0.55,
    color: "#7af0ff",
    riddle: "Знание прячется в темноте. Посветите вокруг — фонарь у вас в руке. Да, это ваш курсор.",
    hint: "Оно совсем рядом, но не светится само. Проведите курсором по темноте вокруг.",
  },
  {
    id: "strategy",
    service: "02",
    x: 24,
    z: -30,
    y: 1.9,
    mech: "still",
    form: { a: [1, 0], b: [2, 0] },
    size: 0.6,
    hue: 0.1,
    color: "#ffd36a",
    riddle: "Один план вместо десяти гипотез. Перестаньте суетиться. Замрите — и он придёт сам.",
    hint: "Отпустите клавиши и мышь на три секунды.",
  },
  {
    id: "packaging",
    service: "03",
    x: -34,
    z: 8,
    y: 1.7,
    mech: "layers",
    form: { a: [3, 3], b: [3, 0] },
    size: 0.65,
    hue: 0.85,
    color: "#ff7ad9",
    riddle: "Это чудо пока в упаковке. Снимите с него три слоя.",
    hint: "Кликните по нему три раза.",
  },
  {
    id: "prototype",
    service: "04",
    x: 36,
    z: 12,
    y: 2.0,
    mech: "gaze",
    form: { a: [4, 1], b: [6, 0] },
    size: 0.6,
    hue: 0.3,
    color: "#c8ff2e",
    riddle: "Прототип ещё не настоящий — только каркас. Задержите на нём свет, и он станет реальным.",
    hint: "Держите курсор на каркасе пару секунд, потом кликните.",
  },
  {
    id: "web",
    service: "05",
    x: 6,
    z: -46,
    y: 1.9,
    mech: "behind",
    form: { a: [2, 2], b: [7, 0] },
    size: 0.6,
    hue: 0.7,
    color: "#8f7bff",
    riddle: "Сайт, который продаёт, всегда у клиента за спиной. Чувствуете? Обернитесь. Быстро.",
    hint: "Резко развернитесь: Q/E, стрелки или уведите курсор к краю экрана.",
  },
  {
    id: "content",
    service: "06",
    x: -12,
    z: 38,
    y: 1.8,
    mech: "swarm",
    form: { a: [0, 0], b: [0, 0] },
    size: 0.13,
    hue: 0.45,
    color: "#a8ffcf",
    riddle: "Контента должно быть много. Соберите рой — проведите по нему светом.",
    hint: "Водите курсором по маленьким огонькам.",
  },
  {
    id: "automation",
    service: "07",
    x: 24,
    z: 40,
    y: 2.2,
    mech: "orbit",
    form: { a: [6, 5], b: [1, 1] },
    size: 0.45,
    hue: 0.95,
    color: "#ffa25c",
    riddle: "Автоматизация не ждёт — она работает сама. Поймайте её. Промахнётесь — она подстроится под вас.",
    hint: "Кликайте по быстрой фигуре. Каждый промах её замедляет.",
  },
];

export type Landmark = { id: "process" | "cases" | "final"; x: number; z: number; r: number; label: string; icon: string };
export const landmarks: Landmark[] = [
  { id: "process", x: -44, z: -34, r: 9, label: "Камни пяти шагов", icon: "◇" },
  { id: "cases", x: 46, z: -14, r: 9, label: "Дерево историй", icon: "♣" },
  { id: "final", x: 0, z: -66, r: 13, label: "Поляна", icon: "✦" },
];

/* ───────── non-reactive per-frame state ───────── */
export const live = {
  x: SPAWN.x,
  z: SPAWN.z,
  y: 0, // eye height above terrain offset (jump)
  vy: 0,
  grounded: true,
  jumps: 0,
  locked: false, // pointer lock (shooter mode)
  fire: false, // primary action requested this frame
  lookDX: 0, // accumulated mouse deltas, consumed by the controller
  lookDY: 0,
  seed: 0,
  yaw: 0, // 0 = facing -z (north)
  yawVel: 0,
  pitch: 0,
  speed: 0,
  walked: 0,
  pointer: { x: 0, y: 0 },
  lastInput: 0,
  frozen: true,
  keys: new Set<string>(),
  joy: { x: 0, y: 0 }, // mobile joystick
  dragYaw: 0, // accumulated drag-look delta, consumed by the controller
  wheel: 0, // wheel impulse
  hover: null as string | null,
  gazeProgress: 0,
  swarmLeft: 0,
  near: null as string | null, // nearest wonder id in range
  landmark: null as string | null,
};

export const distTo = (x: number, z: number) => Math.hypot(live.x - x, live.z - z);

/* ───────── reactive quest state ───────── */
type Tone = "story" | "riddle" | "hint" | "wall";
type Quest = {
  phase: "gate" | "walk";
  sound: boolean;
  golden: boolean;
  found: string[];
  card: string | null;
  narr: { id: number; text: string; tone: Tone };
  say: (text: string, tone?: Tone) => void;
  enter: (sound: boolean) => void;
  setSound: (v: boolean) => void;
  setGolden: () => void;
  catchWonder: (id: string) => void;
  closeCard: () => void;
};

export const useQuest = create<Quest>((set, get) => ({
  phase: "gate",
  sound: false,
  golden: false,
  found: [],
  card: null,
  narr: { id: 0, text: "", tone: "story" },
  say: (text, tone = "story") => set({ narr: { id: get().narr.id + 1, text, tone } }),
  enter: (sound) => set({ phase: "walk", sound }),
  setSound: (sound) => set({ sound }),
  setGolden: () => set({ golden: true }),
  catchWonder: (id) => {
    if (get().found.includes(id)) return;
    set({ found: [...get().found, id], card: id });
  },
  closeCard: () => set({ card: null }),
}));

/* ───────── inspect mode: a caught wonder in your hands ───────── */
export const inspect = {
  rx: 0, // rotation driven by the mouse
  ry: 0,
  amount: 0, // 0..1, drives depth of field / vignette
  release: () => {},
  want: () => {},
};
