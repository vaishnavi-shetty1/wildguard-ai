import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, AlertCircle, MailCheck } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import { requestPasswordReset } from "../api";

const inputClass = "w-full rounded-[12px] border border-[#94aaa133] bg-white/3 px-3.5 py-3 text-sm text-[#f3f7f5] outline-none placeholder:text-[#cadcd67a] focus:border-[#7aebb0bf] focus:bg-white/5 focus:ring-4 focus:ring-[#4abf7f1f]";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) {
      setError("Email address is required.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const response = await requestPasswordReset({ email: address });
      setSent(response);
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.message || "Unable to send the reset link. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title={sent ? "Check your inbox" : "Forgot your password?"}
      description={
        sent
          ? "Follow the link we sent to choose a new password. It expires shortly, so use it soon."
          : "Enter the email you signed up with and we'll send you a link to set a new password."
      }
    >
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {sent ? (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            <MailCheck size={18} className="mt-0.5 shrink-0" />
            <span>{sent.message}</span>
          </div>

          {sent.reset_url && (
            <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-xs text-amber-200">
              <p className="mb-2 font-semibold">Development only — email isn't configured.</p>
              <button
                type="button"
                onClick={() => navigate(sent.reset_url.replace(/^https?:\/\/[^/]+/, ""))}
                className="cursor-pointer break-all border-0 bg-transparent p-0 text-left font-semibold text-[#7fe6b4] underline hover:text-[#a6f3cc]"
              >
                Open your reset link
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-5 inline-flex min-h-11.5 w-full cursor-pointer items-center justify-center gap-2 rounded-[13px] border-0 bg-linear-to-br from-[#7fe6b4] to-[#38d59d] px-4 py-3 text-sm font-semibold text-[#062b22] shadow-[0_14px_32px_rgba(56,213,157,.28)] transition hover:-translate-y-px"
          >
            <ArrowLeft size={17} />
            Back to sign in
          </button>
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#ecfef5]">
            <span>Email address</span>
            <input
              className={inputClass}
              type="email"
              name="email"
              placeholder="you@wildguard.org"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              autoComplete="email"
              required
            />
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 inline-flex min-h-11.5 cursor-pointer items-center justify-center gap-2 rounded-[13px] border-0 bg-linear-to-br from-[#7fe6b4] to-[#38d59d] px-4 py-3 text-sm font-semibold text-[#062b22] shadow-[0_14px_32px_rgba(56,213,157,.28)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-[#062b22] border-t-transparent" />
                Sending...
              </>
            ) : (
              <>
                Send reset link
                <ArrowRight size={17} />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-[#cce4dcb3] hover:text-[#d7f7e4]"
          >
            Back to sign in
          </button>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;
