"use client";

import React, { useState, useEffect } from "react";
import { 
  Search,
  MoreHorizontal, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Mail,
  Calendar,
  Trash2,
  FileText,
  Edit2
} from "lucide-react";
import { fetchJobs, updateJobStatus, deleteJob, generateCoverLetter, bulkDeleteJobs } from "@/app/actions/jobActions";

const statusConfig = {
  new: { icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10", label: "Found" },
  reviewed: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10", label: "Reviewed" },
  applied: { icon: Calendar, color: "text-indigo-400", bg: "bg-indigo-400/10", label: "Applied" },
  rejected: { icon: XCircle, color: "text-red-400", bg: "bg-red-400/10", label: "Rejected" },
  interview: { icon: Mail, color: "text-purple-400", bg: "bg-purple-400/10", label: "Interview" },
};

export default function ApplicationsPage() {
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    const data = await fetchJobs();
    // Only show "Actioned" jobs in the Submission Log
    const actionedStatuses = ['applied', 'interview', 'rejected', 'ready', 'offered'];
    const filtered = data.filter((j: any) => actionedStatuses.includes(j.status));
    setJobs(filtered);
    setIsLoading(false);
  };


  const handleStatusUpdate = async (id: string, status: string) => {
    await updateJobStatus(id, status as any);
    loadJobs();
    setActiveMenu(null);
  };

  const handleDelete = async () => {
    if (!jobToDelete) return;
    await deleteJob(jobToDelete);
    await loadJobs();
    setJobToDelete(null);
    setActiveMenu(null);
  };

  const handleTailor = async (id: string) => {
    const letter = await generateCoverLetter(id);
    alert("Tailored Cover Letter Generated:\n\n" + letter);
    setActiveMenu(null);
  };

  const toggleSelectAll = () => {
    if (selectedJobs.length === jobs.length) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(jobs.map(j => j.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedJobs.includes(id)) {
      setSelectedJobs(selectedJobs.filter(sid => sid !== id));
    } else {
      setSelectedJobs([...selectedJobs, id]);
    }
  };

  const handleBulkDelete = async () => {
    await bulkDeleteJobs(selectedJobs);
    setSelectedJobs([]);
    await loadJobs();
    setShowBulkDeleteModal(false);
  };

  return (
    <>
      <div className="p-8 space-y-8">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold font-outfit">Submission Log</h2>
            <p className="text-slate-400 mt-1">Audit trail of all your manual and automated job applications.</p>
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary">Export History</button>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-4 top-3 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search by company, role or location..." 
              className="input-field w-full pl-12 text-sm" 
            />
          </div>
          
          {selectedJobs.length > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
              <span className="text-xs font-bold text-indigo-400 mr-2">{selectedJobs.length} selected</span>
              <button className="btn-secondary py-1.5 px-3 text-xs border-indigo-500/30 text-indigo-400">Mark Interviewing</button>
              <button 
                onClick={() => setShowBulkDeleteModal(true)}
                className="btn-secondary py-1.5 px-3 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <div className="glass-card overflow-hidden !p-0 border-white/5">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/5 text-[10px] uppercase font-bold tracking-widest text-slate-500 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500/50"
                    checked={jobs.length > 0 && selectedJobs.length === jobs.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Job / Company</th>
                <th className="px-6 py-4">Match</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Applied</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={7} className="p-12 text-center text-slate-500">Loading your applications...</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-slate-500">No applications found. Start a search to find roles!</td></tr>
              ) : jobs.map((job) => {
                const config = statusConfig[job.status as keyof typeof statusConfig] || statusConfig.new;
                const isSelected = selectedJobs.includes(job.id);
                const isMenuOpen = activeMenu === job.id;

                return (
                  <tr key={job.id} className={`transition-colors group ${isSelected ? 'bg-indigo-600/5' : 'hover:bg-white/[0.02]'}`}>
                    <td className="px-6 py-4 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500/50"
                        checked={isSelected}
                        onChange={() => toggleSelect(job.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full ${config.bg} ${config.color} text-[10px] font-bold uppercase`}>
                        <config.icon className="w-3 h-3" />
                        {config.label}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-slate-200 group-hover:text-white transition-colors">{job.title}</p>
                        <p className="text-xs text-slate-500">{job.company}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-emerald-400">{job.score}%</span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {job.location}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(job.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <div className="flex items-center justify-end gap-2">
                        <a href={job.url} target="_blank" className="p-2 hover:bg-white/5 rounded-lg transition-all text-slate-500 hover:text-white">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button 
                          onClick={() => setActiveMenu(isMenuOpen ? null : job.id)}
                          className={`p-2 rounded-lg transition-all ${isMenuOpen ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div className="absolute right-6 top-14 w-56 glass-card !p-2 z-50 shadow-2xl border-white/10 text-left">
                          <button onClick={() => handleTailor(job.id)} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 rounded-lg transition-colors">
                            <FileText className="w-4 h-4 text-indigo-400" />
                            Tailor Cover Letter
                          </button>
                          <button className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 rounded-lg transition-colors">
                            <Edit2 className="w-4 h-4 text-slate-400" />
                            Edit Job Details
                          </button>
                          <div className="h-px bg-white/5 my-1" />
                          <p className="px-3 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-widest">Update Status</p>
                          <button onClick={() => handleStatusUpdate(job.id, 'applied')} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 rounded-lg transition-colors">
                            <Calendar className="w-4 h-4 text-indigo-400" />
                            Mark as Applied
                          </button>
                          <button onClick={() => handleStatusUpdate(job.id, 'interview')} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 rounded-lg transition-colors">
                            <Mail className="w-4 h-4 text-purple-400" />
                            Mark as Interviewing
                          </button>
                          <button onClick={() => handleStatusUpdate(job.id, 'rejected')} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 rounded-lg transition-colors">
                            <XCircle className="w-4 h-4 text-red-400" />
                            Mark as Rejected
                          </button>
                          <div className="h-px bg-white/5 my-1" />
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setJobToDelete(job.id);
                            }} 
                            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete Entry
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Single Delete Confirmation */}
        {jobToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="glass-card w-full max-w-md p-8 space-y-6 border-red-500/30">
              <div className="flex items-center gap-4 text-red-400">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-xl">Delete Log Entry?</h3>
                  <p className="text-xs text-slate-500">This audit trail item will be permanently removed.</p>
                </div>
              </div>
              
              <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl space-y-2">
                <p className="text-sm text-slate-300 font-medium">Deleting record for:</p>
                <p className="text-lg font-black text-white truncate">{jobs.find(j => j.id === jobToDelete)?.title || "Unknown Job"}</p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setJobToDelete(null)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-sm transition-all">Cancel</button>
                <button onClick={handleDelete} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-red-600/20">Delete Entry</button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation */}
        {showBulkDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="glass-card w-full max-w-md p-8 space-y-6 border-red-500/30">
              <div className="flex items-center gap-4 text-red-400">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-xl">Bulk Delete {selectedJobs.length} Entries?</h3>
                  <p className="text-xs text-slate-500">This will purge multiple records from your audit log.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button onClick={() => setShowBulkDeleteModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-sm transition-all">Cancel</button>
                <button onClick={handleBulkDelete} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-red-600/20">Delete All selected</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
