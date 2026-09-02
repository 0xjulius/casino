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
  color: string;
  glowColor: string;
  labelColor: string;
  textOn: string;
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

const TILE_WIDTH = 78;
const TILE_GAP = 10;
const FULL_TILE_SPAN = TILE_WIDTH + TILE_GAP;

const BASE_SEQUENCE = [
  1, 8, 2, 9, 3, 10, 4, 0, 11, 5, 12, 6, 13, 7, 14,
];

const PALETTE = {
  bg: "#11131c",
  panel: "#191c29",
  panel2: "#1f2333",
  line: "rgba(255,255,255,0.08)",
  ink: "#ECEDF4",
  inkDim: "#8A90A6",
  gold: "#D9A94D",
  red: "#E14B5A",
  redDim: "#5A2530",
  green: "#37B679",
  greenDim: "#1E4A38",
  black: "#2B2D36",
  blackDim: "#1C1E24",
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
      background: "linear-gradient(180deg, #C13A48, #9C2E3A)",
      color: "#FBE3E5",
    };
  }

  if (c === "green") {
    return {
      background: "linear-gradient(180deg, #2E9E68, #227A50)",
      color: "#DFF6EA",
    };
  }

  return {
    background: "linear-gradient(180deg, #2A2C36, #16171E)",
    color: "#E4E5EC",
    border: "1px solid rgba(255,255,255,0.06)",
  };
}

function fmt(n: number): string {
  return "$" + n.toFixed(2);
}

export default function GyreRoulette() {
  const [balance, setBalance] = useState<number>(100);

  const [wagers, setWagers] = useState<Wagers>({
    red: 0,
    green: 0,
    black: 0,
  });

  const [history, setHistory] = useState<number[]>(() => {
    const seed: number[] = [];
    for (let i = 0; i < 8; i++) {
      seed.push(randomSlot());
    }
    return seed;
  });

  const [numbers, setNumbers] = useState<number[]>(() => buildNumbers(0));
  const [secondsLeft, setSecondsLeft] = useState<number>(ROUND_SECONDS);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [resultText, setResultText] = useState<string>("");
  const [betAmount, setBetAmount] = useState<string>("1.00");
  
  // Tallentaa viimeisimmän kierroksen voiton tai tappion per väri
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

  // Tyhjennetään tulosilmoitukset (voitto/häviö) 2.5s kuluttua
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
    const totalStaked = currentWagers.red + currentWagers.green + currentWagers.black;

    const payout = winningBet > 0 ? winningBet * PAYOUT[winningColor] : 0;
    const newOutcomes: OutcomeState[] = [];

    // Lasketaan voitoille ja tappioille indikaattorit
    (Object.keys(currentWagers) as Color[]).forEach((col) => {
      const bet = currentWagers[col];
      if (bet > 0) {
        if (col === winningColor) {
          newOutcomes.push({ color: col, kind: "win", amount: bet * PAYOUT[col] });
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

    setHistory((h) => [...h, result].slice(-14));

    if (totalStaked > 0) {
      if (payout > 0) {
        setResultText(`Landed on ${result} (${winningColor}) · won ${fmt(payout)}`);
      } else {
        setResultText(`Landed on ${result} (${winningColor}) · lost ${fmt(totalStaked)}`);
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
    const targetOffset = -(TARGET_INDEX * FULL_TILE_SPAN) + (viewportWidth / 2 - TILE_WIDTH / 2);

    strip.style.transition = withTransition ? "transform 4.2s cubic-bezier(0.11,0.66,0.15,1)" : "none";
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

  const panelBase: CSSProperties = {
    background: PALETTE.panel,
    border: `1px solid ${PALETTE.line}`,
  };

  const betOptions: BetOption[] = [
    {
      key: "red",
      label: "Red (1–7)",
      mult: PAYOUT.red,
      odds: "7 of 15 slots",
      color: PALETTE.red,
      glowColor: "rgba(225, 75, 90, 0.45)",
      labelColor: PALETTE.red,
      textOn: "#FFFFFF",
    },
    {
      key: "green",
      label: "Green (0)",
      mult: PAYOUT.green,
      odds: "1 of 15 slots",
      color: PALETTE.green,
      glowColor: "rgba(55, 182, 121, 0.45)",
      labelColor: PALETTE.green,
      textOn: "#FFFFFF",
    },
    {
      key: "black",
      label: "Black (8–14)",
      mult: PAYOUT.black,
      odds: "7 of 15 slots",
      color: PALETTE.black,
      glowColor: "rgba(199, 204, 224, 0.25)",
      labelColor: "#C7CCE0",
      textOn: "#EDEFF6",
    },
  ];

  return (
    <div
      style={{
        background: PALETTE.bg,
        color: PALETTE.ink,
        minHeight: "100vh",
      }}
      className="font-sans"
    >
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          background: ${PALETTE.bg};
          min-height: 100%;
        }

        @keyframes flashWin {
          0% { background-color: rgba(217,169,77,0.28); }
          100% { background-color: transparent; }
        }

        @keyframes flashError {
          0% { background-color: rgba(225,75,90,0.28); }
          100% { background-color: transparent; }
        }

        .flash-win { animation: flashWin 0.55s ease; }
        .flash-error { animation: flashError 0.55s ease; }

        .gyre-btn {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .gyre-btn:active:not(:disabled) {
          transform: scale(0.97);
        }

        .gyre-btn:hover:not(:disabled) {
          filter: brightness(1.12);
        }

        .btn-glow-red:hover:not(:disabled) {
          box-shadow: 0 0 16px rgba(225, 75, 90, 0.5), 0 0 2px rgba(225, 75, 90, 0.8);
        }

        .btn-glow-green:hover:not(:disabled) {
          box-shadow: 0 0 16px rgba(55, 182, 121, 0.5), 0 0 2px rgba(55, 182, 121, 0.8);
        }

        .btn-glow-black:hover:not(:disabled) {
          box-shadow: 0 0 16px rgba(199, 204, 224, 0.3), 0 0 2px rgba(199, 204, 224, 0.5);
        }

        .btn-glow-gold:hover:not(:disabled) {
          box-shadow: 0 0 12px rgba(217, 169, 77, 0.35);
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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Gyre</h1>
            <p className="text-sm mt-1" style={{ color: PALETTE.inkDim }}>
              A fifteen-slot wheel. One long shot, two even ones.
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs mb-1" style={{ color: PALETTE.inkDim }}>
              Balance
            </div>
            <div className="font-mono text-xl sm:text-2xl font-semibold">
              {fmt(balance)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {history
            .slice()
            .reverse()
            .map((n, i) => {
              const c = colorOf(n);

              return (
                <div
                  key={`${n}-${i}`}
                  className="font-mono font-semibold text-sm flex items-center justify-center flex-none"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background:
                      c === "red"
                        ? PALETTE.redDim
                        : c === "green"
                        ? PALETTE.greenDim
                        : PALETTE.blackDim,
                    color:
                      c === "red"
                        ? "#F7C6CB"
                        : c === "green"
                        ? "#BFEBD3"
                        : "#C7CCE0",
                  }}
                >
                  {n}
                </div>
              );
            })}
        </div>

        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-sm" style={{ color: PALETTE.inkDim }}>
            {spinning ? (
              "Spinning…"
            ) : (
              <>
                Place your bets — next spin in{" "}
                <span className="font-mono" style={{ color: PALETTE.ink }}>
                  {secondsLeft}
                </span>
                s
              </>
            )}
          </span>

          <span className="text-sm font-mono font-medium" style={{ color: PALETTE.gold }}>
            {resultText}
          </span>
        </div>

        <div
          className="rounded-full overflow-hidden mb-6"
          style={{
            height: 3,
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

        <div
          className="relative rounded-2xl mb-8 overflow-hidden"
          style={{
            height: 104,
            background: PALETTE.panel,
            border: `1px solid ${PALETTE.line}`,
          }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-full pointer-events-none"
            style={{
              background: `linear-gradient(90deg, ${PALETTE.panel}, transparent 15%, transparent 85%, ${PALETTE.panel})`,
              zIndex: 5,
            }}
          />

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
                borderTop: `11px solid ${PALETTE.gold}`,
                filter: "drop-shadow(0 0 6px rgba(217,169,77,0.55))",
              }}
            />
            <div
              style={{
                width: 2,
                height: 92,
                background: `linear-gradient(180deg, ${PALETTE.gold}, transparent)`,
                opacity: 0.35,
              }}
            />
          </div>

          <div ref={viewportRef} className="h-full flex items-center overflow-hidden">
            <div
              ref={stripRef}
              className="flex items-center py-4"
              style={{ willChange: "transform" }}
            >
              {numbers.map((n, i) => (
                <div
                  key={`${n}-${i}`}
                  className="flex items-center justify-center font-mono font-semibold flex-none"
                  style={{
                    width: TILE_WIDTH,
                    height: 78,
                    margin: `0 ${TILE_GAP / 2}px`,
                    borderRadius: 10,
                    fontSize: "1.6rem",
                    ...tileStyle(n),
                  }}
                >
                  {n}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="rounded-2xl p-3 sm:p-4 mb-6 flex flex-wrap items-center gap-2"
          style={panelBase}
        >
          <div
            className="flex items-center flex-1 rounded-xl px-3"
            style={{
              background: PALETTE.panel2,
              border: `1px solid ${PALETTE.line}`,
              minWidth: 160,
            }}
          >
            <span className="text-sm mr-2" style={{ color: PALETTE.inkDim }}>
              $
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="gyre-num font-mono bg-transparent outline-none py-3 w-full text-lg font-medium"
              style={{ color: PALETTE.ink }}
            />
          </div>

          <div className="flex gap-2">
            <button
              className="gyre-btn btn-glow-gold px-3.5 py-2 rounded-lg text-sm font-medium"
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
              className="gyre-btn btn-glow-gold px-3.5 py-2 rounded-lg text-sm font-medium"
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
              className="gyre-btn btn-glow-gold px-3.5 py-2 rounded-lg text-sm font-medium"
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {betOptions.map((p) => {
            const currentWager = wagers[p.key];
            const isHasWager = currentWager > 0;
            const outcome = outcomes.find((o) => o.color === p.key);

            const isWinner = outcome?.kind === "win";
            const isLoser = outcome?.kind === "loss";

            return (
              <div
                key={p.key}
                className={
                  `relative rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 ` +
                  `${
                    flash.panel === p.key
                      ? flash.kind === "win"
                        ? "flash-win"
                        : "flash-error"
                      : ""
                  }`
                }
                style={{
                  ...panelBase,
                  borderColor: isWinner
                    ? PALETTE.gold
                    : isLoser
                    ? PALETTE.red
                    : isHasWager
                    ? p.color
                    : PALETTE.line,
                  boxShadow: isWinner
                    ? `0 0 20px rgba(217,169,77,0.25)`
                    : isLoser
                    ? `0 0 12px rgba(225, 75, 90, 0.3)`
                    : isHasWager
                    ? `0 0 12px ${p.glowColor}`
                    : "none",
                  background: isWinner
                    ? "linear-gradient(180deg, #1f2333, #222026)"
                    : isLoser
                    ? "linear-gradient(180deg, #1f2333, #261c20)"
                    : PALETTE.panel,
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium" style={{ color: p.labelColor }}>
                      {p.label}
                    </span>
                    <span className="text-sm font-mono" style={{ color: PALETTE.inkDim }}>
                      {p.mult.toFixed(2)}×
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: PALETTE.inkDim }}>
                    {p.odds}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: PALETTE.inkDim }}>
                    </span>
                  </div>

                  <div
                    className="font-mono text-lg font-semibold rounded-lg px-2.5 py-1.5 transition-colors"
                    style={{
                      background: PALETTE.panel2,
                    }}
                  >
                    {fmt(currentWager || 0)}
                  </div>

                  {/* Voiton näyttö */}
                  {isWinner && (
                    <div
                      className="mt-2 text-xs font-mono font-semibold text-center py-1 rounded-md transition-all duration-300"
                      style={{
                        background: "rgba(217,169,77,0.15)",
                        color: PALETTE.gold,
                        border: `1px solid ${PALETTE.gold}`,
                      }}
                    >
                      Won +{fmt(outcome.amount)}!
                    </div>
                  )}

                  {/* Tappion näyttö */}
                  {isLoser && (
                    <div
                      className="mt-2 text-xs font-mono font-semibold text-center py-1 rounded-md transition-all duration-300"
                      style={{
                        background: "rgba(225,75,90,0.15)",
                        color: PALETTE.red,
                        border: `1px solid ${PALETTE.red}`,
                      }}
                    >
                      -{fmt(outcome.amount)}
                    </div>
                  )}

                  <button
                    className={`gyre-btn btn-glow-${p.key} w-full py-2.5 mt-3 rounded-xl font-medium`}
                    style={{
                      background: p.color,
                      color: p.textOn,
                      border:
                        p.key === "black"
                          ? "1px solid rgba(255,255,255,0.15)"
                          : "1px solid transparent",
                    }}
                    disabled={spinning}
                    onClick={() => placeBet(p.key)}
                  >
                    Bet {p.label.toLowerCase()}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs mt-6 text-center" style={{ color: PALETTE.inkDim }}>
          Each spin lands on 0–14. Zero pays green, 1–7 pay red, and 8–14 pay black.
          Simulated currency only — nothing here is real money.
        </p>
      </div>
    </div>
  );
}