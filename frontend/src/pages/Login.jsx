import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {ArrowRight,Eye,EyeOff,AlertCircle,CheckCircle2} from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import { loginUser } from "../api";

const inputClass = "w-full rounded-[12px] border border-[#94aaa133] bg-white/3 px-3.5 py-3 text-sm text-[#f3f7f5] outline-none placeholder:text-[#cadcd67a] focus:border-[#7aebb0bf] focus:bg-white/5 focus:ring-4 focus:ring-[#4abf7f1f]";

const Login = () => {

  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: location.state?.registeredEmail || "",
    password: "",
    rememberMe: false,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  //input update
  const update = (event) => {
    const {name,value,type,checked} = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
    setSuccess("");
  };

//login
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    const email = formData.email.trim().toLowerCase();
    const password = formData.password;
    if (!email) {
      setError("Email address is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await loginUser({ email, password });

      const backendUser = response.user;

      const authenticatedUser = {
        id: String(backendUser.id),
        username: backendUser.username,
        email: backendUser.email,
        role: backendUser.role,
        phone: backendUser.phone || "",
        locationName: backendUser.location_name || "",
        smsAlertsEnabled: backendUser.sms_alerts_enabled,
        createdAt: backendUser.created_at || new Date().toISOString(),
        isActive: backendUser.is_active,
      };

      localStorage.setItem("wildguard_user", JSON.stringify(authenticatedUser));
      localStorage.setItem("wildguard_token", response.access_token);

      if (formData.rememberMe) {
        localStorage.setItem("wildguard_remember","true");
      }
      setSuccess("Login successful. Redirecting...");
      setTimeout(() => {
        navigate("/home", {replace: true});
      }, 500);
    } catch (loginError) {
      console.error(loginError);
      setError(loginError.message || "Unable to sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout eyebrow="Secure access" title="Welcome back" description="Sign in to continue to your operations workspace.">

      {/* ERROR */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0"/>
          <span>{error}</span>
        </div>
      )}

      {/* SUCCESS */}
      {success && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0"/>
          <span>{success}</span>
        </div>
      )}

      {/* LOGIN FORM */}
      <form onSubmit={submit} className="flex flex-col gap-4">
        {/* Email */}
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#ecfef5]">
          <span>Email address</span>
          <input className={inputClass} type="email" name="email" placeholder="you@wildguard.org" value={formData.email} onChange={update} autoComplete="email" required/>
        </label>

        {/* Password */}
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#ecfef5]">
          <span>Password</span>
          <div className="relative">
            <input className={`${inputClass} pr-11`} type={showPassword ? "text" : "password"} name="password" placeholder="Enter your password" value={formData.password} onChange={update} autoComplete="current-password" required/>
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#e0efe9d9] hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? (
                <EyeOff size={17} />
              ) : (
                <Eye size={17} />
              )}
            </button>
          </div>
        </label>

        {/* Remember */}
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[#cce4dcb3]">
            <input type="checkbox" name="rememberMe" checked={formData.rememberMe} onChange={update} className="size-4 accent-emerald-400"/>
            Remember me
          </label>
          <button type="button" onClick={() => setError("Password recovery will be connected to the backend.")} className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-[#7fe6b4] hover:text-[#a6f3cc]">
            Forgot password?
          </button>
        </div>

        {/* Submit */}
        <button type="submit" disabled={isLoading} className="mt-1 inline-flex min-h-11.5 cursor-pointer items-center justify-center gap-2 rounded-[13px] border-0 bg-linear-to-br from-[#7fe6b4] to-[#38d59d] px-4 py-3 text-sm font-extrabold text-[#062b22] shadow-[0_14px_32px_rgba(56,213,157,.28)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60">
          {isLoading ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-[#062b22] border-t-transparent" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>

      {/* REGISTER */}
      <div className="mt-5 flex justify-center gap-2 text-xs text-[#cce4dcb3]">
        <span>
          Don't have an account?
        </span>
        <button type="button" onClick={() => navigate("/register")} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-[#d7f7e4] hover:text-[#7fe6b4]">
          Create one here
        </button>
      </div>

      {/* DEMO LOGIN */}
      <div className="mt-5 border-t border-white/5 pt-4">
        <p className="mb-2 text-center text-[9px] font-bold uppercase tracking-[.16em] text-[#7fe6b4]">
          Demo accounts
        </p>

        <div className="grid grid-cols-2 gap-2">

          <DemoLogin label="Admin" email="admin@wildguard.ai" password="admin123" onSelect={(email, password) => setFormData((current) => ({ ...current, email, password }))}/>

          <DemoLogin label="Operator" email="operator@wildguard.ai" password="operator123" onSelect={(email, password) => setFormData((current) => ({ ...current, email, password}))}/>

          <DemoLogin label="Landowner" email="landowner@wildguard.ai" password="landowner123" onSelect={(email, password) => setFormData((current) => ({ ...current, email, password}))}/>

          <DemoLogin label="Village Head" email="villagehead@wildguard.ai" password="villagehead123" onSelect={(email, password) => setFormData((current) => ({ ...current, email, password}))}/>
        </div>
      </div>
    </AuthLayout>
  );
};

//demo login 
const DemoLogin = ({label,email,password,onSelect}) => {
  return (
    <button type="button" onClick={() => onSelect(email, password)} className="rounded-[10px] border border-[#8cb3a426] bg-white/3 px-2.5 py-2 text-left transition hover:border-[#7fe6b466] hover:bg-white/5">
      <span className="block text-[10px] font-bold text-[#edfdf5]">
        {label}
      </span>
      <span className="block truncate text-[8px] text-[#9fb8b0]">
        {email}
      </span>
    </button>
  );
};

export default Login;