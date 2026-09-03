import { useState, useRef, useEffect } from "react";
import RulesModal from "./RulesModal";
import DemoWalletModal from "./DemoWalletModal";
import cardBg from "../assets/btn-bg.png";
import "../App.css";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  animate,
} from "framer-motion";

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

interface GyreRouletteProps {
  onZeroWin?: () => void;
  onModalToggle?: (isOpen: boolean) => void;
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

export default function GyreRoulette({
  onZeroWin,
  onModalToggle,
}: GyreRouletteProps) {
  const [balance, setBalance] = useState<number>(2000.0);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isWalletOpen, setIsWalletOpen] = useState<boolean>(false);

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
  const [betAmount, setBetAmount] = useState<string>("0.00");

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

  // Ilmoitetaan yläkomponentille aina, kun modalin aukiolotila muuttuu
  useEffect(() => {
    onModalToggle?.(isRulesOpen || isWalletOpen);
  }, [isRulesOpen, isWalletOpen, onModalToggle]);

  useEffect(() => {
    const rolling = new Audio("/sounds/rolling.wav");
    const done = new Audio("/sounds/done.wav");

    rolling.volume = 0.5;

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

          <button
            type="button"
            onClick={() => setIsWalletOpen(true)}
            className="group flex items-center gap-3 bg-[#F0E8DC] hover:bg-[#EAE0D0] px-4 py-2.5 rounded-2xl border border-[#E2D6C3] shadow-inner transition-colors cursor-pointer active:scale-[0.98]"
          >
            <div>
              <div className="text-[10px] uppercase font-semibold tracking-wider text-right text-[#8C827A]">
                Balance
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-[#2D2621]">
                <AnimatedBalance value={balance} />
              </div>
            </div>

            <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] flex items-center justify-center border border-[#E2D6C3] shadow-sm text-amber-700 group-hover:scale-105 transition-transform pointer-events-none">
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
          </button>
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
        <div className="rounded-2xl p-2.5 sm:p-3 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 border border-[#E5DAC8] bg-[#F4EFE6]">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold px-1 text-[#8C827A]">
              Bet Amount
            </div>
            <button
              onClick={clearBet}
              className="text-xs font-semibold text-[#8C827A] hover:text-[#2D2621] px-2 py-1 rounded-lg hover:bg-[#E2D6C3]/40 transition-colors sm:hidden"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center flex-1 rounded-xl px-3 bg-[#FAF6F0] border border-[#E2D6C3] shadow-inner justify-between">
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

            <button
              onClick={clearBet}
              className="text-xs font-semibold text-[#8C827A] hover:text-[#2D2621] px-2 py-1 rounded-lg hover:bg-[#E2D6C3]/40 transition-colors hidden sm:block"
            >
              Clear
            </button>
          </div>

          {/* Pienellä ruudulla 4 sarakkeen tasainen ruudukko, suuremmalla joustava rivi */}
          <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-1.5">
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
                className={`gyre-btn px-2 py-2 sm:px-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 shadow-sm text-center ${
                  btn.label === "MAX" ? "col-span-2 sm:col-span-1" : ""
                }`}
                onClick={btn.action}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Wager Cards */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-4 mb-8">
          {/* 1. RED CARD (1–7) */}
          {(() => {
            const outcome = outcomes.find((o) => o.color === "red");
            const isWinner = outcome?.kind === "win";
            const isLoser = outcome?.kind === "loss";
            const parsedBetInput = Number.parseFloat(betAmount);
            const validBetAmount =
              Number.isFinite(parsedBetInput) && parsedBetInput > 0
                ? parsedBetInput
                : 0;

            return (
              <div
                style={{ backgroundImage: `url(${cardBg})` }}
                className={`relative overflow-hidden w-full rounded-xl sm:rounded-2xl p-2 sm:p-5 bg-cover bg-center border border-[#d4af37]/40 shadow-xl flex flex-col justify-between ${
                  flash.panel === "red"
                    ? flash.kind === "win"
                      ? "flash-win"
                      : "flash-error"
                    : ""
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-red-400/10 via-white/40 to-red-500/30 pointer-events-none" />

                <div className="relative z-10 flex flex-col h-full justify-between space-y-2 sm:space-y-4">
                  <div>
                    <div className="text-red-500 font-bold text-[9px] sm:text-xs tracking-wider uppercase truncate">
                      Red (1–7)
                    </div>
                    <div className="text-xl sm:text-4xl font-serif font-bold bg-gradient-to-b from-[#e6af26] via-[#ac7f0e] to-[#6d4c00] bg-clip-text text-transparent tracking-tight">
                      {PAYOUT.red.toFixed(2)}
                      <span className="text-sm sm:text-2xl font-normal text-[#d4af37]">
                        ×
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center px-1 sm:px-4 py-1 sm:py-3 rounded-lg sm:rounded-xl bg-white/80 border border-[#E2D6C3] text-[#2D2621] font-mono text-xs sm:text-base shadow-inner min-h-[32px] sm:min-h-[48px]">
                    {isWinner && (
                      <span className="text-[10px] sm:text-xs font-bold px-1 py-0.5 rounded animate-pulse bg-emerald-500/20 text-emerald-700 border border-emerald-500/30">
                        +{fmt(outcome.amount)}
                      </span>
                    )}
                    {isLoser && (
                      <span className="text-[10px] sm:text-xs font-bold px-1 py-0.5 rounded bg-red-500/20 text-red-700 border border-red-500/30">
                        -{fmt(outcome.amount)}
                      </span>
                    )}
                    {!isWinner && !isLoser && (
                      <span className="text-[#2D2621] font-bold text-[11px] sm:text-base truncate">
                        {fmt(wagers.red || 0)}
                      </span>
                    )}
                  </div>

                  <button
                    disabled={spinning || validBetAmount <= 0}
                    onClick={() => placeBet("red")}
                    className="w-full py-2 sm:py-3.5 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-sm text-stone-100 bg-red-900/80 hover:bg-red-800/90 active:scale-[0.98] transition-all shadow-lg border border-[#f3e5ab]/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer leading-tight"
                  >
                    Bet Red
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 2. GREEN CARD (0) */}
          {(() => {
            const outcome = outcomes.find((o) => o.color === "green");
            const isWinner = outcome?.kind === "win";
            const isLoser = outcome?.kind === "loss";
            const parsedBetInput = Number.parseFloat(betAmount);
            const validBetAmount =
              Number.isFinite(parsedBetInput) && parsedBetInput > 0
                ? parsedBetInput
                : 0;

            return (
              <div
                style={{ backgroundImage: `url(${cardBg})` }}
                className={`relative overflow-hidden w-full rounded-xl sm:rounded-2xl p-2 sm:p-5 bg-cover bg-center border border-[#d4af37]/40 shadow-xl flex flex-col justify-between ${
                  flash.panel === "green"
                    ? flash.kind === "win"
                      ? "flash-win"
                      : "flash-error"
                    : ""
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-400/10 via-white/40 to-emerald-500/30 pointer-events-none" />

                <div className="relative z-10 flex flex-col h-full justify-between space-y-2 sm:space-y-4">
                  <div>
                    <div className="text-emerald-500 font-bold text-[9px] sm:text-xs tracking-wider uppercase truncate">
                      Green (0)
                    </div>
                    <div className="text-xl sm:text-4xl font-serif font-bold bg-gradient-to-b from-[#e6af26] via-[#ac7f0e] to-[#6d4c00] bg-clip-text text-transparent tracking-tight">
                      {PAYOUT.green.toFixed(2)}
                      <span className="text-sm sm:text-2xl font-normal text-[#d4af37]">
                        ×
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center px-1 sm:px-4 py-1 sm:py-3 rounded-lg sm:rounded-xl bg-white/80 border border-[#E2D6C3] text-[#2D2621] font-mono text-xs sm:text-base shadow-inner min-h-[32px] sm:min-h-[48px]">
                    {isWinner && (
                      <span className="text-[10px] sm:text-xs font-bold px-1 py-0.5 rounded animate-pulse bg-emerald-500/20 text-emerald-700 border border-emerald-500/30">
                        +{fmt(outcome.amount)}
                      </span>
                    )}
                    {isLoser && (
                      <span className="text-[10px] sm:text-xs font-bold px-1 py-0.5 rounded bg-red-500/20 text-red-700 border border-red-500/30">
                        -{fmt(outcome.amount)}
                      </span>
                    )}
                    {!isWinner && !isLoser && (
                      <span className="text-[#2D2621] font-bold text-[11px] sm:text-base truncate">
                        {fmt(wagers.green || 0)}
                      </span>
                    )}
                  </div>

                  <button
                    disabled={spinning || validBetAmount <= 0}
                    onClick={() => placeBet("green")}
                    className="w-full py-2 sm:py-3.5 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-sm text-stone-100 bg-emerald-900/80 hover:bg-emerald-800/90 active:scale-[0.98] transition-all shadow-lg border border-[#f3e5ab]/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer leading-tight"
                  >
                    Bet Green
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 3. BLACK CARD (8–14) */}
          {(() => {
            const outcome = outcomes.find((o) => o.color === "black");
            const isWinner = outcome?.kind === "win";
            const isLoser = outcome?.kind === "loss";
            const parsedBetInput = Number.parseFloat(betAmount);
            const validBetAmount =
              Number.isFinite(parsedBetInput) && parsedBetInput > 0
                ? parsedBetInput
                : 0;

            return (
              <div
                style={{ backgroundImage: `url(${cardBg})` }}
                className={`relative overflow-hidden w-full rounded-xl sm:rounded-2xl p-2 sm:p-5 bg-cover bg-center border border-[#d4af37]/40 shadow-xl flex flex-col justify-between ${
                  flash.panel === "black"
                    ? flash.kind === "win"
                      ? "flash-win"
                      : "flash-error"
                    : ""
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-stone-400/10 via-white/20 to-black/30 pointer-events-none" />

                <div className="relative z-10 flex flex-col h-full justify-between space-y-2 sm:space-y-4">
                  <div>
                    <div className="text-stone-500 font-bold text-[9px] sm:text-xs tracking-wider uppercase truncate">
                      Black (8–14)
                    </div>
                    <div className="text-xl sm:text-4xl font-serif font-bold bg-gradient-to-b from-[#e6af26] via-[#ac7f0e] to-[#6d4c00] bg-clip-text text-transparent tracking-tight">
                      {PAYOUT.black.toFixed(2)}
                      <span className="text-sm sm:text-2xl font-normal text-[#d4af37]">
                        ×
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center px-1 sm:px-4 py-1 sm:py-3 rounded-lg sm:rounded-xl bg-white/80 border border-[#E2D6C3] text-[#2D2621] font-mono text-xs sm:text-base shadow-inner min-h-[32px] sm:min-h-[48px]">
                    {isWinner && (
                      <span className="text-[10px] sm:text-xs font-bold px-1 py-0.5 rounded animate-pulse bg-emerald-500/20 text-emerald-700 border border-emerald-500/30">
                        +{fmt(outcome.amount)}
                      </span>
                    )}
                    {isLoser && (
                      <span className="text-[10px] sm:text-xs font-bold px-1 py-0.5 rounded bg-red-500/20 text-red-700 border border-red-500/30">
                        -{fmt(outcome.amount)}
                      </span>
                    )}
                    {!isWinner && !isLoser && (
                      <span className="text-[#2D2621] font-bold text-[11px] sm:text-base truncate">
                        {fmt(wagers.black || 0)}
                      </span>
                    )}
                  </div>

                  <button
                    disabled={spinning || validBetAmount <= 0}
                    onClick={() => placeBet("black")}
                    className="w-full py-2 sm:py-3.5 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-sm text-stone-100 bg-stone-900/80 hover:bg-stone-800/90 active:scale-[0.98] transition-all shadow-lg border border-[#f3e5ab]/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer leading-tight"
                  >
                    Bet Black
                  </button>
                </div>
              </div>
            );
          })()}
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

          <button
            onClick={() => setIsWalletOpen(true)}
            className="flex items-center gap-2 text-left p-2 rounded-xl hover:bg-[#EFE8DC]/60 transition-colors group cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-[#EFE8DC] text-amber-800 group-hover:bg-amber-100 transition-colors">
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
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-stone-800 group-hover:text-amber-800 transition-colors">
                Disclaimer
              </div>
              <div className="text-[10px] text-stone-500">
                For Entertainment Only
              </div>
            </div>
          </button>

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
              <div className="font-bold text-stone-800">Provably Random</div>
              <div className="text-[10px] text-stone-500">
                Unbiased CSPRNG Engine
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsRulesOpen(true)}
            className="flex items-center gap-2 text-left p-2 rounded-xl hover:bg-[#EFE8DC]/60 transition-colors group cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-[#EFE8DC] text-amber-800 group-hover:bg-amber-100 transition-colors">
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
              <div className="font-bold text-stone-800 group-hover:text-amber-800 transition-colors">
                How It Works
              </div>
              <div className="text-[10px] text-stone-500">Learn the rules</div>
            </div>
          </button>
        </div>
      </div>

      <p className="text-[11px] mt-4 text-center text-stone-500">
        Gyre is a simulated entertainment application using non-monetary demo
        credits. No real money gambling or rewards are offered.
      </p>

      {/* Modals */}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
      <DemoWalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
      />
    </div>
  );
}
