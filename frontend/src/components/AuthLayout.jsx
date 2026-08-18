import { ShieldCheck } from "lucide-react";

const AuthLayout = ({ children, eyebrow, title, description,}) => {
  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(76,175,120,.18),transparent_28%),linear-gradient(135deg,#071a1d_0%,#0d2a2d_45%,#0a1418_100%)] p-4 sm:p-6 ">

      <div className="mx-auto grid h-full max-h-190 w-full max-w-270 overflow-hidden rounded-[28px] border border-[#8cb3a426] bg-[#091c22e6] shadow-[0_30px_80px_rgba(0,0,0,.45)] md:grid-cols-[1.15fr_.85fr] mt-10">

        {/* LEFT BRANDING PANEL */}

        <div className="hidden flex-col justify-center gap-7 bg-[linear-gradient(160deg,rgba(16,53,52,.96),rgba(9,25,29,.96)),linear-gradient(135deg,rgba(88,185,127,.25),transparent)] px-8 py-10 md:flex md:px-10 lg:px-12">

          {/* Logo */}

          <div className="grid size-16 place-items-center rounded-[18px] bg-linear-to-br from-[#6fe3a8] to-[#2ed5a4] text-[#07231d] shadow-[0_16px_36px_rgba(46,213,164,.3)]">

            <ShieldCheck size={30} />

          </div>

          {/* Branding */}

          <div>

            <p className="mb-2.5 text-[.72rem] font-bold uppercase tracking-[.18em] text-[#d8f6e9]">
              Wildlife protection dashboard
            </p>

            <h1 className="max-w-105 text-[clamp(2.2rem,4vw,3.5rem)] font-bold leading-[1.05] tracking-[-.04em] text-[#f5fffb]">
              WILDGUARD{" "} <span className="text-emerald-400"> AI </span>
            </h1>

            <p className="mt-4 max-w-107.5 leading-[1.7] text-[#d2e2dccc]">
              Monitor sightings, field alerts,
              and safety operations in real time
              across every protected zone.
            </p>

          </div>

        </div>

        {/* RIGHT AUTH PANEL */}

        <div className="flex min-h-0 flex-col justify-center overflow-hidden bg-[#051012b3] px-5 py-6 sm:px-8 md:px-9 lg:px-10">

          <div className="mb-5 shrink-0">

            <p className="mb-2 text-[.72rem] font-bold uppercase tracking-[.18em] text-[#7fe6b4]">
              {eyebrow}
            </p>

            <h2 className="mb-2 text-[clamp(1.9rem,2vw,2.5rem)] font-bold tracking-[-.04em] text-[#f5fffb]">
              {title}
            </h2>

            <p className="leading-[1.6] text-[#d2e2dccc]">
              {description}
            </p>
          </div>

          {/* Page-specific form */}
          {children}
        </div>
      </div>
    </div>
  );
};


const Feature = ({ title, description,}) => {
  return (
    <div className="rounded-2xl border border-[#b4e4cd1f] bg-white/4 px-4 py-3.5">
      <strong className="block text-sm text-[#edfdf5]">{title}</strong>
      <span className="mt-1 block text-xs leading-5 text-[#d2e2dcb3]"> {description}</span>
    </div>
  );
};

export default AuthLayout;