import React, { useState, useEffect } from 'react';
import {
    Search,
    ShieldCheck,
    User,
    Users,
    HeartPulse,
    AlertTriangle,
    PlusCircle,
    CheckCircle2,
    Camera,
    Upload,
    ArrowRight,
    Moon,
    Sun,
    History,
    Image as ImageIcon,
    Loader2
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/personal-accidents';
const BOT_TOKEN = import.meta.env.VITE_BOT_TOKEN;
const RECEIPT_GROUP_ID = import.meta.env.VITE_RECEIPT_GROUP_ID;

function App() {
    const [employeeId, setEmployeeId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [policy, setPolicy] = useState(null);

    // Theme state
    const [theme, setTheme] = useState('light');

    // Navigation state
    const [activeTab, setActiveTab] = useState('current');

    // Benefit update state
    const [selectedBenefitIndex, setSelectedBenefitIndex] = useState(null);
    const [amountToAdd, setAmountToAdd] = useState('');
    const [updatingBenefit, setUpdatingBenefit] = useState(false);

    // Receipt upload state
    const [awaitingReceiptPhoto, setAwaitingReceiptPhoto] = useState(false);
    const [receiptFile, setReceiptFile] = useState(null);
    const [receiptPreview, setReceiptPreview] = useState(null);
    const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
    const [addedAmount, setAddedAmount] = useState(0);

    // Track which history images have been loaded. Values: 'loading', 'loaded', or undefined
    const [loadedReceipts, setLoadedReceipts] = useState({});

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const fetchPolicy = async (e) => {
        e.preventDefault();
        if (!employeeId.trim()) return;

        setLoading(true);
        setError(null);
        setPolicy(null);
        setActiveTab('current');
        resetUpdateState();

        try {
            const response = await fetch(API_URL);
            const apiResponse = await response.json();
            const data = JSON.parse(apiResponse.body);
            const policies = data.personalaccidents;

            const foundPolicy = policies.find(p => p.employee_id === employeeId);

            if (!foundPolicy) {
                setError('No policy found for this Employee ID.');
            } else {
                setPolicy(foundPolicy);
            }
        } catch (err) {
            console.error(err);
            setError('System error: Unable to fetch policy details.');
        } finally {
            setLoading(false);
        }
    };

    const resetUpdateState = () => {
        setSelectedBenefitIndex(null);
        setAmountToAdd('');
        setAwaitingReceiptPhoto(false);
        setReceiptFile(null);
        setReceiptPreview(null);
        setAwaitingConfirmation(false);
        setAddedAmount(0);
    };

    const handleUpdateAmount = async (e) => {
        e.preventDefault();
        if (selectedBenefitIndex === null || !amountToAdd) return;

        const amount = parseFloat(amountToAdd);
        if (isNaN(amount) || amount <= 0) {
            setError('Please enter a valid numeric amount.');
            return;
        }

        setError(null);
        setAddedAmount(amount);
        setAwaitingReceiptPhoto(true);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setReceiptFile(file);
            setReceiptPreview(URL.createObjectURL(file));
            setAwaitingConfirmation(true);
        }
    };

    const submitReceipt = async () => {
        if (!receiptFile || selectedBenefitIndex === null || !addedAmount) return;

        setUpdatingBenefit(true);
        setError(null);

        try {
            const benefit = policy.benefits[selectedBenefitIndex];
            const newAmount = parseFloat(benefit.usedAmount) + addedAmount;

            const mainMemberName = policy.mainMembers?.[0]?.name || 'Unknown';

            const caption = `New receipt submitted for ${mainMemberName} (Employee ID: ${employeeId})\n` +
                `Benefit: ${benefit.type}\n` +
                `Amount added: ${addedAmount}\n` +
                `Updated used amount: ${newAmount}`;

            const formData = new FormData();
            formData.append('chat_id', RECEIPT_GROUP_ID);
            formData.append('photo', receiptFile);
            formData.append('caption', caption);

            // 1. Send photo to Telegram
            const telegramResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: formData
            });

            if (!telegramResponse.ok) {
                throw new Error('Failed to securely send photo payload.');
            }

            // 2. Commit transaction to database via API
            const updateUrl = `${API_URL}/${employeeId}/benefits-used-amount`;
            const requestBody = {
                benefits: [{
                    type: benefit.type,
                    usedAmount: newAmount
                }]
            };

            const response = await fetch(updateUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const result = await response.json();

            if (response.status === 200) {
                const updatedPolicy = { ...policy };
                updatedPolicy.benefits[selectedBenefitIndex].usedAmount = newAmount;
                setPolicy(updatedPolicy);

                resetUpdateState();
                alert('Receipt has been successfully recorded in the system.');
            } else {
                throw new Error(result.message || 'Failed to update benefit amount in the database.');
            }

        } catch (err) {
            console.error('Error submitting receipt:', err);
            setError(`Failed to finalize submission: ${err.message}`);
        } finally {
            setUpdatingBenefit(false);
        }
    };

    const cancelReceipt = () => {
        resetUpdateState();
    };

    const toggleReceiptImage = (id) => {
        setLoadedReceipts(prev => {
            // If it's already loading/loaded, hide it by removing it.
            if (prev[id]) {
                const newObj = { ...prev };
                delete newObj[id];
                return newObj;
            }
            // Otherwise set to loading state
            return { ...prev, [id]: 'loading' };
        });
    };

    // Derive past requests from actual API policy benefits where usedAmount > 0
    const pastRequests = policy?.benefits
        ? policy.benefits
            .filter(b => parseFloat(b.usedAmount) > 0)
            .map((b, i) => ({
                id: `REQ-${policy.id || 'SYS'}-${i + 1}`,
                date: policy.created_at,
                benefit: b.type,
                amount: parseFloat(b.usedAmount),
                status: 'Processed',
                // Since the API does not store actual receipt URLs natively in this endpoint,
                // we use a generic placeholder to demonstrate the lazy loading architecture requested.
                receiptUrl: `https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500&auto=format&fit=crop&q=60&rand=${i}`
            }))
        : [];

    return (
        <div className="flex flex-col min-h-screen transition-colors duration-300 bg-[var(--bg-primary)] text-[var(--text-primary)] font-dosis">
            <header className="py-5 px-6 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-sm sticky top-0 z-10 transition-colors duration-300">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-sm flex items-center justify-center shadow-sm overflow-hidden border border-[var(--border-color)]">
                            <img src="/logo192.png" alt="Company Logo" className="w-full h-full object-cover p-1" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-wide">Policy Management</h1>
                            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest font-semibold">Corporate Portal</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {policy && (
                            <form onSubmit={fetchPolicy} className="relative hidden md:block w-72">
                                <input
                                    type="text"
                                    placeholder="Employee ID..."
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-sm py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[var(--accent-color)] transition-colors"
                                />
                                <Search className="absolute left-3 top-2.5 text-[var(--text-secondary)] w-4 h-4" />
                            </form>
                        )}

                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-sm border border-[var(--border-color)] bg-[var(--bg-primary)] hover:bg-[var(--border-color)] transition-colors"
                            aria-label="Toggle Theme"
                        >
                            {theme === 'light' ? <Moon className="w-4 h-4 text-slate-700" /> : <Sun className="w-4 h-4 text-amber-400" />}
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 md:px-6 py-10 w-full flex-1">
                {!policy && !loading && (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-700">
                        <div className="w-16 h-16 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-sm flex items-center justify-center mb-8 shadow-sm">
                            <ShieldCheck className="text-[var(--accent-color)] w-8 h-8" />
                        </div>
                        <h2 className="text-3xl font-bold mb-3 text-center">Retrieve Policy Details</h2>
                        <p className="text-[var(--text-secondary)] mb-8 text-center max-w-md">
                            Enter a valid Employee ID to view personal accident coverages, dependents, and submission history.
                        </p>

                        <form onSubmit={fetchPolicy} className="w-full max-w-md relative shadow-sm">
                            <input
                                type="text"
                                placeholder="Enter Employee ID (e.g. TH31524)"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-sm py-4 pl-12 pr-32 text-lg focus:outline-none focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] transition-colors text-[var(--text-primary)]"
                            />
                            <Search className="absolute left-4 top-4 text-[var(--text-secondary)] w-6 h-6" />
                            <button
                                type="submit"
                                disabled={!employeeId.trim()}
                                className="absolute right-2 top-2 bottom-2 bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white rounded-sm px-6 font-semibold transition-colors disabled:opacity-50"
                            >
                                Search
                            </button>
                        </form>
                    </div>
                )}

                {loading && (
                    <div className="flex flex-col items-center justify-center py-32 opacity-70">
                        <ShieldCheck className="w-12 h-12 text-[var(--accent-color)] animate-spin-slow mb-4" />
                        <p className="text-lg tracking-widest text-[var(--text-secondary)] animate-pulse uppercase font-semibold">Accessing Records...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] p-4 rounded-sm flex items-center gap-3 mb-8 shadow-sm">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <p className="font-medium">{error}</p>
                    </div>
                )}

                {policy && !loading && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

                        <div className="flex border-b border-[var(--border-color)] mb-8 overflow-x-auto whitespace-nowrap hide-scrollbar">
                            <button
                                onClick={() => setActiveTab('current')}
                                className={`py-3 px-6 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'current' ? 'border-[var(--accent-color)] text-[var(--accent-color)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                                Coverage & Processing
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`flex items-center gap-2 py-3 px-6 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'history' ? 'border-[var(--accent-color)] text-[var(--accent-color)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                                <History className="w-4 h-4" /> Past Submissions
                            </button>
                        </div>

                        {activeTab === 'current' && (
                            <div className="space-y-6 md:space-y-8">
                                {/* Header info */}
                                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-sm p-4 md:p-6 shadow-sm">
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                        <div>
                                            <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 mb-1">
                                                <User className="text-[var(--accent-color)] w-6 h-6" />
                                                {policy.employee_id}
                                            </h2>
                                            <p className="text-[var(--text-secondary)] text-sm">Policy Holder Record</p>
                                        </div>

                                        <div className="flex flex-col items-start md:items-end gap-1 text-sm text-[var(--text-secondary)]">
                                            <span className="flex items-center gap-2">
                                                <span className="font-semibold text-[var(--text-primary)]">Details:</span> {policy.additionalDetails || 'N/A'}
                                            </span>
                                            <span className="flex items-center gap-2">
                                                <span className="font-semibold text-[var(--text-primary)]">Created:</span> {new Date(policy.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                    {/* Main Members */}
                                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-sm shadow-sm overflow-hidden">
                                        <div className="bg-[var(--bg-primary)] border-b border-[var(--border-color)] p-3 md:p-4 flex items-center gap-2">
                                            <Users className="w-5 h-5 text-[var(--accent-color)]" />
                                            <h3 className="font-semibold">Main Members</h3>
                                        </div>
                                        <div className="divide-y divide-[var(--border-color)]">
                                            {policy.mainMembers?.map((m, i) => (
                                                <div key={i} className="p-3 md:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                    <div>
                                                        <span className="font-semibold block">{m.name}</span>
                                                        <span className="text-sm text-[var(--text-secondary)]">{m.position}</span>
                                                    </div>
                                                    <span className="text-sm border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1 rounded-sm w-fit">
                                                        {m.phone}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Dependents */}
                                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-sm shadow-sm overflow-hidden">
                                        <div className="bg-[var(--bg-primary)] border-b border-[var(--border-color)] p-3 md:p-4 flex items-center gap-2">
                                            <HeartPulse className="w-5 h-5 text-[var(--accent-color)]" />
                                            <h3 className="font-semibold">Registered Dependents</h3>
                                        </div>
                                        {policy.dependents?.length > 0 ? (
                                            <div className="divide-y divide-[var(--border-color)]">
                                                {policy.dependents.map((d, i) => (
                                                    <div key={i} className="p-3 md:p-4 flex items-center justify-between">
                                                        <span className="font-semibold">{d.name}</span>
                                                        <span className="text-xs font-semibold tracking-wider uppercase text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-2 py-1 rounded-sm">
                                                            {d.relation}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-6 text-center text-[var(--text-secondary)] text-sm">
                                                No dependents registered.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Benefits Processing */}
                                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-sm shadow-sm overflow-hidden">
                                    <div className="bg-[var(--bg-primary)] border-b border-[var(--border-color)] p-3 md:p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="w-5 h-5 text-[var(--accent-color)]" />
                                            <h3 className="font-semibold">Benefit Utilization</h3>
                                        </div>
                                    </div>

                                    {/* Desktop Table View */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-[var(--border-color)] text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                                                    <th className="p-4 font-semibold">Benefit Type</th>
                                                    <th className="p-4 font-semibold">Max Coverage</th>
                                                    <th className="p-4 font-semibold">Utilized</th>
                                                    <th className="p-4 font-semibold">Status</th>
                                                    <th className="p-4 font-semibold text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[var(--border-color)]">
                                                {policy.benefits?.map((b, i) => {
                                                    const usedAmount = parseFloat(b.usedAmount) || 0;
                                                    const totalAmount = parseFloat(b.amount) || 1;
                                                    const usedPercent = (usedAmount / totalAmount) * 100;
                                                    const isHighUsage = usedPercent >= 75;
                                                    const isSelected = selectedBenefitIndex === i;

                                                    return (
                                                        <React.Fragment key={i}>
                                                            <tr className={`hover:bg-[var(--bg-primary)] transition-colors ${isSelected ? 'bg-[var(--bg-primary)]' : ''}`}>
                                                                <td className="p-4 font-semibold">{b.type}</td>
                                                                <td className="p-4 text-[var(--text-secondary)]">{totalAmount.toFixed(2)}</td>
                                                                <td className="p-4 font-semibold">{usedAmount.toFixed(2)}</td>
                                                                <td className="p-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-16 h-1.5 bg-[var(--border-color)] rounded-full overflow-hidden">
                                                                            <div
                                                                                className={`h-full ${isHighUsage ? 'bg-[var(--danger)]' : 'bg-[var(--success)]'}`}
                                                                                style={{ width: `${Math.min(usedPercent, 100)}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className={`text-xs font-semibold ${isHighUsage ? 'text-[var(--danger)]' : 'text-[var(--text-secondary)]'}`}>
                                                                            {Math.round(usedPercent)}%
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4 text-right">
                                                                    <button
                                                                        onClick={() => !awaitingReceiptPhoto && setSelectedBenefitIndex(isSelected ? null : i)}
                                                                        disabled={awaitingReceiptPhoto}
                                                                        className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors border flex items-center gap-1 ml-auto ${isSelected
                                                                            ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white'
                                                                            : 'bg-transparent border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-color)] disabled:opacity-50 disabled:cursor-not-allowed'
                                                                            }`}
                                                                    >
                                                                        <PlusCircle className="w-3 h-3" /> Process Claim
                                                                    </button>
                                                                </td>
                                                            </tr>

                                                            {isSelected && (
                                                                <tr>
                                                                    <td colSpan="5" className="p-0 border-b-2 border-[var(--accent-color)]">
                                                                        <div className="bg-[var(--bg-primary)] p-6 animate-in slide-in-from-top-2 flex flex-col border-x border-[var(--border-color)]">
                                                                            {/* Expanded Desktop Workflow form here, same as below but styled linearly */}
                                                                            {!awaitingReceiptPhoto ? (
                                                                                <div className="w-full max-w-xl">
                                                                                    <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-4">Step 1: Input Claim Amount</h4>
                                                                                    <form onSubmit={handleUpdateAmount} className="flex gap-4 items-end">
                                                                                        <div className="flex-1">
                                                                                            <label className="block text-xs font-semibold mb-1 text-[var(--text-primary)]">Amount to Process (Numeric)</label>
                                                                                            <input
                                                                                                type="number"
                                                                                                step="0.01"
                                                                                                min="0.01"
                                                                                                required
                                                                                                value={amountToAdd}
                                                                                                onChange={(e) => setAmountToAdd(e.target.value)}
                                                                                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-sm py-2 px-3 focus:outline-none focus:border-[var(--accent-color)]"
                                                                                            />
                                                                                        </div>
                                                                                        <button
                                                                                            type="submit"
                                                                                            disabled={updatingBenefit}
                                                                                            className="bg-[var(--text-primary)] hover:bg-[var(--accent-color)] text-[var(--bg-secondary)] font-semibold py-2 px-6 rounded-sm transition-colors h-[38px] flex items-center gap-2"
                                                                                        >
                                                                                            {updatingBenefit ? 'Authorizing...' : 'Authorize'} <ArrowRight className="w-4 h-4" />
                                                                                        </button>
                                                                                    </form>
                                                                                    <p className="text-xs text-[var(--danger)] mt-2 flex items-center gap-1">
                                                                                        <AlertTriangle className="w-3 h-3" /> Once authorized, amount cannot be modified.
                                                                                    </p>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="w-full">
                                                                                    <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--success)] mb-4 flex items-center gap-1">
                                                                                        <CheckCircle2 className="w-4 h-4" /> Step 1 Complete &middot; Step 2: Upload Receipt
                                                                                    </h4>

                                                                                    {!awaitingConfirmation ? (
                                                                                        <label className="border border-dashed border-[var(--accent-color)] bg-[var(--accent-color)]/5 hover:bg-[var(--accent-color)]/10 rounded-sm p-6 flex flex-col items-center justify-center cursor-pointer transition-colors max-w-xl">
                                                                                            <Upload className="w-6 h-6 text-[var(--accent-color)] mb-2" />
                                                                                            <span className="font-semibold text-sm text-[var(--accent-color)]">Select Receipt Document</span>
                                                                                            <input
                                                                                                type="file"
                                                                                                accept="image/*"
                                                                                                capture="environment"
                                                                                                className="hidden"
                                                                                                onChange={handleFileChange}
                                                                                            />
                                                                                        </label>
                                                                                    ) : (
                                                                                        <div className="flex gap-6 items-start">
                                                                                            <div className="w-48 h-48 border border-[var(--border-color)] rounded-sm bg-[var(--bg-secondary)] flex items-center justify-center overflow-hidden">
                                                                                                <img src={receiptPreview} alt="Receipt preview" className="max-w-full max-h-full object-contain" />
                                                                                            </div>
                                                                                            <div className="flex flex-col gap-3">
                                                                                                <div className="text-sm font-semibold">Document Ready for Submission</div>
                                                                                                <div className="text-xs text-[var(--text-secondary)] mb-2">Claim Amount: {addedAmount} <br /> Type: {b.type}</div>
                                                                                                <button
                                                                                                    onClick={submitReceipt}
                                                                                                    disabled={updatingBenefit}
                                                                                                    className="bg-[var(--success)] hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-sm transition-colors text-sm flex items-center justify-center gap-2"
                                                                                                >
                                                                                                    {updatingBenefit ? 'Transmitting...' : 'Submit to System'}
                                                                                                </button>
                                                                                                <button
                                                                                                    onClick={cancelReceipt}
                                                                                                    disabled={updatingBenefit}
                                                                                                    className="bg-transparent border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger-bg)] font-semibold py-2 px-6 rounded-sm transition-colors text-sm"
                                                                                                >
                                                                                                    Void Submission
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile responsive cards for Benefits */}
                                    <div className="md:hidden divide-y divide-[var(--border-color)]">
                                        {policy.benefits?.map((b, i) => {
                                            const usedAmount = parseFloat(b.usedAmount) || 0;
                                            const totalAmount = parseFloat(b.amount) || 1;
                                            const usedPercent = (usedAmount / totalAmount) * 100;
                                            const isHighUsage = usedPercent >= 75;
                                            const isSelected = selectedBenefitIndex === i;

                                            return (
                                                <div key={i} className={`p-4 hover:bg-[var(--bg-primary)] transition-colors ${isSelected ? 'bg-[var(--bg-primary)]' : ''}`}>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="font-semibold text-[var(--text-primary)]">{b.type}</span>
                                                        <span className="text-sm font-semibold">{usedAmount.toFixed(2)} / <span className="text-[var(--text-secondary)] font-normal">{totalAmount.toFixed(2)}</span></span>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-3 mb-4">
                                                        <div className="flex-1 h-2 bg-[var(--border-color)] rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full ${isHighUsage ? 'bg-[var(--danger)]' : 'bg-[var(--success)]'}`}
                                                                style={{ width: `${Math.min(usedPercent, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-xs font-semibold ${isHighUsage ? 'text-[var(--danger)]' : 'text-[var(--text-secondary)]'} whitespace-nowrap`}>
                                                            {Math.round(usedPercent)}% Utilized
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={() => !awaitingReceiptPhoto && setSelectedBenefitIndex(isSelected ? null : i)}
                                                        disabled={awaitingReceiptPhoto}
                                                        className={`w-full py-2.5 text-sm font-semibold rounded-sm transition-colors border flex items-center justify-center gap-2 ${isSelected
                                                            ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white'
                                                            : 'bg-transparent border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-color)] disabled:opacity-50 disabled:cursor-not-allowed'
                                                            }`}
                                                    >
                                                        <PlusCircle className="w-4 h-4" /> {isSelected ? 'Cancel Action' : 'Process Claim'}
                                                    </button>

                                                    {isSelected && (
                                                        <div className="mt-4 pt-4 border-t-2 border-[var(--accent-color)]">
                                                            {!awaitingReceiptPhoto ? (
                                                                <form onSubmit={handleUpdateAmount} className="flex flex-col gap-3">
                                                                    <div>
                                                                        <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">Amount to Process</label>
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            min="0.01"
                                                                            required
                                                                            value={amountToAdd}
                                                                            onChange={(e) => setAmountToAdd(e.target.value)}
                                                                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-sm py-3 px-3 focus:outline-none focus:border-[var(--accent-color)] text-[var(--text-primary)]"
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        type="submit"
                                                                        disabled={updatingBenefit}
                                                                        className="w-full bg-[var(--text-primary)] hover:bg-[var(--accent-color)] text-[var(--bg-secondary)] flex items-center justify-center gap-2 font-semibold py-3 rounded-sm transition-colors"
                                                                    >
                                                                        {updatingBenefit ? 'Authorizing...' : 'Authorize Request'} <ArrowRight className="w-4 h-4" />
                                                                    </button>
                                                                    <p className="text-xs text-[var(--danger)] text-center flex items-center justify-center gap-1">
                                                                        <AlertTriangle className="w-3 h-3" /> Cannot be undone
                                                                    </p>
                                                                </form>
                                                            ) : (
                                                                <div className="flex flex-col gap-3 text-center">
                                                                    <h4 className="text-xs font-semibold uppercase text-[var(--success)] flex items-center justify-center gap-1 mb-2">
                                                                        <CheckCircle2 className="w-3 h-3" /> Step 1 Complete
                                                                    </h4>
                                                                    {!awaitingConfirmation ? (
                                                                        <label className="w-full border border-dashed border-[var(--accent-color)] bg-[var(--accent-color)]/5 hover:bg-[var(--accent-color)]/10 rounded-sm py-10 flex flex-col items-center justify-center cursor-pointer transition-colors">
                                                                            <Upload className="w-8 h-8 text-[var(--accent-color)] mb-3" />
                                                                            <span className="font-semibold text-base text-[var(--accent-color)]">Upload Receipt</span>
                                                                            <span className="text-xs mt-1 text-[var(--text-secondary)]">Tap to select from device</span>
                                                                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                                                                        </label>
                                                                    ) : (
                                                                        <>
                                                                            <img src={receiptPreview} alt="Receipt preview" className="w-full h-auto max-h-48 object-contain bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-sm p-2 mb-2" />
                                                                            <button onClick={submitReceipt} disabled={updatingBenefit} className="w-full bg-[var(--success)] hover:bg-green-700 text-white font-semibold py-3 rounded-sm transition-colors text-sm">
                                                                                {updatingBenefit ? 'Transmitting...' : 'Submit Final Receipt'}
                                                                            </button>
                                                                            <button onClick={cancelReceipt} disabled={updatingBenefit} className="w-full border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger-bg)] font-semibold py-3 rounded-sm transition-colors text-sm">
                                                                                Void Submission
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-sm p-0 shadow-sm overflow-hidden animate-in fade-in duration-300">
                                <div className="bg-[var(--bg-primary)] border-b border-[var(--border-color)] p-4">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <History className="w-5 h-5 text-[var(--accent-color)]" />
                                        Submission History Log
                                    </h3>
                                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                                        Past claims associated with {policy.employee_id}. Data derived from current benefit metrics.
                                    </p>
                                </div>

                                {pastRequests.length > 0 ? (
                                    <>
                                        {/* Desktop View */}
                                        <div className="hidden md:block overflow-x-auto">
                                            <table className="w-full text-left border-collapse min-w-[600px]">
                                                <thead>
                                                    <tr className="border-b border-[var(--border-color)] text-xs uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--bg-primary)]/50">
                                                        <th className="p-4 font-semibold">Req ID</th>
                                                        <th className="p-4 font-semibold">Date</th>
                                                        <th className="p-4 font-semibold">Benefit Category</th>
                                                        <th className="p-4 font-semibold">Amount</th>
                                                        <th className="p-4 font-semibold">Status</th>
                                                        <th className="p-4 text-xs font-normal text-[var(--text-secondary)] whitespace-nowrap">*Images routed to Telegram</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[var(--border-color)]">
                                                    {pastRequests.map((req) => (
                                                        <tr key={req.id} className="hover:bg-[var(--bg-primary)] transition-colors">
                                                            <td className="p-4 font-semibold text-sm">{req.id}</td>
                                                            <td className="p-4 text-sm text-[var(--text-secondary)]">{new Date(req.date).toLocaleDateString()}</td>
                                                            <td className="p-4 text-sm font-medium">{req.benefit}</td>
                                                            <td className="p-4 text-sm font-semibold">{req.amount.toFixed(2)}</td>
                                                            <td className="p-4">
                                                                <span className={`text-xs font-semibold px-2 py-1 rounded-sm border ${req.status === 'Approved' ? 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20' :
                                                                    'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border-[var(--accent-color)]/20'
                                                                    }`}>
                                                                    {req.status}
                                                                </span>
                                                            </td>
                                                            <td className="p-4"></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile responsive cards for History */}
                                        <div className="md:hidden divide-y divide-[var(--border-color)]">
                                            {pastRequests.map((req) => (
                                                <div key={req.id} className="p-4 hover:bg-[var(--bg-primary)] transition-colors">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <span className="font-semibold text-[var(--text-primary)] block">{req.benefit}</span>
                                                            <span className="text-xs text-[var(--text-secondary)]">{req.id} &bull; {new Date(req.date).toLocaleDateString()}</span>
                                                        </div>
                                                        <span className="font-semibold text-sm">{req.amount.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-3">
                                                        <span className={`text-xs font-semibold px-2 py-1 rounded-sm border ${req.status === 'Approved' ? 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20' :
                                                            'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border-[var(--accent-color)]/20'
                                                            }`}>
                                                            {req.status}
                                                        </span>
                                                        <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">*Images routed to Telegram</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>

                                ) : (
                                    <div className="p-8 text-center text-[var(--text-secondary)]">
                                        No past submissions found for this policy.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="mt-8 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] py-8">
                <div className="max-w-6xl mx-auto px-6 flex flex-col items-center gap-2 text-center">
                    <p className="text-sm font-semibold">&copy; {new Date().getFullYear()} All rights reserved to Bizuhan and Mebratu Insurance Brokers</p>
                    <p className="text-[10px] uppercase tracking-widest opacity-80 font-bold mt-1">Powered by Gravity Technology & Meedish LLC</p>
                </div>
            </footer>
        </div>
    );
}

export default App;
