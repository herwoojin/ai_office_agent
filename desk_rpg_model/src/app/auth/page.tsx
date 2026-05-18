"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import CityScapeBackground from "@/components/CityScapeBackground";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";

const isComingSoon = process.env.NEXT_PUBLIC_COMING_SOON === "true";

export default function AuthPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const t = useT();

  // Firebase Email login state
  const [firebaseMode, setFirebaseMode] = useState<"login" | "register">("login");
  const [firebaseEmail, setFirebaseEmail] = useState("");
  const [firebasePassword, setFirebasePassword] = useState("");
  const [firebaseLoading, setFirebaseLoading] = useState(false);
  const [firebaseError, setFirebaseError] = useState("");

  // Local ID/PW (Firebase 우회) login state — AI Office demo addition
  const [localMode, setLocalMode] = useState<"login" | "register">("login");
  const [localId, setLocalId] = useState("");
  const [localNickname, setLocalNickname] = useState("");
  const [localPassword, setLocalPassword] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  async function handleLocalAuth(e: React.FormEvent) {
    e.preventDefault();
    setLocalLoading(true);
    setLocalError("");
    try {
      const endpoint = localMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = localMode === "login"
        ? { loginId: localId, password: localPassword }
        : { loginId: localId, nickname: localNickname || localId, password: localPassword };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }
      router.replace("/characters");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLocalLoading(false);
    }
  }

  useEffect(() => {
    // 1) signInWithRedirect 결과 회수 (Google 팝업이 막힌 경우의 폴백 경로)
    getRedirectResult(firebaseAuth)
      .then(async (result) => {
        if (!result?.user) return;
        try {
          const idToken = await result.user.getIdToken();
          const res = await fetch("/api/auth/firebase", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Firebase bridge failed");
          router.replace("/characters");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Google redirect 로그인 실패");
        }
      })
      .catch(() => {});

    // 2) 이미 cookie 로그인된 경우 바로 /characters
    fetch("/api/characters", { redirect: "manual" })
      .then((res) => {
        if (res.ok) {
          router.replace("/characters");
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        setChecking(false);
      });
  }, [router]);

  // Bridge: send Firebase ID token to backend to get a DeskRPG JWT cookie
  async function bridgeFirebaseToken(idToken: string) {
    const res = await fetch("/api/auth/firebase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Firebase authentication failed");
    }
    return data;
  }

  // Google Sign-In — 팝업 우선, COOP 차단 시 redirect 로 폴백
  async function handleGoogleLogin() {
    setError("");
    setFirebaseError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      try {
        const result = await signInWithPopup(firebaseAuth, provider);
        const idToken = await result.user.getIdToken();
        await bridgeFirebaseToken(idToken);
        router.push("/characters");
        return;
      } catch (popupErr) {
        const m = popupErr instanceof Error ? popupErr.message : "";
        if (m.includes("popup-closed-by-user") || m.includes("cancelled-popup-request")) {
          return; // 사용자가 닫음
        }
        // 팝업 차단/COOP 차단 시 redirect 로 폴백
        if (
          m.includes("popup-blocked")
          || m.includes("popup")
          || m.includes("Cross-Origin-Opener-Policy")
          || m.includes("auth/internal-error")
        ) {
          await signInWithRedirect(firebaseAuth, provider);
          return;
        }
        throw popupErr;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // Firebase Email/Password login or register
  async function handleFirebaseEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setFirebaseError("");
    setError("");
    setFirebaseLoading(true);
    try {
      let userCredential;
      if (firebaseMode === "register") {
        userCredential = await createUserWithEmailAndPassword(firebaseAuth, firebaseEmail, firebasePassword);
      } else {
        userCredential = await signInWithEmailAndPassword(firebaseAuth, firebaseEmail, firebasePassword);
      }
      const idToken = await userCredential.user.getIdToken();
      await bridgeFirebaseToken(idToken);
      router.push("/characters");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      let message = err instanceof Error ? err.message : "Authentication failed";
      if (code === "auth/email-already-in-use") message = "이미 등록된 이메일입니다. 로그인을 시도해주세요.";
      else if (code === "auth/invalid-email") message = "유효하지 않은 이메일 주소입니다.";
      else if (code === "auth/weak-password") message = "비밀번호는 최소 6자 이상이어야 합니다.";
      else if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") message = "이메일 또는 비밀번호가 올바르지 않습니다.";
      else if (code === "auth/too-many-requests") message = "너무 많은 시도입니다. 잠시 후 다시 시도해주세요.";
      setFirebaseError(message);
    } finally {
      setFirebaseLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="theme-web min-h-screen flex items-center justify-center bg-bg text-text">
        {t("auth.checkingAuth")}
      </div>
    );
  }

  return (
    <div className="theme-web min-h-screen relative">
      <CityScapeBackground />

      {/* Language switcher */}
      <div className="fixed top-4 right-4 z-30">
        <LocaleSwitcher />
      </div>

      {/* Login card - centered */}
      <div className="fixed inset-0 flex items-start justify-center pt-[15vh] z-20 pointer-events-none">
        <div className="max-w-[360px] w-[90%] pointer-events-auto">
          {/* Title */}
          <div className="text-center mb-4">
            <h1
              className="font-black text-white font-mono tracking-[10px]"
              style={{
                fontSize: "clamp(28px, 5vw, 42px)",
                textShadow: "0 0 40px rgba(99,102,241,0.3),0 0 80px rgba(99,102,241,0.1),0 2px 4px rgba(0,0,0,0.8)",
              }}
            >
              DeskRPG
            </h1>
            <p
              className="text-[10px] text-primary-light tracking-[6px] mt-1"
              style={{ textShadow: "0 0 12px rgba(129,140,248,0.3)" }}
            >
              {t("auth.heroTagline")}
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              {t("auth.heroSubtitle")}
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-[14px] p-6"
            style={{
              background: "rgba(10,15,30,0.92)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(99,102,241,0.15)",
              boxShadow: "0 8px 48px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.03),inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {isComingSoon ? (
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-5">{t("auth.comingSoon")}</div>
                <a
                  href="https://github.com/dandacompany/deskrpg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block w-full py-2.5 rounded-lg text-white font-semibold text-sm text-center"
                  style={{
                    background: "linear-gradient(135deg,#4f46e5,#6d28d9)",
                    boxShadow: "0 4px 20px rgba(79,70,229,0.4)",
                  }}
                >
                  {t("auth.comingSoonGithub")}
                </a>
              </div>
            ) : (
            <>
            {/* ─── Google Sign-In ─── */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3 rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-all hover:brightness-110 disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #4285F4, #356AC3)",
                boxShadow: "0 4px 16px rgba(66,133,244,0.35)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                <path d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.9055 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" fill="#4285F4"/>
                <path d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8764 40.3801 42.2078L32.6461 36.2111C30.5004 37.675 27.7564 38.5039 24.48 38.5039C18.2285 38.5039 12.9153 34.2798 11.0166 28.6006H3.03467V34.7825C7.10745 42.8868 15.4056 48.0016 24.48 48.0016Z" fill="#34A853"/>
                <path d="M11.0166 28.6006C9.99473 25.6199 9.99473 22.3922 11.0166 19.4115V13.2296H3.03467C-0.371095 20.0112 -0.371095 28.0009 3.03467 34.7825L11.0166 28.6006Z" fill="#FBBC04"/>
                <path d="M24.48 9.49932C27.9016 9.44641 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00161366C15.4055 0.00161366 7.10745 5.11644 3.03467 13.2296L11.0166 19.4115C12.9153 13.7235 18.2285 9.49932 24.48 9.49932Z" fill="#EA4335"/>
              </svg>
              {loading ? "연결 중..." : "Google 계정으로 계속하기"}
            </button>

            {/* AI Office Agents — 이메일/아이디 로그인 섹션 숨김 (Google 만 사용) */}
            {false && (
            <>
            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border"></div>
              <span className="text-xs text-text-dim uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-border"></div>
            </div>

            {/* ─── Firebase Email/Password ─── */}
            <div className="flex rounded-lg overflow-hidden border border-border mb-4">
              <button
                onClick={() => { setFirebaseMode("login"); setFirebaseError(""); }}
                className={`flex-1 py-2.5 text-center text-sm font-semibold transition-colors ${
                  firebaseMode === "login"
                    ? "bg-indigo-600 text-white"
                    : "bg-[#0a0f1e] text-text-dim hover:text-text-secondary"
                }`}
              >
                이메일 로그인
              </button>
              <button
                onClick={() => { setFirebaseMode("register"); setFirebaseError(""); }}
                className={`flex-1 py-2.5 text-center text-sm font-semibold transition-colors ${
                  firebaseMode === "register"
                    ? "bg-indigo-600 text-white"
                    : "bg-[#0a0f1e] text-text-dim hover:text-text-secondary"
                }`}
              >
                이메일 회원가입
              </button>
            </div>

            <form onSubmit={handleFirebaseEmailAuth} className="space-y-3">
              <input
                type="email"
                placeholder="이메일 주소"
                value={firebaseEmail}
                onChange={(e) => setFirebaseEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0a0f1e] text-white rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm placeholder-text-dim"
                required
              />
              <input
                type="password"
                placeholder="비밀번호 (6자 이상)"
                value={firebasePassword}
                onChange={(e) => setFirebasePassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0a0f1e] text-white rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm placeholder-text-dim"
                minLength={6}
                required
              />
              {(firebaseError || error) && (
                <p className="text-danger text-sm">{firebaseError || error}</p>
              )}
              <button
                type="submit"
                disabled={firebaseLoading}
                className="w-full py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50 transition-all hover:brightness-110"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
                }}
              >
                {firebaseLoading
                  ? "처리 중..."
                  : firebaseMode === "login"
                  ? "이메일로 로그인"
                  : "이메일로 회원가입"}
              </button>
            </form>

            {/* Divider 2 */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border"></div>
              <span className="text-xs text-text-dim uppercase tracking-wider">또는 (Firebase 없이)</span>
              <div className="flex-1 h-px bg-border"></div>
            </div>

            {/* ─── 로컬 아이디/비밀번호 (Firebase 우회) ─── */}
            <div className="flex rounded-lg overflow-hidden border border-border mb-4">
              <button
                onClick={() => { setLocalMode("login"); setLocalError(""); }}
                className={`flex-1 py-2.5 text-center text-sm font-semibold transition-colors ${
                  localMode === "login"
                    ? "bg-emerald-600 text-white"
                    : "bg-[#0a0f1e] text-text-dim hover:text-text-secondary"
                }`}
              >
                아이디 로그인
              </button>
              <button
                onClick={() => { setLocalMode("register"); setLocalError(""); }}
                className={`flex-1 py-2.5 text-center text-sm font-semibold transition-colors ${
                  localMode === "register"
                    ? "bg-emerald-600 text-white"
                    : "bg-[#0a0f1e] text-text-dim hover:text-text-secondary"
                }`}
              >
                아이디 회원가입
              </button>
            </div>

            <form onSubmit={handleLocalAuth} className="space-y-3">
              <input
                type="text"
                placeholder="아이디 (2~50자)"
                value={localId}
                onChange={(e) => setLocalId(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0a0f1e] text-white rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm placeholder-text-dim"
                minLength={2}
                maxLength={50}
                required
                autoComplete="username"
              />
              {localMode === "register" && (
                <input
                  type="text"
                  placeholder="닉네임 (비우면 아이디 사용)"
                  value={localNickname}
                  onChange={(e) => setLocalNickname(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0a0f1e] text-white rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm placeholder-text-dim"
                  maxLength={50}
                />
              )}
              <input
                type="password"
                placeholder="비밀번호 (8자 이상)"
                value={localPassword}
                onChange={(e) => setLocalPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0a0f1e] text-white rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm placeholder-text-dim"
                minLength={8}
                required
                autoComplete={localMode === "login" ? "current-password" : "new-password"}
              />
              {localError && <p className="text-danger text-sm">{localError}</p>}
              <button
                type="submit"
                disabled={localLoading}
                className="w-full py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50 transition-all hover:brightness-110"
                style={{
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  boxShadow: "0 4px 16px rgba(16,185,129,0.3)",
                }}
              >
                {localLoading
                  ? "처리 중..."
                  : localMode === "login"
                  ? "아이디로 로그인"
                  : "아이디로 회원가입"}
              </button>
              <p className="text-xs text-text-dim text-center mt-2">
                💡 Firebase 없이 즉시 사용. 데모용으로 권장.
              </p>
            </form>
            </>
            )}
            {/* end of hidden section */}
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
