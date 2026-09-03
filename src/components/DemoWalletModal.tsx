import { motion, AnimatePresence } from "framer-motion";

interface DemoWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DemoWalletModal({
  isOpen,
  onClose,
}: DemoWalletModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-md p-6 bg-[#FAF6F0] border border-[#E2D6C3] rounded-3xl shadow-2xl text-[#2D2621]"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-[#8C827A] hover:text-[#2D2621] rounded-full hover:bg-[#EFE8DC] transition-colors cursor-pointer"
            >
              ✕
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-[#EFE8DC] text-amber-700 border border-[#E2D6C3]">
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
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-serif font-bold text-[#2D2621]">
                  Demo Balance & Disclaimer
                </h3>
                <p className="text-xs text-[#8C827A]">
                  Demosaldo & Vastuuvapauslauseke
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-3 text-sm text-[#574E46] leading-relaxed border-t border-[#E2D6C3] pt-4">
              <div className="p-3.5 bg-[#EFE8DC] rounded-2xl border border-[#E2D6C3] text-xs text-[#574E46] space-y-2">
                <span className="font-bold text-[#2D2621] uppercase tracking-wider block text-[10px]">
                  Disclaimer / Vastuuvapauslauseke
                </span>
                <p>
                  This application is{" "}
                  <strong className="font-semibold text-[#2D2621]">
                    not a gambling service
                  </strong>
                  . It is designed strictly for demonstration and testing
                  purposes only.
                </p>
                <p className="text-[#8C827A] pt-1 border-t border-[#E2D6C3]/60">
                  Tämä sovellus ei ole rahapeli. Peli on tarkoitettu ainoastaan
                  viihde-, esittely tai testaustarkoitukseen.
                </p>
              </div>

              <div className="text-xs space-y-1.5 px-1 text-[#574E46]">
                <p>• Demo funds, credits or any balance shown on this application have no real-world monetary value.</p>
                <p>
                  • These funds cannot be purchased, withdrawn, transferred, or
                  exchanged for any real or virtual currencies.
                </p>
                <p>
                  • This demo application is not affiliated with any licensed or unlicensed
                  gambling operators and does not offer real gambling services,
                  or violate any gambling regulations, or laws.
                </p>
                <p>
                  • By using this application, you acknowledge that it is for
                  entertainment, or testing purposes only.
                </p>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={onClose}
              className="mt-6 w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors shadow-sm cursor-pointer active:scale-[0.98]"
            >
              Got it / Selvä
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
