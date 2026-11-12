import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import { resetPassword } from "../api";

const inputClass = "w-full rounded-[12px] border border-[#94aaa133] bg-white/3 px-3.5 py-3 text-sm text-[#f3f7f5] outline-none placeholder:text-[#cadcd67a] focus:border-[#7aebb0bf] focus:bg-white/5 focus:ring-4 focus:ring-[#4abf7f1f]";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const submittingRef = useRef(false);
  const succeededRef = useRef(false);

  const update = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    // A second submit after the password changed would hit the now-consumed
    // token and replace the success screen with an "expired link" error.
    if (submittingRef.current || succeededRef.current) {
      return;
    }
    setError("");
    if (formData.password.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("The two passwords don't match.");
      return;
    }
    submittingRef.current = true;
    setIsLoading(true);
    try {
      const response = await resetPassword({ token, password: formData.password });
      succeededRef.current = true;
      setSuccess(response.message || "Password updated. You can sign in with your new password.");
    } catch (resetError) {
      if (!succeededRef.current) {
        console.error(resetError);
        setError(resetError.message || "Unable to reset your password. Please request a new link.");
      }
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Link missing" description="This page needs a reset link to work.">
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-200">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <span>Open the link from your reset email, or request a new one.</span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/forgot-password")}
          className="mt-5 inline-flex min-h-11.5 w-full cursor-pointer items-center justify-center gap-2 rounded-[13px] border-0 bg-linear-to-br from-[#7fe6b4] to-[#38d59d] px-4 py-3 text-sm font-semibold text-[#062b22] shadow-[0_14px_32px_rgba(56,213,157,.28)] transition hover:-translate-y-px"
        >
          Request a reset link
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={success ? "Password updated" : "Choose a new password"}
      description={
        success
          ? "Your new password is active. Sign in to continue where you left off."
          : "Pick something you haven't used before. You'll be signed in with it right away."
      }
    >
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate("/login", { replace: true })}
            className="mt-5 inline-flex min-h-11.5 w-full cursor-pointer items-center justify-center gap-2 rounded-[13px] border-0 bg-linear-to-br from-[#7fe6b4] to-[#38d59d] px-4 py-3 text-sm font-semibold text-[#062b22] shadow-[0_14px_32px_rgba(56,213,157,.28)] transition hover:-translate-y-px"
          >
            Sign in
            <ArrowRight size={17} />
          </button>
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#ecfef5]">
            <span>New password</span>
            <div className="relative">
              <input
                className={`${inputClass} pr-11`}
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={update}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#e0efe9d9] hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#ecfef5]">
            <span>Confirm new password</span>
            <input
              className={inputClass}
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Type it again"
              value={formData.confirmPassword}
              onChange={update}
              autoComplete="new-password"
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
                Saving...
              </>
            ) : (
              <>
                Set new password
                <ArrowRight size={17} />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate("/forgot-password")}
            className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-[#cce4dcb3] hover:text-[#d7f7e4]"
          >
            Need a new link?
          </button>
        </form>
      )}
    </AuthLayout>
  );
};

export default ResetPassword;
