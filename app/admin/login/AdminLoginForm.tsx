// app/admin/login/AdminLoginForm.tsx
"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { adminLogin, type FormState } from "../actions";

export default function AdminLoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(adminLogin, {});

  return (
    <div className="auth-card">
      <p className="admin-badge">Nova Edge admin</p>
      <h1>Admin login</h1>
      <p className="auth-sub">For the Nova Edge team. Customers log in on the main site.</p>

      <form action={action} className="form-stack">
        <label className="field-group">
          <span className="panel-label">Admin email</span>
          <input className="field" type="email" name="email" required autoComplete="username" />
        </label>
        <label className="field-group">
          <span className="panel-label">Password</span>
          <input className="field" type="password" name="password" required autoComplete="current-password" />
        </label>
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        <button type="submit" className="btn btn-lg btn-block" disabled={pending}>
          {pending && <Loader2 size={18} className="spin" />} Log in
        </button>
      </form>
    </div>
  );
}
