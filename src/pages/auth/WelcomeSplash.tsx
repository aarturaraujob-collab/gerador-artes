import { AnimatePresence, motion } from "framer-motion";
import { publicPath } from "@/lib/publicPath";

export function WelcomeSplash({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.img
            src={publicPath("/assets/logos/logo_urano_branco.png")}
            alt="Urano"
            className="h-16 w-auto object-contain"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          />
          <motion.p
            className="font-display text-lg font-semibold text-white"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            Seja bem-vindo ao Urano!
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
