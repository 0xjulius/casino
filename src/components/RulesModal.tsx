import { motion, AnimatePresence } from "framer-motion";

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RulesModal({ isOpen, onClose }: RulesModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-lg p-6 bg-[#FAF6F0] border border-[#E2D6C3] rounded-3xl shadow-2xl text-[#2D2621]"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-[#8C827A] hover:text-[#2D2621] rounded-full hover:bg-[#EFE8DC] transition-colors cursor-pointer"
            >
              ✕
            </button>

            <h2 className="text-2xl font-serif font-bold mb-4 text-[#2D2621]">
              How Does Gyre Work?
            </h2>

            <div className="space-y-3 text-sm text-[#574E46] leading-relaxed">
              <p>
                Gyre is a 15-slot roulette game (numbers 0–14). Every round,
                the wheel draws one winning number.
              </p>

              <div className="p-3.5 bg-[#EFE8DC] rounded-2xl border border-[#E2D6C3] space-y-1.5 font-mono text-xs shadow-inner">
                <div className="flex justify-between text-[#C41E2E] font-bold">
                  <span>Red (1–7)</span>
                  <span>Payout 2.00x</span>
                </div>
                <div className="flex justify-between text-[#1A7A4C] font-bold">
                  <span>Green (0)</span>
                  <span>Payout 14.00x</span>
                </div>
                <div className="flex justify-between text-[#1F2128] font-bold">
                  <span>Black (8–14)</span>
                  <span>Payout 2.00x</span>
                </div>
              </div>

              <ul className="list-disc pl-5 space-y-1 pt-1">
                <li>
                  Choose your wager and place it on one of the three colors
                  before the timer runs out.
                </li>
                <li>
                  You can place bets on multiple colors simultaneously during
                  the betting phase.
                </li>
                <li>
                  Game results are cryptographically verified and completely
                  random.
                </li>
              </ul>
            </div>

            <button
              onClick={onClose}
              className="mt-6 w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors shadow-sm cursor-pointer active:scale-[0.98]"
            >
              Got it, let's play!
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}