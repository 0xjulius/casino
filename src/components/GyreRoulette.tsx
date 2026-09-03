import { useState, useRef, useEffect } from "react";
import "../App.css";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";

type Color = "red" | "green" | "black";

interface Wagers {
  red: number;
  green: number;
  black: number;
}

interface FlashState {
  panel: Color | null;
  kind: "win" | "error" | null;
}

interface OutcomeState {
  color: Color;
  kind: "win" | "loss";
  amount: number;
}

interface BetOption {
  key: Color;
  label: string;
  mult: number;
  odds: string;
  btnGradient: string;
  btnHoverGlow: string;
  labelColor: string;
  bgLight: string;
  borderColor: string;
}

interface GyreRouletteProps {
  onZeroWin?: () => void;
}

const SLOT_COUNT = 15;

const PAYOUT: Record<Color, number> = {
  red: 2,
  green: 14,
  black: 2,
};

const ROUND_SECONDS = 15;
const ANIM_MS = 4200;
const TOTAL_TILES = 70;
const TARGET_INDEX = 58;

const TILE_WIDTH = 84;
const TILE_GAP = 10;
const FULL_TILE_SPAN = TILE_WIDTH + TILE_GAP;

const BASE_SEQUENCE = [1, 8, 2, 9, 3, 10, 4, 0, 11, 5, 12, 6, 13, 7, 14];

function AnimatedBalance({ value }: { value: number }) {
  const count = useMotionValue(value);
  const [displayValue, setDisplayValue] = useState("$" + value.toFixed(2));

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (latest) => {
        setDisplayValue("$" + latest.toFixed(2));
      },
    });

    return () => controls.stop();
  }, [value, count]);

  return <span>{displayValue}</span>;
}

const playBetSound = () => {
  const audio = new Audio("/sounds/bet.wav");
  audio.play().catch((err) => console.error("Audio playback error:", err));
};

function colorOf(n: number): Color {
  if (n === 0) return "green";
  if (n >= 1 && n <= 7) return "red";
  if (n >= 8 && n <= 14) return "black";
  throw new Error(`Invalid roulette result: ${n}`);
}

function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error("maxExclusive must be a positive integer");
  }

  const MAX_UINT32 = 0x100000000;
  const limit = MAX_UINT32 - (MAX_UINT32 % maxExclusive);
  const arr = new Uint32Array(1);

  do {
    crypto.getRandomValues(arr);
  } while (arr[0] >= limit);

  return arr[0] % maxExclusive;
}

function randomSlot(): number {
  return secureRandomInt(SLOT_COUNT);
}

function buildNumbers(result: number): number[] {
  if (result < 0 || result >= SLOT_COUNT) {
    throw new Error(`Invalid roulette result: ${result}`);
  }

  const targetOffset = BASE_SEQUENCE.indexOf(result);

  if (targetOffset === -1) {
    throw new Error(`Result ${result} does not exist in BASE_SEQUENCE`);
  }

  const nums: number[] = new Array(TOTAL_TILES);

  for (let i = 0; i < TOTAL_TILES; i++) {
    const distanceFromTarget = i - TARGET_INDEX;
    let seqIdx = (targetOffset + distanceFromTarget) % BASE_SEQUENCE.length;

    if (seqIdx < 0) {
      seqIdx += BASE_SEQUENCE.length;
    }

    nums[i] = BASE_SEQUENCE[seqIdx];
  }

  return nums;
}

function getTileClasses(n: number): string {
  const c = colorOf(n);

  if (c === "red") {
    return "bg-gradient-to-b from-[#FF7B7B] to-[#F85555] text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.1)]";
  }

  if (c === "green") {
    return "bg-gradient-to-b from-[#4E946A] to-[#3B7A57] text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.1)]";
  }

  return "bg-gradient-to-b from-[#332E2B] to-[#1A1715] text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.2),0_2px_4px_rgba(0,0,0,0.15)]";
}

function fmt(n: number): string {
  return "$" + n.toFixed(2);
}

export default function GyreRoulette({ onZeroWin }: GyreRouletteProps) {
  const [balance, setBalance] = useState<number>(2000.0);

  const [wagers, setWagers] = useState<Wagers>({
    red: 0,
    green: 0,
    black: 0,
  });

  const [history, setHistory] = useState<number[]>(() => [
    2, 4, 11, 11, 11, 9, 11, 12, 14, 11, 5, 6, 5, 14, 10,
  ]);

  const [numbers, setNumbers] = useState<number[]>(() => buildNumbers(1));
  const [secondsLeft, setSecondsLeft] = useState<number>(11);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [resultText, setResultText] = useState<string>("");
  const [betAmount, setBetAmount] = useState<string>("1.00");

  const [outcomes, setOutcomes] = useState<OutcomeState[]>([]);

  const [flash, setFlash] = useState<FlashState>({
    panel: null,
    kind: null,
  });

  const stripRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef<boolean>(false);

  const spinningRef = useRef<boolean>(false);
  const wagersRef = useRef<Wagers>(wagers);

  const triggerSpinRef = useRef<() => void>(() => {});
  const repositionRef = useRef<() => void>(() => {});

  const rollingAudioRef = useRef<HTMLAudioElement | null>(null);
  const doneAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const rolling = new Audio("/sounds/rolling.wav");
    const done = new Audio("/sounds/done.wav");

    rolling.preload = "auto";
    done.preload = "auto";

    rollingAudioRef.current = rolling;
    doneAudioRef.current = done;

    return () => {
      rolling.pause();
      done.pause();
      rollingAudioRef.current = null;
      doneAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    spinningRef.current = spinning;
    wagersRef.current = wagers;

    triggerSpinRef.current = triggerSpin;
    repositionRef.current = () => reposition(false);
  });

  useEffect(() => {
    if (outcomes.length === 0) return;

    const timer = window.setTimeout(() => {
      setOutcomes([]);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [outcomes]);

  function playRollingSound() {
    if (rollingAudioRef.current) {
      rollingAudioRef.current.currentTime = 0;
      rollingAudioRef.current.play().catch(() => {});
    }
  }

  function playDoneSound() {
    if (rollingAudioRef.current) {
      rollingAudioRef.current.pause();
    }
    if (doneAudioRef.current) {
      doneAudioRef.current.currentTime = 0;
      doneAudioRef.current.play().catch(() => {});
    }
  }

  function placeBet(color: Color) {
    if (spinningRef.current) return;

    const amount = Number.parseFloat(betAmount);

    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) {
      setFlash({
        panel: color,
        kind: "error",
      });
      return;
    }

    playBetSound();

    setBalance((b) => b - amount);

    setWagers((prev) => {
      const nextWagers: Wagers = {
        ...prev,
        [color]: prev[color] + amount,
      };

      wagersRef.current = nextWagers;
      return nextWagers;
    });
  }

  function scaleBet(mult: number) {
    const current = Number.parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.01, current * mult).toFixed(2));
  }

  function addBet(amount: number) {
    const current = Number.parseFloat(betAmount) || 0;
    setBetAmount((current + amount).toFixed(2));
  }

  function clearBet() {
    setBetAmount("0.00");
  }

  function maxBet() {
    setBetAmount(balance.toFixed(2));
  }

  function triggerSpin() {
    if (spinningRef.current) return;

    playRollingSound();

    setSpinning(true);
    spinningRef.current = true;
    setResultText("");
    setOutcomes([]);

    const result = randomSlot();
    setNumbers(buildNumbers(result));

    window.setTimeout(() => {
      settleRound(result);
    }, ANIM_MS);
  }

  function settleRound(result: number) {
    playDoneSound();

    if (result === 0) {
      onZeroWin?.();
    }

    const winningColor = colorOf(result);
    const currentWagers: Wagers = { ...wagersRef.current };
    const winningBet = currentWagers[winningColor] || 0;
    const totalStaked =
      currentWagers.red + currentWagers.green + currentWagers.black;

    const payout = winningBet > 0 ? winningBet * PAYOUT[winningColor] : 0;
    const newOutcomes: OutcomeState[] = [];

    (Object.keys(currentWagers) as Color[]).forEach((col) => {
      const bet = currentWagers[col];
      if (bet > 0) {
        if (col === winningColor) {
          newOutcomes.push({
            color: col,
            kind: "win",
            amount: bet * PAYOUT[col],
          });
        } else {
          newOutcomes.push({ color: col, kind: "loss", amount: bet });
        }
      }
    });

    setOutcomes(newOutcomes);

    if (payout > 0) {
      setBalance((b) => b + payout);
      setFlash({
        panel: winningColor,
        kind: "win",
      });
    }

    setHistory((h) => [...h, result].slice(-15));

    if (totalStaked > 0) {
      if (payout > 0) {
        setResultText(
          `Landed on ${result} (${winningColor}) · won ${fmt(payout)}`,
        );
      } else {
        setResultText(
          `Landed on ${result} (${winningColor}) · lost ${fmt(totalStaked)}`,
        );
      }
    } else {
      setResultText(`Landed on ${result} (${winningColor})`);
    }

    const resetWagers: Wagers = {
      red: 0,
      green: 0,
      black: 0,
    };

    wagersRef.current = resetWagers;
    setWagers(resetWagers);

    setSpinning(false);
    spinningRef.current = false;
    setSecondsLeft(ROUND_SECONDS);
  }

  function reposition(withTransition: boolean) {
    const strip = stripRef.current;
    const viewport = viewportRef.current;

    if (!strip || !viewport) return;

    const viewportWidth = viewport.clientWidth;
    const targetOffset =
      -(TARGET_INDEX * FULL_TILE_SPAN) + (viewportWidth / 2 - TILE_WIDTH / 2);

    strip.style.transition = withTransition
      ? "transform 4.2s cubic-bezier(0.11,0.66,0.15,1)"
      : "none";
    strip.style.transform = `translateX(${targetOffset}px)`;
  }

  useEffect(() => {
    const id = window.setInterval(() => {
      if (spinningRef.current) return;

      setSecondsLeft((prev) => {
        if (prev <= 1) {
          triggerSpinRef.current();
          return ROUND_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (!spinningRef.current) {
        repositionRef.current();
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    if (!mountedRef.current) {
      reposition(false);
      mountedRef.current = true;
      return;
    }

    strip.style.transition = "none";
    strip.style.transform = "translateX(0px)";
    void strip.offsetWidth;

    requestAnimationFrame(() => {
      reposition(true);
    });
  }, [numbers]);

  useEffect(() => {
    if (!flash.panel) return;

    const id = window.setTimeout(() => {
      setFlash({
        panel: null,
        kind: null,
      });
    }, 550);

    return () => window.clearTimeout(id);
  }, [flash]);

  const betOptions: BetOption[] = [
    {
      key: "red",
      label: "Red (1–7)",
      mult: PAYOUT.red,
      odds: "7 of 15 slots",
      btnGradient: "bg-gradient-to-b from-[#F25C6A] to-[#E03A4A]",
      btnHoverGlow: "hover:shadow-[0_0_22px_rgba(226,58,74,0.45)]",
      labelColor: "text-[#C41E2E]",
      bgLight: "bg-[#FBE9EB]",
      borderColor: "border-[#F0C4C9]",
    },
    {
      key: "green",
      label: "Green (0)",
      mult: PAYOUT.green,
      odds: "1 of 15 slots",
      btnGradient: "bg-gradient-to-b from-[#3EC987] to-[#2BA86A]",
      btnHoverGlow: "hover:shadow-[0_0_20px_rgba(43,168,106,0.4)]",
      labelColor: "text-[#1A7A4C]",
      bgLight: "bg-[#E6F6EE]",
      borderColor: "border-[#BFE5D1]",
    },
    {
      key: "black",
      label: "Black (8–14)",
      mult: PAYOUT.black,
      odds: "7 of 15 slots",
      btnGradient: "bg-gradient-to-b from-[#3F424C] to-[#2C2E36]",
      btnHoverGlow: "hover:shadow-[0_0_18px_rgba(44,46,54,0.35)]",
      labelColor: "text-[#1F2128]",
      bgLight: "bg-[#E8E8EA]",
      borderColor: "border-[#C9C9CE]",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-2 antialiased text-[#2D2621] font-sans">
      {/* Main Outer Container Card */}
      <div className="relative rounded-3xl p-3 sm:p-8 border border-[#EADFCF] bg-[#FAF6F0]/20 backdrop-blur shadow-[0_20px_50px_rgba(0,0,0,0.06),inset_0_2px_4px_rgba(255,255,255,0.8)] transition-all">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight flex items-center gap-2 text-[#2D2621]">
              Gyre
              <span className="text-amber-500 text-xl font-normal">✦</span>
            </h1>
            <p className="text-xs sm:text-sm mt-1 text-[#8C827A]">
              A fifteen-slot wheel. One long shot, two even ones.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[#F0E8DC] px-4 py-2.5 rounded-2xl border border-[#E2D6C3] shadow-inner">
            <div>
              <div className="text-[10px] uppercase font-semibold tracking-wider text-right text-[#8C827A]">
                Balance
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-[#2D2621]">
                <AnimatedBalance value={balance} />
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] flex items-center justify-center border border-[#E2D6C3] shadow-sm text-amber-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-3" />
              </svg>
            </div>
          </div>
        </div>

        {/* History Strip */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 px-1.5 flex-row-reverse justify-end -ml-1.5">
            <AnimatePresence initial={false}>
              {history.map((n, index) => {
                const c = colorOf(n);
                const isLatest = index === history.length - 1;

                const bgClass =
                  c === "red"
                    ? "bg-[#E64A53]"
                    : c === "green"
                      ? "bg-[#3B7A57]"
                      : "bg-[#24201D]";

                const tileContent = (
                  <div
                    className={`tile-number flex items-center justify-center flex-none rounded-md font-semibold text-xs shadow-sm relative w-[26px] h-[26px] text-white ${bgClass} ${
                      isLatest
                        ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-[#FAF6F0]"
                        : ""
                    }`}
                  >
                    {n}
                  </div>
                );

                if (isLatest) {
                  return (
                    <motion.div
                      key={`${n}-${index}`}
                      initial={{ opacity: 0, scale: 0.2 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                      }}
                    >
                      {tileContent}
                    </motion.div>
                  );
                }

                return <div key={`${n}-${index}`}>{tileContent}</div>;
              })}
            </AnimatePresence>
          </div>
          <span className="text-xs font-semibold text-stone-400 flex items-center gap-1 pl-2 flex-none">
            Last {history.length}
          </span>
        </div>

        {/* Status & Timer Label */}
        <div className="flex items-center justify-between mb-2 text-xs sm:text-sm">
          <span className="text-[#8C827A]">
            {spinning ? (
              "Spinning…"
            ) : (
              <>
                Place your bets — next spin in{" "}
                <span className="font-bold text-stone-800">{secondsLeft}s</span>
              </>
            )}
          </span>

          <span className="font-semibold text-amber-700 text-xs">
            {resultText}
          </span>
        </div>

        {/* Progress Bar (Timer indicator) */}
        <div className="rounded-full overflow-hidden mb-4 h-[4px] bg-[#EFE8DC]">
          <div
            className="h-full bg-[#D4AF37] w-full origin-left transition-transform duration-1000 ease-linear"
            style={{
              transform: `scaleX(${Math.max(secondsLeft, 0) / ROUND_SECONDS})`,
            }}
          />
        </div>

        {/* Carousel Wheel Viewport */}
        <div className="relative rounded-2xl mb-6 overflow-hidden border border-[#E2D6C3] p-2 h-[108px] bg-[#EFE8DC] shadow-[inset_0_2px_6px_rgba(0,0,0,0.05)]">
          <div className="absolute top-0 left-0 right-0 h-full pointer-events-none bg-gradient-to-r from-[#EFE8DC] via-transparent via-10% to-[#EFE8DC] [background-image:linear-gradient(to_right,#EFE8DC_0%,transparent_25%,transparent_75%,#EFE8DC_100%)] z-10" />

          <div className="gold-arrow" />

          <div
            ref={viewportRef}
            className="h-full flex items-center overflow-hidden relative"
          >
            <div
              ref={stripRef}
              className="flex items-center py-2 will-change-transform"
            >
              {numbers.map((n, i) => {
                const isTarget = i === TARGET_INDEX && !spinning;

                if (isTarget) {
                  return (
                    <div
                      key={`${n}-${i}`}
                      className="flex-none transition-transform scale-105 z-20 w-[84px] h-[76px] mx-[5px]"
                    >
                      <div className="gold-frame h-full w-full">
                        <div className="gold-frame-inner">
                          <div
                            className={`tile-number flex items-center justify-center h-full w-full text-2xl font-bold rounded-lg ${getTileClasses(
                              n,
                            )}`}
                          >
                            {n}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={`${n}-${i}`}
                    className={`tile-number flex items-center justify-center flex-none text-2xl font-bold rounded-xl transition-all w-[84px] h-[68px] mx-[5px] ${getTileClasses(
                      n,
                    )}`}
                  >
                    {n}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bet Amount Control Bar */}
        <div className="rounded-2xl p-2.5 sm:p-3 mb-6 flex flex-wrap items-center gap-3 border border-[#E5DAC8] bg-[#F4EFE6]">
          <div className="text-xs font-semibold px-2 text-[#8C827A]">
            Bet Amount
          </div>

          {/* Syötekenttä + Clear-nappi samassa boksissa */}
          <div className="flex items-center flex-1 min-w-[160px] rounded-xl px-3 bg-[#FAF6F0] border border-[#E2D6C3] shadow-inner justify-between">
            <div className="flex items-center flex-1 mr-2">
              <span className="text-sm font-semibold mr-1 text-[#8C827A]">
                $
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="gyre-num bg-transparent outline-none py-2 w-full text-base font-bold font-mono text-[#2D2621]"
              />
            </div>

            {/* Clear-painike boksin sisällä oikeassa reunassa */}
            <button
              onClick={clearBet}
              className="text-xs font-semibold text-[#8C827A] hover:text-[#2D2621] px-2 py-1 rounded-lg hover:bg-[#E2D6C3]/40 transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Pikanapit ilman Clear-nappia */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "+1", action: () => addBet(1) },
              { label: "+5", action: () => addBet(5) },
              { label: "+10", action: () => addBet(10) },
              { label: "+100", action: () => addBet(100) },
              { label: "1/2", action: () => scaleBet(0.5) },
              { label: "X2", action: () => scaleBet(2) },
              { label: "MAX", action: maxBet },
            ].map((btn) => (
              <button
                key={btn.label}
                className="gyre-btn px-2.5 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 shadow-sm"
                onClick={btn.action}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Wager Panels (Always 3 columns, fully responsive) */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-4 mb-8">
          {betOptions.map((p) => {
            const currentWager = wagers[p.key];
            const outcome = outcomes.find((o) => o.color === p.key);

            const isWinner = outcome?.kind === "win";
            const isLoser = outcome?.kind === "loss";

            const parsedBetInput = Number.parseFloat(betAmount);
            const validBetAmount =
              Number.isFinite(parsedBetInput) && parsedBetInput > 0
                ? parsedBetInput
                : 0;

            return (
              <div
                key={p.key}
                className={`relative rounded-xl sm:rounded-2xl p-2 sm:p-4 flex flex-col justify-between border transition-all shadow-sm ${
                  p.bgLight
                } ${p.borderColor} ${
                  flash.panel === p.key
                    ? flash.kind === "win"
                      ? "flash-win"
                      : "flash-error"
                    : ""
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                    <span
                      className={`font-semibold sm:font-bold text-[10px] sm:text-sm uppercase sm:normal-case tracking-wider sm:tracking-normal ${p.labelColor}`}
                    >
                      {p.label}
                    </span>
                  </div>
                  <div className="text-lg sm:text-2xl font-black font font-serif text-[#2D2621] flex items-baseline gap-0.5">
                    <span>{p.mult.toFixed(2)}</span>
                    <span className="text-base sm:text-2xl font-bold text-[#2D2621]/80">
                      ×
                    </span>
                  </div>
                </div>

                <div className="mt-2 sm:mt-4">
                  {/* Total Wager Display Box */}
                  <div
                    className={`rounded-lg sm:rounded-xl px-1.5 py-1 sm:px-3.5 sm:py-2.5 mb-2 sm:mb-3 flex items-center justify-between border bg-white/80 shadow-inner ${p.borderColor}`}
                  >
                    <span className="uppercase text-[9px] sm:text-[10px] font-bold tracking-wider hidden text-[#8C827A] md:inline">
                      BET <span className="hidden lg:inline">AMOUNT</span>
                    </span>


                    <div className="flex items-center gap-1 sm:gap-2">
                      {isWinner && (
                        <span className="text-[10px] sm:text-xs font-bold px-1 sm:px-2 py-0.5 rounded-md transition-all animate-pulse bg-[#D4AF37]/15 text-[#997300] border border-[#D4AF37]">
                          +{fmt(outcome.amount)}
                        </span>
                      )}

                      {isLoser && (
                        <span className="text-[10px] sm:text-xs font-bold px-1 sm:px-2 py-0.5 rounded-md transition-all opacity-80 bg-[#E64A53]/15 text-[#C93B3B] border border-[#F7D8D8]">
                          -{fmt(outcome.amount)}
                        </span>
                      )}

                      {!isWinner && !isLoser && (
                        <span className="font-mono text-xs sm:text-lg font-extrabold text-[#2D2621]">
                          {fmt(currentWager || 0)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Main Action Button */}
                  <button
                    className={`w-full py-2 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-xs font-bold text-white transition-all duration-200 active:scale-95 flex items-center justify-center capitalize disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer hover:brightness-110 ${p.btnGradient} ${p.btnHoverGlow}`}
                    disabled={spinning || validBetAmount <= 0}
                    onClick={() => placeBet(p.key)}
                  >
                    Bet {p.key}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Feature Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#E5DAC8] text-xs">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#EFE8DC] text-amber-800">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="12" height="12" x="2" y="10" rx="2" />
                <path d="m17.92 14 3.58-3.58a2 2 0 0 0 0-2.83l-3.58-3.58a2 2 0 0 0-2.83 0L11.5 7.59" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-stone-800">15 Slots</div>
              <div className="text-[10px] text-stone-500">Numbers 0–14</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#EFE8DC] text-amber-800">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="8" cy="8" r="6" />
                <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
                <path d="M7 6h1v4" />
                <path d="m16.71 13.88.7.71-2.82 2.82" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-stone-800">Payouts</div>
              <div className="text-[10px] text-stone-500">
                Red 2x, Green 14x, Black 2x
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#EFE8DC] text-amber-800">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-stone-800">Fair Play</div>
              <div className="text-[10px] text-stone-500">
                Provably fair results
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#EFE8DC] text-amber-800">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-stone-800">How It Works</div>
              <div className="text-[10px] text-stone-500">Learn the rules</div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] mt-4 text-center text-stone-500">
        Each spin lands on 0–14. Zero pays green, 1–7 pay red, and 8–14 pay
        black. Simulated currency only — nothing here is real money.
      </p>
    </div>
  );
}