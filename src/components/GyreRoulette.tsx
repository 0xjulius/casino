import { useState, useRef, useEffect, type CSSProperties } from "react";

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
  buttonBg: string;
  buttonHoverBg: string;
  glowColor: string;
  labelColor: string;
  bgLight: string;
  borderColor: string;
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

const TILE_WIDTH = 90;
const TILE_GAP = 12;
const FULL_TILE_SPAN = TILE_WIDTH + TILE_GAP;

const BASE_SEQUENCE = [1, 8, 2, 9, 3, 10, 4, 0, 11, 5, 12, 6, 13, 7, 14];

const PALETTE = {
  bg: "#FAF7F2",
  panel: "#FFFFFF",
  panel2: "#F6F3EE",
  line: "#EFECE6",
  ink: "#2B2825",
  inkDim: "#8C867E",
  gold: "#D3A154",
  red: "#F18F8E",
  redDim: "#FFF0F0",
  green: "#63A87B",
  greenDim: "#F1F8F3",
  black: "#2B2825", // Dark charcoal for high contrast
  blackDim: "#F3F4F6",
} as const;

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

function tileStyle(n: number): CSSProperties {
  const c = colorOf(n);

  if (c === "red") {
    return {
      background: "#F18F8E",
      color: "#FFFFFF",
      boxShadow: "0 2px 6px rgba(241, 143, 142, 0.25)",
    };
  }

  if (c === "green") {
    return {
      background: "#63A87B",
      color: "#FFFFFF",
      boxShadow: "0 2px 6px rgba(99, 168, 123, 0.25)",
    };
  }

  return {
    background: PALETTE.black,
    color: "#FFFFFF",
    boxShadow: "0 2px 6px rgba(43, 40, 37, 0.25)",
  };
}

function fmt(n: number): string {
  return "$" + n.toFixed(2);
}

export default function GyreRoulette() {
  const [balance, setBalance] = useState<number>(96);

  const [wagers, setWagers] = useState<Wagers>({
    red: 0,
    green: 0,
    black: 0,
  });

  const [history, setHistory] = useState<number[]>(() => [
    9, 4, 4, 4, 9, 1, 13, 8, 3,
  ]);

  const [numbers, setNumbers] = useState<number[]>(() => buildNumbers(9));
  const [secondsLeft, setSecondsLeft] = useState<number>(14);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [resultText, setResultText] = useState<string>(
    "Landed on 9 (black) · lost $4.00",
  );
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

    setHistory((h) => [...h, result].slice(-16));

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

    return () => window.clearTimeout(id);
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

  const panelBase: CSSProperties = {
    background: PALETTE.panel,
    border: `1px solid ${PALETTE.line}`,
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)",
  };

  const betOptions: BetOption[] = [
    {
      key: "red",
      label: "Red (1–7)",
      mult: PAYOUT.red,
      odds: "7 of 15 slots",
      buttonBg: "#F18F8E",
      buttonHoverBg: "#E87C7B",
      glowColor: "rgba(241, 143, 142, 0.3)",
      labelColor: "#D64242",
      bgLight: "#FFF0F0",
      borderColor: "#FADAD8",
    },
    {
      key: "green",
      label: "Green (0)",
      mult: PAYOUT.green,
      odds: "1 of 15 slots",
      buttonBg: "#63A87B",
      buttonHoverBg: "#529468",
      glowColor: "rgba(99, 168, 123, 0.3)",
      labelColor: "#3B7A51",
      bgLight: "#F1F8F3",
      borderColor: "#D2E8D9",
    },
    {
      key: "black",
      label: "Black (8–14)",
      mult: PAYOUT.black,
      odds: "7 of 15 slots",
      buttonBg: "#2B2825",
      buttonHoverBg: "#1C1A18",
      glowColor: "rgba(43, 40, 37, 0.2)",
      labelColor: "#2B2825",
      bgLight: "#F3F4F6",
      borderColor: "#E2E4E8",
    },
  ];

  return (
    <div
      style={{
        color: PALETTE.ink,
        minHeight: "100vh",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
      className="antialiased"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Oldenburg&display=swap');

        html, body {
          margin: 0;
          padding: 0;
          background: ${PALETTE.bg};
          min-height: 100%;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        .tile-number {
          font-family: 'Oldenburg', serif;
        }

        @keyframes flashWin {
          0% { background-color: rgba(211,161,84,0.2); }
          100% { background-color: transparent; }
        }

        @keyframes flashError {
          0% { background-color: rgba(241,143,142,0.2); }
          100% { background-color: transparent; }
        }

        .flash-win { animation: flashWin 0.55s ease; }
        .flash-error { animation: flashError 0.55s ease; }

        /* In the <style> block: */
        .gyre-btn {
          font-family: 'Plus Jakarta Sans', sans-serif !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .gyre-btn:active:not(:disabled) {
          transform: scale(0.98);
        }

        .gyre-btn:hover:not(:disabled) {
          filter: brightness(0.95);
        }

        .gyre-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .gyre-num::-webkit-outer-spin-button,
        .gyre-num::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .gyre-num { -moz-appearance: textfield; }
      `}</style>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-1">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1
              className="text-3xl sm:text-4xl font-semibold tracking-tight"
              style={{ color: PALETTE.ink }}
            >
              Gyre
            </h1>
            <p
              className="text-sm sm:text-base mt-1"
              style={{ color: PALETTE.inkDim }}
            >
              A fifteen-slot wheel. One long shot, two even ones.
            </p>
          </div>

          <div className="text-right">
            <div
              className="text-xs sm:text-sm mb-1"
              style={{ color: PALETTE.inkDim }}
            >
              Balance
            </div>
            <div
              className="text-2xl sm:text-3xl font-bold"
              style={{ color: PALETTE.ink }}
            >
              {fmt(balance)}
            </div>
          </div>
        </div>

        {/* History Strip (Newest on Left -> Oldest on Right) */}
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
          {[...history].reverse().map((n, i) => {
            const c = colorOf(n);

            return (
              <div
                key={`${n}-${i}`}
                className="tile-number flex items-center justify-center flex-none rounded-lg shadow-sm"
                style={{
                  width: 32,
                  height: 32,
                  fontSize: "1rem",
                  background:
                    c === "red"
                      ? PALETTE.red
                      : c === "green"
                        ? PALETTE.green
                        : PALETTE.black,
                  color: "#FFFFFF",
                }}
              >
                {n}
              </div>
            );
          })}
        </div>

        {/* Timer & Results Text */}
        <div className="flex items-center justify-between mb-2 px-1">
          <span
            className="text-sm sm:text-base"
            style={{ color: PALETTE.inkDim }}
          >
            {spinning ? (
              "Spinning…"
            ) : (
              <>
                Place your bets — next spin in{" "}
                <span className="font-semibold" style={{ color: PALETTE.ink }}>
                  {secondsLeft}s
                </span>
              </>
            )}
          </span>

          <span
            className="text-sm sm:text-base font-semibold"
            style={{ color: PALETTE.gold }}
          >
            {resultText}
          </span>
        </div>

        {/* Progress Bar */}
        <div
          className="rounded-full overflow-hidden mb-6"
          style={{
            height: 5,
            background: PALETTE.line,
          }}
        >
          <div
            style={{
              height: "100%",
              background: PALETTE.gold,
              width: "100%",
              transform: `scaleX(${Math.max(secondsLeft, 0) / ROUND_SECONDS})`,
              transformOrigin: "left",
              transition: "transform 1s linear",
            }}
          />
        </div>

        {/* Carousel Wheel Viewport */}
        <div
          className="relative rounded-2xl mb-4 overflow-hidden"
          style={{
            height: 116,
            background: PALETTE.panel,
            border: `1px solid ${PALETTE.line}`,
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)",
          }}
        >
          {/* Edge Fade Gradients */}
          <div
            className="absolute top-0 left-0 right-0 h-full pointer-events-none"
            style={{
              background: `linear-gradient(90deg, ${PALETTE.panel}, transparent 18%, transparent 82%, ${PALETTE.panel})`,
              zIndex: 5,
            }}
          />

          {/* Winning Slot Selector Needle */}
          <div
            className="absolute top-0 left-1/2 flex flex-col items-center z-10"
            style={{ transform: "translateX(-50%)" }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "9px solid transparent",
                borderRight: "9px solid transparent",
                borderTop: `12px solid ${PALETTE.gold}`,
              }}
            />
          </div>

          <div
            ref={viewportRef}
            className="h-full flex items-center overflow-hidden"
          >
            <div
              ref={stripRef}
              className="flex items-center py-4"
              style={{ willChange: "transform" }}
            >
              {numbers.map((n, i) => (
                <div
                  key={`${n}-${i}`}
                  className="tile-number flex items-center justify-center flex-none transition-all"
                  style={{
                    width: TILE_WIDTH,
                    height: 72,
                    margin: `0 ${TILE_GAP / 2}px`,
                    borderRadius: 14,
                    fontSize: "1.75rem",
                    ...tileStyle(n),
                  }}
                >
                  {n}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bet Amount Control Bar */}
        <div
          className="rounded-2xl p-2.5 sm:p-3 mb-4 flex flex-wrap items-center gap-3"
          style={panelBase}
        >
          <div
            className="flex items-center flex-1 rounded-xl px-4"
            style={{
              background: PALETTE.panel2,
              border: `1px solid ${PALETTE.line}`,
              minWidth: 200,
            }}
          >
            <span className="text-base mr-2" style={{ color: PALETTE.inkDim }}>
              $
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="gyre-num bg-transparent outline-none py-3 w-full text-lg font-semibold"
              style={{ color: PALETTE.ink }}
            />
          </div>

          <div className="flex gap-2">
            <button
              className="gyre-btn px-4 py-3 rounded-xl text-xs font-semibold"
              style={{
                background: PALETTE.panel2,
                border: `1px solid ${PALETTE.line}`,
                color: PALETTE.ink,
              }}
              onClick={() => scaleBet(0.5)}
            >
              ½
            </button>
            <button
              className="gyre-btn px-4 py-3 rounded-xl text-xs font-semibold"
              style={{
                background: PALETTE.panel2,
                border: `1px solid ${PALETTE.line}`,
                color: PALETTE.ink,
              }}
              onClick={() => scaleBet(2)}
            >
              2×
            </button>
            <button
              className="gyre-btn px-4 py-3 rounded-xl text-xs font-semibold"
              style={{
                background: PALETTE.panel2,
                border: `1px solid ${PALETTE.line}`,
                color: PALETTE.ink,
              }}
              onClick={maxBet}
            >
              Max
            </button>
          </div>
        </div>

        {/* Wager Panels */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {betOptions.map((p) => {
            const currentWager = wagers[p.key];
            const isHasWager = currentWager > 0;
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
                className={
                  `relative rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 ` +
                  `${
                    flash.panel === p.key
                      ? flash.kind === "win"
                        ? "flash-win"
                        : "flash-error"
                      : ""
                  }`
                }
                style={{
                  background: p.bgLight,
                  border: `1px solid ${p.borderColor}`,
                  boxShadow: isWinner
                    ? `0 0 16px rgba(211, 161, 84, 0.3)`
                    : isLoser
                      ? `0 0 12px rgba(241, 143, 142, 0.25)`
                      : isHasWager
                        ? `0 0 12px ${p.glowColor}`
                        : "none",
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="font-semibold text-base"
                      style={{ color: p.labelColor }}
                    >
                      {p.label}
                    </span>

                    {isHasWager && (
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: p.buttonBg,
                          color: "#FFFFFF",
                        }}
                      ></span>
                    )}
                  </div>
                  <div
                    className="text-2xl font-bold"
                    style={{ color: PALETTE.ink }}
                  >
                    {p.mult.toFixed(2)}×
                  </div>
                </div>

                <div className="mt-6">
                  {/* Total Staked Display Box */}
                  <div
                    className="text-base font-semibold rounded-xl px-3 py-2.5 transition-all text-center flex items-center justify-between"
                    style={{
                      background: PALETTE.panel,
                      border: `1px solid ${p.borderColor}`,
                      color: PALETTE.ink,
                    }}
                  >
                    <span
                      className="text-xs font-medium uppercase tracking-wider"
                      style={{ color: PALETTE.inkDim }}
                    >
                      Total Wager
                    </span>
                    <span>{fmt(currentWager || 0)}</span>
                  </div>

                  {/* Outcome Win Indicator */}
                  {isWinner && (
                    <div
                      className="mt-2 text-xs font-semibold text-center py-1 rounded-md transition-all duration-300"
                      style={{
                        background: "rgba(211,161,84,0.15)",
                        color: PALETTE.gold,
                        border: `1px solid ${PALETTE.gold}`,
                      }}
                    >
                      Won +{fmt(outcome.amount)}!
                    </div>
                  )}

                  {/* Outcome Loss Indicator */}
                  {isLoser && (
                    <div
                      className="mt-2 text-xs font-semibold text-center py-1 rounded-md transition-all duration-300"
                      style={{
                        background: "rgba(241,143,142,0.15)",
                        color: "#D64242",
                        border: "1px solid #FADAD8",
                      }}
                    >
                      -{fmt(outcome.amount)}
                    </div>
                  )}

                  {/* Clean Solid Colored Action Button */}
                  <button
                    className="gyre-btn w-full py-3.5 mt-3 rounded-xl text-sm font-semibold capitalize transition-all flex items-center justify-center shadow-sm"
                    style={{
                      background: p.buttonBg,
                      color: "#FFFFFF",
                      border: "none",
                      boxShadow: `0 3px 10px ${p.glowColor}`,
                    }}
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

        <p
          className="text-xs sm:text-sm mt-8 text-center"
          style={{ color: PALETTE.inkDim }}
        >
          Each spin lands on 0–14. Zero pays green, 1–7 pay red, and 8–14 pay
          black. Simulated currency only — nothing here is real money.
        </p>
      </div>
    </div>
  );
}
