// Full-screen embedded Stripe Checkout modal.
// Rendered on top of the CommitmentDialog once a client secret is available.
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { X as XIcon } from "lucide-react";
import { getStripe } from "@/lib/stripe";

interface Props {
  clientSecret: string;
  onClose: () => void;
}

export function EmbeddedCheckoutModal({ clientSecret, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl h-[92vh] bg-background rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-3 border-b bg-black text-white shrink-0">
          <h3 className="text-lg font-extrabold tracking-tight">SECURE CHECKOUT</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  );
}
