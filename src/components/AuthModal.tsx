"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Mail, Lock, Loader2, UserCircle, LogOut, CloudOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/cn";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const reset = () => {
    setEmail("");
    setPassword("");
    setError(null);
    setSuccess(false);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fn = mode === "signin" ? signIn : signUp;
    const { error } = await fn(email.trim(), password);

    setLoading(false);
    if (error) {
      setError(error);
    } else if (mode === "signup") {
      setSuccess(true);
    } else {
      handleClose();
    }
  };

  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            className="w-full max-w-sm bg-[var(--bg)] border border-[var(--border)] rounded-2xl shadow-2xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center">
                  <UserCircle className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-base font-semibold">
                  {mode === "signin" ? "Sign in" : "Create account"}
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-[var(--text-secondary)]">
              {mode === "signin"
                ? "Sign in to sync your tasks to the cloud."
                : "Create a free account to back up your tasks to the cloud."}
            </p>

            {success ? (
              <div className="rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 text-sm text-green-700 dark:text-green-300">
                Check your email to confirm your account, then sign in.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "Min. 6 characters" : "Password"}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-60"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>
            )}

            {!success && (
              <p className="text-center text-xs text-[var(--text-muted)]">
                {mode === "signin" ? "No account?" : "Already have one?"}{" "}
                <button
                  onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
                  className="text-[var(--primary)] hover:underline font-medium"
                >
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </button>
              </p>
            )}

            <div className={cn(
              "flex items-start gap-2 rounded-lg px-3 py-2 text-xs text-[var(--text-muted)]",
              "bg-[var(--bg-card)] border border-[var(--border)]"
            )}>
              <CloudOff className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>The app works fully without an account. Signing in only adds cloud backup.</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}

interface AuthButtonProps {
  className?: string;
}

export function AuthButton({ className }: AuthButtonProps) {
  const { user, signOut } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  if (user) {
    return (
      <>
        <div className="relative">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors text-sm",
              className
            )}
            title={user.email}
          >
            <div className="w-5 h-5 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-[10px] font-bold">
              {user.email?.[0]?.toUpperCase() ?? "U"}
            </div>
          </button>
          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute right-0 top-full mt-1.5 z-40 w-52 bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden"
                >
                  <div className="px-3 py-2.5 border-b border-[var(--border)]">
                    <p className="text-xs font-medium truncate">{user.email}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Cloud sync enabled</p>
                  </div>
                  <button
                    onClick={() => { signOut(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors text-sm text-[var(--text-muted)]",
          className
        )}
        title="Sign in for cloud sync"
      >
        <UserCircle className="w-4 h-4" />
      </button>
      <AuthModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
