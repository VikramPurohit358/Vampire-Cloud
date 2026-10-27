'use client';

import { useEffect, useState } from 'react';
import type { AdminSession, EnterpriseInvite, BillingTransaction } from '@/app/types';
import { fmt, shortWallet, getApiBaseUrl } from './utils';

interface Props {
  session: AdminSession;
  onLogout: () => void;
}

export function AdminPortal({ session, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<'invites' | 'billing' | 'clients' | 'contributors'>('invites');

  // Accounts state
  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [invites, setInvites] = useState<EnterpriseInvite[]>([]);
  const [billingList, setBillingList] = useState<BillingTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Invitation creation form state
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [serviceTier, setServiceTier] = useState<'Enterprise Dedicated' | 'Scale Compute' | 'Research Tier'>('Enterprise Dedicated');
  const [allocatedCredits, setAllocatedCredits] = useState(50000);
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<EnterpriseInvite | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Billing credit allocation form state (Verified purchase orders)
  const [billingCompanyId, setBillingCompanyId] = useState('');
  const [paymentGateway, setPaymentGateway] = useState<'Stripe Corporate Invoicing' | 'ACH Wire Transfer' | 'USDC Crypto Escrow'>('Stripe Corporate Invoicing');
  const [purchaseAmountUsd, setPurchaseAmountUsd] = useState(12500);
  const [allocatingCredits, setAllocatingCredits] = useState(50000);
  const [billingSubmitting, setBillingSubmitting] = useState(false);
  const [billingFeedback, setBillingFeedback] = useState<string | null>(null);

  const fetchRegistry = async () => {
    setLoading(true);
    try {
      const api = getApiBaseUrl();
      const [accRes, invRes, billRes] = await Promise.all([
        fetch(`${api}/api/admin/accounts`, {
          headers: { 'x-admin-key': 'vampire-admin-secret-2026' },
        }),
        fetch(`${api}/api/admin/invites`, {
          headers: { 'x-admin-key': 'vampire-admin-secret-2026' },
        }),
        fetch(`${api}/api/company/billing`),
      ]);

      const [accData, invData, billData] = await Promise.all([
        accRes.json(),
        invRes.json(),
        billRes.json(),
      ]);

      if (accData.ok) {
        setCompanies(accData.companies || []);
        setUsers(accData.users || []);
        if (accData.companies?.length > 0 && !billingCompanyId) {
          setBillingCompanyId(accData.companies[0].companyId || accData.companies[0]._id);
        }
      }
      if (invData.ok) {
        setInvites(invData.invites || []);
      }
      if (billData.ok) {
        setBillingList(billData.history || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistry();
  }, []);

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteFeedback(null);
    setInviteSuccess(null);

    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/admin/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'vampire-admin-secret-2026',
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          email: email.trim(),
          contactPerson: contactPerson.trim() || 'Director of Compute',
          serviceTier,
          allocatedCredits: Number(allocatedCredits),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setInviteSuccess(data.invite);
        setCompanyName('');
        setEmail('');
        setContactPerson('');
        fetchRegistry();
      } else {
        setInviteFeedback(data.error || 'Failed to generate invitation link');
      }
    } catch {
      setInviteFeedback('Could not contact master invitation service');
    } finally {
      setInviting(false);
    }
  };

  const handleRecordBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingCompanyId) return;
    setBillingSubmitting(true);
    setBillingFeedback(null);

    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/admin/billing/credit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'vampire-admin-secret-2026',
        },
        body: JSON.stringify({
          companyId: billingCompanyId,
          type: paymentGateway.includes('Crypto') ? 'crypto_escrow' : 'fiat_invoice',
          gateway: paymentGateway,
          amountUsd: Number(purchaseAmountUsd),
          creditsAllocated: Number(allocatingCredits),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBillingFeedback(`Successfully recorded ${paymentGateway} purchase. Credited ${fmt(data.transaction.creditsAllocated)} VAMP compute units.`);
        fetchRegistry();
      } else {
        setBillingFeedback(data.error || 'Failed to record billing order');
      }
    } catch {
      setBillingFeedback('Could not contact settlement accounting ledger');
    } finally {
      setBillingSubmitting(false);
    }
  };

  const copyInviteUrl = (token: string) => {
    const url = `${window.location.origin}/invite?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Root Infrastructure & Governance Command
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Authenticated as <strong className="text-slate-200">{session.name}</strong> ({session.email}) · Master Authority
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-purple-500/10 border border-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-300">
            ROLE: ROOT ADMIN
          </span>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Admin Sub-Navigation */}
      <div className="flex gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('invites')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === 'invites'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          Secure Enterprise Onboarding ({invites.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('billing')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === 'billing'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          Tokenomics & Billing Ledger ({billingList.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('clients')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === 'clients'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          Enterprise Clients ({companies.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('contributors')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === 'contributors'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          Contributors ({users.length})
        </button>
      </div>

      {/* ─── TAB 1: SECURE ENTERPRISE ONBOARDING & INVITATIONS ─── */}
      {activeTab === 'invites' && (
        <div className="grid gap-6 lg:grid-cols-12">
          
          {/* Invitation Generator (7 cols) */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-7">
            <h2 className="text-base font-semibold text-slate-100 mb-1">
              Issue Enterprise Onboarding Invitation
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Enterprise clients onboard through cryptographic invitation links. The client sets up their own credentials and 2FA.
            </p>

            {inviteFeedback && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 mb-4">
                {inviteFeedback}
              </div>
            )}

            {inviteSuccess && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 mb-4 space-y-2">
                <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Invitation Link Generated for {inviteSuccess.companyName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/invite?token=${inviteSuccess.inviteToken}`}
                    className="flex-1 rounded border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs font-mono text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => copyInviteUrl(inviteSuccess.inviteToken)}
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500 transition"
                  >
                    {copiedLink ? 'Copied Link' : 'Copy Link'}
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleGenerateInvite} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Organization / Entity Name
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. OpenAI Research Labs"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Authorized Representative
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Dr. Arthur Miller"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Official Corporate Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="procurement@organization.com"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Service Level Agreement Tier
                  </label>
                  <select
                    value={serviceTier}
                    onChange={(e) => setServiceTier(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Enterprise Dedicated">Enterprise Dedicated (99.9% SLA)</option>
                    <option value="Scale Compute">Scale Compute (Spot Priority)</option>
                    <option value="Research Tier">Research Tier (Academic / Non-profit)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Initial Verified Credit Allocation (VAMP Units)
                </label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  required
                  value={allocatedCredits}
                  onChange={(e) => setAllocatedCredits(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={inviting}
                className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-600/20 transition active:scale-[0.99] disabled:opacity-50"
              >
                {inviting ? 'Generating Cryptographic Invitation…' : 'Generate Secure Onboarding Token →'}
              </button>
            </form>
          </section>

          {/* Active Invitations Ledger (5 cols) */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-5 flex flex-col">
            <h2 className="text-base font-semibold text-slate-100 mb-1">
              Active Corporate Invitations
            </h2>
            <p className="text-xs text-slate-400 mb-3">
              Cryptographically verified onboarding tokens and status.
            </p>

            {invites.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center rounded-xl border border-slate-800/80 bg-slate-950/40 min-h-[220px]">
                <div className="relative mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/70 border border-slate-700/60 shadow-lg">
                  {/* Monochromatic pending file / token SVG illustration */}
                  <svg className="w-7 h-7 text-slate-300 stroke-[1.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/20 border border-blue-500/40 text-[9px] text-blue-300 font-mono">
                    0
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-slate-200">
                  No active onboarding tokens pending
                </h3>
                <p className="mt-1 text-[11px] text-slate-400 max-w-xs leading-relaxed">
                  Cryptographically signed enterprise invitation links will appear here once generated for authorized corporate onboarding.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto">
                {invites.map((inv) => (
                  <div
                    key={inv.id || inv.inviteToken}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-semibold text-xs text-slate-200 block">{inv.companyName}</span>
                        <span className="font-mono text-[11px] text-slate-400">{inv.email}</span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          inv.status === 'accepted'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {inv.status === 'accepted' ? 'Accepted' : 'Pending Link'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
                      <span>Tier: {inv.serviceTier?.split(' ')[0]}</span>
                      <button
                        type="button"
                        onClick={() => copyInviteUrl(inv.inviteToken)}
                        className="text-blue-400 hover:text-blue-300 font-sans text-xs"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      )}

      {/* ─── TAB 2: TOKENOMICS & BILLING LEDGER ─── */}
      {activeTab === 'billing' && (
        <div className="grid gap-6 lg:grid-cols-12">
          
          {/* Purchase Order Entry (5 cols) */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-5">
            <h2 className="text-base font-semibold text-slate-100 mb-1">
              Record Verified Purchase Order
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Allocate compute credits backed by fiat invoicing or crypto smart contract escrow.
            </p>

            {billingFeedback && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-300 mb-4">
                {billingFeedback}
              </div>
            )}

            <form onSubmit={handleRecordBilling} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Enterprise Client
                </label>
                <select
                  value={billingCompanyId}
                  onChange={(e) => setBillingCompanyId(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                >
                  {companies.map((c) => (
                    <option key={c.companyId || c._id} value={c.companyId || c._id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payment / Settlement Gateway
                </label>
                <select
                  value={paymentGateway}
                  onChange={(e) => setPaymentGateway(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="Stripe Corporate Invoicing">Stripe Corporate Invoicing (Credit Card / Wire)</option>
                  <option value="ACH Wire Transfer">ACH Wire Transfer (Net 30 Verified)</option>
                  <option value="USDC Crypto Escrow">USDC Crypto Escrow (Base / Arbitrum L2)</option>
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Invoice Amount (USD)
                  </label>
                  <input
                    type="number"
                    min={500}
                    step={100}
                    required
                    value={purchaseAmountUsd}
                    onChange={(e) => setPurchaseAmountUsd(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Credits Credited (VAMP)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    required
                    value={allocatingCredits}
                    onChange={(e) => setAllocatingCredits(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={billingSubmitting || !billingCompanyId}
                className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-semibold text-white shadow transition disabled:opacity-50"
              >
                {billingSubmitting ? 'Recording Settlement…' : 'Record Purchase & Issue Credits →'}
              </button>
            </form>
          </section>

          {/* Billing Ledger History (7 cols) */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-7">
            <h2 className="text-base font-semibold text-slate-100 mb-1">
              Verified Settlement Ledger
            </h2>
            <p className="text-xs text-slate-400 mb-3">
              Auditable purchase orders, gateway payment receipts, and smart contract transactions.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400 font-medium">
                  <tr>
                    <th className="pb-2">Tx Hash</th>
                    <th className="pb-2">Gateway</th>
                    <th className="pb-2 text-right">USD Amount</th>
                    <th className="pb-2 text-right">Credits Allocated</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                  {billingList.map((tx) => (
                    <tr key={tx.id || tx.referenceHash} className="hover:bg-slate-950/40">
                      <td className="py-2.5 text-blue-400 truncate max-w-[100px]" title={tx.referenceHash}>
                        {tx.referenceHash.slice(0, 8)}…{tx.referenceHash.slice(-4)}
                      </td>
                      <td className="py-2.5 font-sans text-slate-300">{tx.gateway}</td>
                      <td className="py-2.5 text-right text-slate-200">${fmt(tx.amountUsd)}</td>
                      <td className="py-2.5 text-right text-emerald-400 font-semibold">+{fmt(tx.creditsAllocated)} VAMP</td>
                      <td className="py-2.5 text-right">
                        <span className="rounded bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 text-[10px] font-sans">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      )}

      {/* ─── TAB 3: REGISTERED ENTERPRISE CLIENTS ─── */}
      {activeTab === 'clients' && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Enterprise Client Registry
              </h2>
              <p className="text-xs text-slate-400">
                Verified enterprise organizations executing workloads on the distributed compute grid.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchRegistry}
              className="text-xs text-blue-400 hover:underline"
            >
              Refresh Registry
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 font-medium">
                <tr>
                  <th className="pb-2.5">Organization</th>
                  <th className="pb-2.5 font-mono">Corporate Email</th>
                  <th className="pb-2.5">Service Tier</th>
                  <th className="pb-2.5 text-right font-mono">Credit Reserve</th>
                  <th className="pb-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {companies.map((c) => (
                  <tr key={c.companyId || c.email} className="hover:bg-slate-950/40">
                    <td className="py-3 font-semibold text-slate-100">{c.name}</td>
                    <td className="py-3 font-mono text-slate-400">{c.email}</td>
                    <td className="py-3 text-slate-300">{c.serviceTier || 'Enterprise Dedicated'}</td>
                    <td className="py-3 font-mono text-right text-blue-400 font-medium">
                      {fmt(c.allocatedBudget || 0)} VAMP
                    </td>
                    <td className="py-3 text-right">
                      <span className="rounded bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-[10px] font-semibold border border-emerald-500/20">
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── TAB 4: REGISTERED COMPUTE CONTRIBUTORS ─── */}
      {activeTab === 'contributors' && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Registered Compute Contributors
              </h2>
              <p className="text-xs text-slate-400">
                Global hardware nodes contributing idle CPU/GPU compute cycles.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchRegistry}
              className="text-xs text-blue-400 hover:underline"
            >
              Refresh Registry
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 font-medium">
                <tr>
                  <th className="pb-2.5">Operator Name</th>
                  <th className="pb-2.5 font-mono">Account Email</th>
                  <th className="pb-2.5 font-mono">Settlement Wallet</th>
                  <th className="pb-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono text-xs">
                {users.map((u) => (
                  <tr key={u.userId || u.email} className="hover:bg-slate-950/40">
                    <td className="py-3 font-sans font-semibold text-slate-100">{u.name}</td>
                    <td className="py-3 text-slate-400">{u.email}</td>
                    <td className="py-3 text-slate-300">{shortWallet(u.wallet)}</td>
                    <td className="py-3 text-right font-sans">
                      <span className="rounded bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-[10px] font-semibold border border-emerald-500/20">
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  );
}
