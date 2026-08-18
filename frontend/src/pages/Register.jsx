import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {ArrowRight,Eye,EyeOff,AlertCircle,CheckCircle2} from "lucide-react";
import AuthLayout from "../components/AuthLayout";

const inputClass = "w-full rounded-[12px] border border-[#94aaa133] bg-white/3 px-3.5 py-2.5 text-sm text-[#f3f7f5] outline-none placeholder:text-[#cadcd67a] focus:border-[#7aebb0bf] focus:bg-white/5 focus:ring-4 focus:ring-[#4abf7f1f]";

const selectClass = "w-full appearance-none rounded-[12px] border border-[#94aaa133] bg-[#0b2024] px-3.5 py-2.5 text-sm text-[#f3f7f5] outline-none focus:border-[#7aebb0bf] focus:ring-4 focus:ring-[#4abf7f1f]";

// reusable field
const Field = ({label,name,placeholder,value,onChange,error,type = "text",password = false,visible = false,toggle}) => {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-[#ecfef5]">
      <span>{label}</span>
      <div className="relative">
        <input className={`${inputClass} ${password ? "pr-11" : ""}`} type={ password ? visible ? "text" : "password" : type} name={name} placeholder={placeholder} value={value} onChange={onChange} autoComplete={ name === "password" ? "new-password" : name === "confirmPassword"  ? "new-password" : name === "email" ? "email" : "off"}required/>

        {password && (
          <button type="button" onClick={toggle} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#e0efe9d9] hover:text-white" aria-label={visible ? "Hide password" : "Show password"}>
            {visible ? (
              <EyeOff size={17} />
            ) : (
              <Eye size={17} />
            )}
          </button>
        )}

      </div>

      {error && (
        <span className="text-[11px] font-normal text-[#ffafaf]">
          {error}
        </span>
      )}

    </label>
  );
};

const Register = () => {

  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "operator",
    phone: "",
    locationName: "",
    smsAlertsEnabled: true,
  });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  //update form
  const update = (event) => {
    const {name, value, type, checked} = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((current) => ({
      ...current,
      [name]: "",
      form: "",
    }));
    setSuccess("");
  };

  //form validation
  const validate = () => {
    const newErrors = {};
    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
    ) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (
      formData.password.length < 6
    ) {
      newErrors.password = "Minimum 6 characters";
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (
      formData.password !== formData.confirmPassword
    ) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Mobile number is required";
    }
    if (!formData.locationName.trim()) {
      newErrors.locationName = "Location / sector is required";
    }
    return newErrors;
  };

  //submit
  const submit = async (event) => {
    event.preventDefault();
    setErrors({});
    setSuccess("");
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setIsLoading(true);
    try {
      await new Promise((resolve) =>
        setTimeout(resolve, 700)
      );
      const existingUsers = JSON.parse(localStorage.getItem("wildguard_users") || "[]");
      const email = formData.email.trim().toLowerCase();
      const exists = existingUsers.some((user) => user.email === email);
      if (exists) {
        setErrors({
          email: "An account with this email already exists.",
        });
        return;
      }

      //create user
      const newUser = {
        id: `user-${Date.now()}`,
        username: formData.fullName.trim(),
        email,
        role: formData.role,
        phone: formData.phone.trim(),
        locationName: formData.locationName.trim(),
        smsAlertsEnabled: formData.smsAlertsEnabled,
        createdAt: new Date().toISOString(),
        isActive: true,
      };

      //save user to local storage
      localStorage.setItem("wildguard_users",JSON.stringify([ ...existingUsers, newUser, ]));

      /*
       * Demo authentication credentials.
       * Replace this with backend authentication later.
       */

      const credentials =
        JSON.parse(
          localStorage.getItem(
            "wildguard_demo_credentials"
          ) || "[]"
        );

      credentials.push({
        userId: newUser.id,
        email,
        password: formData.password,
      });

      localStorage.setItem(
        "wildguard_demo_credentials",
        JSON.stringify(
          credentials
        )
      );

      setSuccess(
        "Account created successfully!"
      );

      setTimeout(() => {
        navigate("/login", {
          replace: true,
          state: {
            registeredEmail: email,
          },
        });
      }, 800);

    } catch (error) {
      console.error(error);

      setErrors({
        form:
          "Unable to create your account. Please try again.",
      });

    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Create account"
      title="Join WildGuard"
      description="Register to access your operations workspace."
    >
      {/* error handling */}
      {errors.form && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-300">

          <AlertCircle size={16} />

          <span>{errors.form}</span>

        </div>
      )}

      {/* SUCCESS */}

      {success && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">

          <CheckCircle2 size={16} />

          <span>{success}</span>

        </div>
      )}

      {/* REGISTRATION FORM */}

      <form
        onSubmit={submit}
        className="grid grid-cols-1 gap-x-3.5 gap-y-3 sm:grid-cols-2"
      >

        {/* Full Name */}

        <Field
          label="Full name"
          name="fullName"
          placeholder="John Doe"
          value={formData.fullName}
          onChange={update}
          error={errors.fullName}
        />

        {/* Email */}

        <Field
          label="Email address"
          name="email"
          type="email"
          placeholder="you@wildguard.org"
          value={formData.email}
          onChange={update}
          error={errors.email}
        />

        {/* Password */}

        <Field
          label="Password"
          name="password"
          placeholder="Create password"
          value={formData.password}
          onChange={update}
          error={errors.password}
          password
          visible={showPassword}
          toggle={() =>
            setShowPassword(
              (value) => !value
            )
          }
        />

        {/* Confirm Password */}

        <Field
          label="Confirm password"
          name="confirmPassword"
          placeholder="Confirm password"
          value={
            formData.confirmPassword
          }
          onChange={update}
          error={
            errors.confirmPassword
          }
          password
          visible={
            showConfirmPassword
          }
          toggle={() =>
            setShowConfirmPassword(
              (value) => !value
            )
          }
        />

        {/* Mobile */}

        <Field
          label="Mobile number"
          name="phone"
          type="tel"
          placeholder="+91 9876543210"
          value={formData.phone}
          onChange={update}
          error={errors.phone}
        />

        {/* Role */}

        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-[#ecfef5]">

          <span>Select role</span>

          <select
            name="role"
            value={formData.role}
            onChange={update}
            className={selectClass}
          >
            <option value="operator">
              Forest Operator
            </option>

            <option value="landowner">
              Landowner
            </option>

            <option value="village_head">
              Village Head
            </option>
          </select>

        </label>

        {/* Location */}

        <Field
          label="Location / Sector"
          name="locationName"
          placeholder="Sector B3 - Green Valley"
          value={
            formData.locationName
          }
          onChange={update}
          error={
            errors.locationName
          }
        />

        {/* SMS */}

        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[#8cb3a426] bg-white/3 px-3 py-2.5">

          <input
            type="checkbox"
            name="smsAlertsEnabled"
            checked={
              formData.smsAlertsEnabled
            }
            onChange={update}
            className="size-4 accent-emerald-400"
          />

          <div>
            <span className="block text-xs font-semibold text-[#ecfef5]">
              Enable SMS alerts
            </span>

            <span className="block text-[10px] font-normal text-[#cce4dcb3]">
              Receive wildlife threat
              notifications.
            </span>
          </div>

        </label>

        {/* Submit */}

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-linear-to-br from-[#7fe6b4] to-[#38d59d] px-4 py-2.5 text-sm font-extrabold text-[#062b22] shadow-[0_12px_28px_rgba(56,213,157,.25)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
        >

          {isLoading ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-[#062b22] border-t-transparent" />
              Creating account...
            </>
          ) : (
            <>
              Create account
              <ArrowRight size={17} />
            </>
          )}

        </button>

      </form>

      {/* LOGIN LINK */}

      <div className="mt-4 flex justify-center gap-2 text-xs text-[#cce4dcb3]">

        <span>
          Already have an account?
        </span>

        <button
          type="button"
          onClick={() =>
            navigate("/login")
          }
          className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-[#d7f7e4] hover:text-[#7fe6b4]"
        >
          Sign in here
        </button>

      </div>

    </AuthLayout>
  );
};

export default Register;