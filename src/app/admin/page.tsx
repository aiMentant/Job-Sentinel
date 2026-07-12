"use client";


import React, { useState, useEffect } from "react";
import { 
  Users, 
  ShieldAlert, 
  Trash2, 
  Plus, 
  Key, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Activity, 
  UserPlus, 
  Database 
} from "lucide-react";
import { 
  listAllUsers, 
  saveUser, 
  deleteUser, 
  getActivityLogs 
} from "@/app/actions/adminActions";
import { listAllProfiles } from "@/app/actions/jobActions";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New User Form State
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [newProfileId, setNewProfileId] = useState("default");

  // Password visibility maps
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Password update form states
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [updatedPassword, setUpdatedPassword] = useState("");
  const [updatedProfileId, setUpdatedProfileId] = useState("default");

  async function loadData() {
    setIsLoading(true);
    setError("");
    try {
      const [u, p, logs] = await Promise.all([
        listAllUsers(),
        listAllProfiles(),
        getActivityLogs()
      ]);
      setUsers(u);
      setProfiles(p);
      setActivityLogs(logs);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load admin management data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!newEmail || !newPassword) {
      setError("Email and Password are required.");
      return;
    }

    try {
      const result = await saveUser({
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
        profile_id: newProfileId
      });

      if (result.success) {
        setSuccess(`Successfully added user account ${newEmail}`);
        setNewEmail("");
        setNewPassword("");
        setNewRole("user");
        setNewProfileId("default");
        loadData();
      } else {
        setError(result.error || "Failed to create user account.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create user account.");
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (email === "lwenban@gmail.com") {
      alert("Cannot delete the root admin account.");
      return;
    }

    if (!confirm(`Are you sure you want to delete the user account for ${email}?`)) {
      return;
    }

    setError("");
    setSuccess("");
    try {
      const result = await deleteUser(email);
      if (result.success) {
        setSuccess(`Deleted user account: ${email}`);
        loadData();
      } else {
        setError(result.error || "Failed to delete user account.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete user.");
    }
  };

  const handleUpdatePassword = async (email: string) => {
    if (!updatedPassword) {
      alert("Password cannot be empty.");
      return;
    }

    setError("");
    setSuccess("");
    try {
      // Find existing user fields to preserve
      const existing = users.find(u => u.email === email);
      const result = await saveUser({
        email,
        password: updatedPassword,
        role: existing?.role || "user",
        profile_id: updatedProfileId
      });

      if (result.success) {
        setSuccess(`Account settings updated for ${email}`);
        setEditingEmail(null);
        setUpdatedPassword("");
        loadData();
      } else {
        setError(result.error || "Failed to update operator account settings.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to update operator account settings.");
    }
  };

  const togglePasswordVisibility = (email: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [email]: !prev[email]
    }));
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0a0c] text-white p-8 font-sans">
      {/* Glow backgrounds */}
      <div className="absolute top-10 left-10 w-80 h-80 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5 relative z-10">
        <div>
          <h1 className="text-3xl font-extrabold font-outfit tracking-tight flex items-center gap-3">
            <ShieldAlert className="text-indigo-400 w-8 h-8 animate-pulse" />
            Admin Control Center
          </h1>
          <p className="text-xs text-text-muted mt-1 uppercase tracking-widest font-bold">Manage users, profiles, and audit real-time activity</p>
        </div>
        <button 
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Reload System
        </button>
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold font-sans">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-bold font-sans">
          {success}
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 relative z-10">
        {/* Left/Middle: User Account Management */}
        <div className="xl:col-span-2 space-y-8">
          {/* Active Users Table */}
          <div className="bg-[#0d0d0f]/50 border border-white/10 backdrop-blur-2xl rounded-3xl p-6 shadow-xl">
            <h2 className="text-lg font-bold font-outfit flex items-center gap-2.5 mb-6">
              <Users className="w-5 h-5 text-indigo-400" />
              Active System Operators
            </h2>

            {isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <span className="text-text-muted animate-pulse font-bold text-xs uppercase tracking-widest">Polling Database Cache...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] text-text-muted font-black uppercase tracking-widest">
                      <th className="pb-3 pr-4">Identity / Email</th>
                      <th className="pb-3 pr-4">Access Key</th>
                      <th className="pb-3 pr-4">Role</th>
                      <th className="pb-3 pr-4">Assigned Profile</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.email} className="border-b border-white/5 hover:bg-white/[0.01] transition-all group">
                        {/* Identity */}
                        <td className="py-4 pr-4 font-semibold text-sm text-slate-200">
                          {u.email}
                        </td>
                        {/* Access Key */}
                        <td className="py-4 pr-4 text-xs font-mono text-slate-300">
                          {editingEmail === u.email ? (
                            <div className="flex items-center gap-2">
                              <input 
                                type="text"
                                value={updatedPassword}
                                onChange={(e) => setUpdatedPassword(e.target.value)}
                                placeholder="New password"
                                className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500 w-32 font-mono"
                              />
                              <button 
                                onClick={() => handleUpdatePassword(u.email)}
                                className="bg-emerald-600 hover:bg-emerald-500 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider text-white"
                              >
                                Save
                              </button>
                              <button 
                                onClick={() => setEditingEmail(null)}
                                className="bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider text-white"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>
                                {visiblePasswords[u.email] ? u.password : "••••••••"}
                              </span>
                              <button 
                                onClick={() => togglePasswordVisibility(u.email)}
                                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                              >
                                {visiblePasswords[u.email] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          )}
                        </td>
                        {/* Role */}
                        <td className="py-4 pr-4">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                            u.role === "admin" 
                              ? "bg-indigo-600/10 text-indigo-400 border-indigo-500/20" 
                              : "bg-emerald-600/10 text-emerald-400 border-emerald-500/20"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        {/* Profile ID */}
                        <td className="py-4 pr-4 font-semibold text-xs text-slate-300">
                          {editingEmail === u.email ? (
                            <input
                              type="text"
                              list="profiles-datalist"
                              value={updatedProfileId}
                              onChange={(e) => setUpdatedProfileId(e.target.value)}
                              className="bg-[#0a0a0c] text-white border border-white/10 focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs focus:outline-none w-28 font-semibold"
                              placeholder="Profile ID"
                            />
                          ) : (
                            u.profile_id
                          )}
                        </td>
                        {/* Actions */}
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            {editingEmail !== u.email && (
                              <button
                                onClick={() => {
                                  setEditingEmail(u.email);
                                  setUpdatedPassword(u.password);
                                  setUpdatedProfileId(u.profile_id || "default");
                                }}
                                className="text-text-muted hover:text-white transition-colors cursor-pointer"
                                title="Edit Operator Settings"
                              >
                                <Key className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteUser(u.email)}
                              disabled={u.email === "lwenban@gmail.com"}
                              className="text-text-muted hover:text-rose-400 transition-colors disabled:opacity-30 cursor-pointer"
                              title="Delete Operator Account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Add Account & System Status */}
        <div className="space-y-8">
          {/* Add Account Panel */}
          <div className="bg-[#0d0d0f]/50 border border-white/10 backdrop-blur-2xl rounded-3xl p-6 shadow-xl">
            <h2 className="text-lg font-bold font-outfit flex items-center gap-2.5 mb-6">
              <UserPlus className="w-5 h-5 text-indigo-400" />
              Provision Account
            </h2>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-text-muted uppercase font-black tracking-widest">Operator Email</label>
                <input 
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="operator@email.com"
                  required
                  className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition-all placeholder:text-text-muted/60 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-text-muted uppercase font-black tracking-widest">Access Key</label>
                <input 
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition-all placeholder:text-text-muted/60 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-muted uppercase font-black tracking-widest">Role</label>
                  <select 
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all text-foreground font-bold cursor-pointer"
                  >
                    <option value="user" className="bg-[#0c0c0e]">User</option>
                    <option value="admin" className="bg-[#0c0c0e]">Admin</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-muted uppercase font-black tracking-widest">Assigned Profile</label>
                  <input
                    type="text"
                    list="profiles-datalist"
                    value={newProfileId}
                    onChange={(e) => setNewProfileId(e.target.value)}
                    placeholder="Profile name"
                    className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs focus:outline-none transition-all text-foreground font-bold"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-600/10 cursor-pointer mt-4 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Initialize Account
              </button>
            </form>
          </div>

          {/* System Audit Indicator */}
          <div className="bg-[#0d0d0f]/50 border border-white/10 backdrop-blur-2xl rounded-3xl p-6 shadow-xl">
            <h2 className="text-lg font-bold font-outfit flex items-center gap-2.5 mb-6">
              <Database className="w-5 h-5 text-indigo-400" />
              Database Engine
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted font-medium">Cloud Engine:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                  Supabase DB Live
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted font-medium">Synced Profiles count:</span>
                <span className="font-semibold">{profiles.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width Activity Audit Logs Panel */}
      <div className="mt-8 relative z-10">
        <div className="bg-[#0d0d0f]/50 border border-white/10 backdrop-blur-2xl rounded-3xl p-6 shadow-xl">
          <h2 className="text-lg font-bold font-outfit flex items-center gap-2.5 mb-6">
            <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
            Activity Log Tracker
          </h2>

          <div className="h-96 overflow-y-auto border border-white/5 rounded-2xl bg-white/[0.005] scrollbar-thin">
            {activityLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <span className="text-text-muted font-semibold text-xs tracking-widest uppercase animate-pulse">No system interactions logged</span>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {activityLogs.map((log) => (
                  <div key={log.id || log.created_at} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.01] transition-all">
                    <div className="flex items-start gap-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                        log.action.includes("Login") 
                          ? "bg-indigo-600/10 text-indigo-400" 
                          : log.action.includes("Search") 
                            ? "bg-emerald-600/10 text-emerald-400" 
                            : "bg-amber-600/10 text-amber-400"
                      }`}>
                        {log.action.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{log.email}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-white/5 border-white/10 text-text-muted">
                            {log.action}
                          </span>
                        </div>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <pre className="text-[10px] text-text-muted mt-1.5 font-mono max-w-2xl overflow-x-auto bg-[#0a0a0c]/80 p-2 rounded-lg border border-white/5">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-text-muted font-semibold md:text-right shrink-0">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <datalist id="profiles-datalist">
        {profiles.map(id => (
          <option key={id} value={id} />
        ))}
      </datalist>
    </div>
  );
}
