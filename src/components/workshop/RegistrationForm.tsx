"use client";

import { useState } from "react";

interface FormData {
  name: string;
  email: string;
  phone: string;
  countryCode: string;
  role: string;
  organization: string;
}

interface Errors {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}

export default function RegistrationForm() {
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    countryCode: "+91",
    role: "",
    organization: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  const set = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validate = (): boolean => {
    const e: Errors = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Please enter a valid email address";
    if (!form.phone.trim()) e.phone = "Phone number is required";
    else if (!/^\d{7,15}$/.test(form.phone.replace(/\s/g, "")))
      e.phone = "Please enter a valid phone number";
    if (!form.role) e.role = "Please select an option";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError("");
    try {
      const res = await fetch("/api/ai-workshop/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: `${form.countryCode}${form.phone.trim()}`,
          role: form.role,
          organization: form.organization.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setShowSuccess(true);
      let count = 3;
      const interval = setInterval(() => {
        count -= 1;
        setRedirectCountdown(count);
        if (count <= 0) {
          clearInterval(interval);
          const whatsappUrl =
            process.env.NEXT_PUBLIC_WHATSAPP_LINK ||
            "https://chat.whatsapp.com/LDUvHRIlb5dGHpDJLueR9i?s=cl&p=a&mlu=0&amv=0";
          window.location.href = whatsappUrl;
        }
      }, 1000);
    } catch {
      setApiError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const getInputClass = (hasError?: boolean) => {
    const base =
      "w-full px-4 py-3 bg-white border rounded-xl text-base sm:text-sm font-semibold text-gray-900 placeholder-gray-500 focus:outline-none transition-all duration-200 shadow-sm";
    return hasError
      ? `${base} border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10`
      : `${base} border-gray-400 focus:border-[#e16213] focus:ring-4 focus:ring-orange-500/10`;
  };

  const getRoleSelectClass = (hasError?: boolean, hasValue?: boolean) => {
    const base = `w-full px-4 py-3 bg-white border rounded-xl text-base sm:text-sm font-semibold focus:outline-none transition-all duration-200 cursor-pointer shadow-sm ${
      hasValue ? "text-gray-900" : "text-gray-500"
    }`;
    return hasError
      ? `${base} border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10`
      : `${base} border-gray-400 focus:border-[#e16213] focus:ring-4 focus:ring-orange-500/10`;
  };

  const getPhoneContainerClass = (hasError?: boolean) => {
    const base =
      "relative flex items-center bg-white border rounded-xl overflow-hidden transition-all duration-200 shadow-sm w-full";
    return hasError
      ? `${base} border-red-400 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-500/10`
      : `${base} border-gray-400 focus-within:border-[#e16213] focus-within:ring-4 focus-within:ring-orange-500/10`;
  };

  return (
    <>
      <style>{`
        @keyframes form-glow {
          0%, 100% {
            box-shadow:
              0 0 0 1px rgba(225,98,19,0.12),
              0 0 18px 4px rgba(225,98,19,0.10),
              0 0 40px 8px rgba(232,67,147,0.07),
              0 8px 32px rgba(0,0,0,0.04);
          }
          50% {
            box-shadow:
              0 0 0 1px rgba(232,67,147,0.15),
              0 0 24px 6px rgba(232,67,147,0.12),
              0 0 48px 12px rgba(225,98,19,0.08),
              0 8px 32px rgba(0,0,0,0.04);
          }
        }

        /* Button: very light border glow cycling orange ↔ pink */
        @keyframes btn-border-glow {
          0%, 100% {
            box-shadow:
              0 0 0 1.5px rgba(225,98,19,0.45),
              0 0 7px 1px rgba(225,98,19,0.14);
          }
          50% {
            box-shadow:
              0 0 0 1.5px rgba(232,67,147,0.45),
              0 0 7px 1px rgba(232,67,147,0.14);
          }
        }

        .register-btn {
          background: linear-gradient(to right, #e16213, #e84393);
          animation: btn-border-glow 2.8s ease-in-out infinite;
          transition: transform 0.18s ease, filter 0.18s ease;
        }
        .register-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          filter: brightness(1.06);
        }
        .register-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .register-btn:disabled {
          animation: none;
          opacity: 0.65;
          cursor: not-allowed;
        }
      `}</style>
      <form onSubmit={handleSubmit} className="w-full max-w-170 mx-auto px-4">
        <div
          className="bg-white rounded-2xl p-5 sm:p-10"
          style={{
            border: "1px solid rgba(225,98,19,0.15)",
            animation: "form-glow 3s ease-in-out infinite",
          }}
        >
          <Row label="Full Name" required error={errors.name}>
            <input
              type="text"
              placeholder="Enter your full name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={getInputClass(!!errors.name)}
            />
          </Row>

          <Row label="Email Address" required error={errors.email}>
            <input
              type="email"
              placeholder="Enter your email address"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={getInputClass(!!errors.email)}
            />
          </Row>

          <Row label="Phone No." required error={errors.phone}>
            <div className={getPhoneContainerClass(!!errors.phone)}>
              <select
                value={form.countryCode}
                onChange={(e) => set("countryCode", e.target.value)}
                className="bg-transparent border-0 pl-3 pr-7 py-3 text-base sm:text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer shrink-0 appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%234b5563' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundPosition: "right 6px center",
                  backgroundSize: "16px",
                  backgroundRepeat: "no-repeat",
                }}
              >
                <option value="+91" className="font-semibold text-gray-900">🇮🇳 +91</option>
                <option value="+1" className="font-semibold text-gray-900">🇺🇸 +1</option>
                <option value="+44" className="font-semibold text-gray-900">🇬🇧 +44</option>
                <option value="+971" className="font-semibold text-gray-900">🇦🇪 +971</option>
                <option value="+966" className="font-semibold text-gray-900">🇸🇦 +966</option>
                <option value="+65" className="font-semibold text-gray-900">🇸🇬 +65</option>
                <option value="+60" className="font-semibold text-gray-900">🇲🇾 +60</option>
                <option value="+92" className="font-semibold text-gray-900">🇵🇰 +92</option>
                <option value="+880" className="font-semibold text-gray-900">🇧🇩 +880</option>
                <option value="+977" className="font-semibold text-gray-900">🇳🇵 +977</option>
                <option value="+94" className="font-semibold text-gray-900">🇱🇰 +94</option>
                <option value="+61" className="font-semibold text-gray-900">🇦🇺 +61</option>
                <option value="+64" className="font-semibold text-gray-900">🇳🇿 +64</option>
                <option value="+33" className="font-semibold text-gray-900">🇫🇷 +33</option>
                <option value="+49" className="font-semibold text-gray-900">🇩🇪 +49</option>
                <option value="+27" className="font-semibold text-gray-900">🇿🇦 +27</option>
                <option value="+234" className="font-semibold text-gray-900">🇳🇬 +234</option>
                <option value="+55" className="font-semibold text-gray-900">🇧🇷 +55</option>
                <option value="+353" className="font-semibold text-gray-900">🇮🇪 +353</option>
                <option value="+86" className="font-semibold text-gray-900">🇨🇳 +86</option>
                <option value="+82" className="font-semibold text-gray-900">🇰🇷 +82</option>
                <option value="+62" className="font-semibold text-gray-900">🇮🇩 +62</option>
                <option value="+66" className="font-semibold text-gray-900">🇹🇭 +66</option>
                <option value="+63" className="font-semibold text-gray-900">🇵🇭 +63</option>
                <option value="+84" className="font-semibold text-gray-900">🇻🇳 +84</option>
                <option value="+90" className="font-semibold text-gray-900">🇹🇷 +90</option>
                <option value="+20" className="font-semibold text-gray-900">🇪🇬 +20</option>
              </select>
              <div className="w-px h-6 bg-gray-300 shrink-0" />
              <input
                type="tel"
                placeholder="Enter your phone number"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value.replace(/[^0-9]/g, ""))}
                className="bg-transparent border-0 w-full pl-3.5 pr-4 py-3 text-base sm:text-sm font-semibold text-gray-900 placeholder-gray-500 focus:outline-none"
              />
            </div>
          </Row>

          <Row label="I am:" required error={errors.role}>
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              className={getRoleSelectClass(!!errors.role, !!form.role)}
            >
              <option value="" disabled className="font-semibold text-gray-500">Select an option</option>
              <option value="Student" className="font-semibold text-gray-950">Student</option>
              <option value="Professional" className="font-semibold text-gray-950">Professional</option>
            </select>
          </Row>

          <Row label="College / Company">
            <input
              type="text"
              placeholder="Enter your college or company name (optional)"
              value={form.organization}
              onChange={(e) => set("organization", e.target.value)}
              className={getInputClass()}
            />
          </Row>

          {apiError && (
            <div className="mt-5 p-3.5 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-sm text-center font-medium leading-relaxed">
                {apiError}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="register-btn w-full mt-5 sm:mt-7 py-3.5 text-white text-base font-semibold rounded-full cursor-pointer"
          >
            {loading ? "Registering..." : "Register Now"}
          </button>
        </div>
      </form>

      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm px-4">
          <style>{`
            @keyframes modal-pop {
              0% { transform: scale(0.95) translateY(10px); opacity: 0; }
              100% { transform: scale(1) translateY(0); opacity: 1; }
            }
            .animate-pop { animation: modal-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
          `}</style>
          <div className="bg-white border border-gray-200 rounded-3xl p-8 sm:p-10 shadow-2xl max-w-105 w-full text-center relative animate-pop">
            <span className="text-6xl block mb-5 select-none">🎉</span>
            <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-3">
              Registration Successful!
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-1.5">
              Thank you for registering.
            </p>
            <p className="text-gray-500 text-[12.5px] leading-relaxed mb-6 font-medium">
              We&apos;ve sent your webinar details to your email. (Please check your Spam or Promotions folders if you don&apos;t see it).
            </p>
            <div className="mt-4 py-2.5 px-4 bg-green-50 border border-green-200/60 rounded-xl inline-flex items-center gap-2 select-none">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
              <span className="text-xs text-green-700 font-semibold tracking-wide">
                Redirecting to WhatsApp in{" "}
                <strong className="text-green-800 text-sm font-bold">{redirectCountdown}s</strong>...
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface RowProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

function Row({ label, required, error, children }: RowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-6 mb-4.5 sm:mb-5.5 w-full">
      <label className="text-[13.5px] font-semibold text-gray-800 w-full sm:w-35 shrink-0 sm:whitespace-nowrap text-left mb-0.5 sm:mb-0">
        {label}
        {required && <span className="text-red-500 ml-1 font-bold">*</span>}
      </label>
      <div className="w-full sm:flex-1 min-w-0">
        {children}
        {error && (
          <p className="text-red-500 text-xs mt-1.5 font-semibold tracking-wide">{error}</p>
        )}
      </div>
    </div>
  );
}
