import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CreditCard, Loader, ShieldCheck, HelpCircle } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import { useCartStore } from '../../store/cartStore';
import api from '../../services/api';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID || '';
const razorpayMode = (import.meta.env.VITE_RAZORPAY_MODE || 'live').toLowerCase();
const isSimulationMode = razorpayMode === 'simulation';
const isTestKey = razorpayKeyId.startsWith('rzp_test_');

const loadRazorpayScript = () =>
  new Promise<void>((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    const existingScript = document.getElementById('razorpay-checkout-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Unable to load Razorpay Checkout.')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Razorpay Checkout.'));
    document.body.appendChild(script);
  });

export const RazorpayPayment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const { clearCart } = useCartStore();

  const amount = searchParams.get('amount') || '0';
  const address = searchParams.get('address') || '';

  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    if (!address.trim()) {
      addToast('Delivery address is missing. Please return to checkout.', 'warning');
      navigate('/checkout');
      return;
    }

    if (isSimulationMode) {
      addToast('Simulation mode is enabled. Real Razorpay checkout is disabled.', 'warning');
      navigate('/cart');
      return;
    }

    if (!razorpayKeyId) {
      addToast('Razorpay key ID is not configured. Please set VITE_RAZORPAY_KEY_ID.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post('/api/orders/create-razorpay-order', {
        address,
      });

      const { orderId, razorpayOrderId, amount: razorpayAmount, currency } = response.data;

      await loadRazorpayScript();

      const Razorpay = window.Razorpay;

      if (!Razorpay) {
        throw new Error('Razorpay SDK is unavailable.');
      }

      const razorpay = new Razorpay({
        key: razorpayKeyId,
        amount: Number(razorpayAmount),
        currency,
        name: 'VendorHub',
        description: `Razorpay payment for order ${orderId}`,
        order_id: razorpayOrderId,
        prefill: {
          name: 'Buyer',
          email: 'buyer@vendorhub.local',
        },
        theme: {
          color: '#4F46E5',
        },
        handler: async (paymentResponse: Record<string, string>) => {
          try {
            await api.post('/api/orders/verify-payment', {
              orderId,
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
            });

            addToast('Payment successful! Your order is confirmed.', 'success');
            await clearCart();
            navigate(`/order-success?id=${orderId}`);
          } catch (verifyError: any) {
            addToast(
              verifyError.response?.data?.error ||
                verifyError.response?.data?.message ||
                'Payment verification failed. Please contact support.',
              'error'
            );
          }
        },
        modal: {
          ondismiss: () => {
            addToast('Payment was cancelled.', 'warning');
            navigate('/cart');
          },
        },
      });

      razorpay.open();
    } catch (error: any) {
      addToast(
        error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          'Unable to start Razorpay payment. Please try again.',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentDecline = () => {
    addToast('Payment transaction cancelled by customer.', 'warning');
    navigate('/cart');
  };

  const modeLabel = isSimulationMode ? 'Simulation' : isTestKey ? 'Test Mode' : 'Live Mode';

  return (
    <div className="max-w-md mx-auto space-y-6 animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 relative overflow-hidden shadow-sm">
        <div className="absolute -top-1/4 -right-1/4 w-32 h-32 rounded-full bg-blue-500/10 blur-2xl" />

        <div className="flex items-center justify-between mb-8">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full flex items-center gap-1">
            <CreditCard className="w-3 h-3" /> SECURE GATEWAY
          </span>
          <span className="font-display font-black text-sm tracking-tight text-slate-800">
            Razorpay <span className="text-blue-650">{modeLabel}</span>
          </span>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-slate-500 block">AMOUNT TO PAY</span>
          <h2 className="font-display font-black text-3xl text-slate-900">₹{parseFloat(amount).toLocaleString('en-IN')}</h2>
        </div>
      </div>

      <div className="card-premium-gradient p-6 rounded-3xl shadow-sm space-y-6">
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 p-4 rounded-2xl">
          <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-blue-700 mb-1">Razorpay Checkout</h4>
            <p className="text-[10px] text-blue-600 leading-normal">
              {isSimulationMode
                ? 'Simulation mode is currently enabled. To use real payments, set VITE_RAZORPAY_MODE=live and provide a valid Razorpay key.'
                : 'Your checkout is now connected to the Razorpay payment flow through the backend order verification endpoints.'}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-4">
            <Loader className="w-8 h-8 text-blue-600 animate-spin mb-2" />
            <p className="text-xs font-bold text-slate-500 animate-pulse">Initializing Razorpay checkout...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handlePayment}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              {isSimulationMode ? 'Simulation Disabled' : 'Pay with Razorpay'}
            </button>
            <button
              onClick={handlePaymentDecline}
              className="w-full py-3 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 font-bold rounded-xl text-xs transition-colors border border-slate-200 cursor-pointer"
            >
              Cancel Transaction
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RazorpayPayment;
