'use client'

import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Wallet,
  Building2,
  CreditCard,
  User,
  Loader2,
  AlertCircle,
  Info,
  ChevronDown,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { useRunnerStore } from '@/store/runner-store'

interface Bank {
  id: string
  name: string
  code: string
}

const PAYOUT_FEE = 50
const MIN_PAYOUT = 1000

interface RunnerWithdrawalFormProps {
  onBack: () => void
  onSuccess: () => void
}

export default function RunnerWithdrawalForm({ onBack, onSuccess }: RunnerWithdrawalFormProps) {
  const earnings = useRunnerStore((s) => s.earnings)

  const [amount, setAmount] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')

  const [banks, setBanks] = useState<Bank[]>([])
  const [banksLoading, setBanksLoading] = useState(false)
  const [banksFetched, setBanksFetched] = useState(false)
  const [bankSearch, setBankSearch] = useState('')
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableBalance = earnings.month - earnings.pendingPayout
  const parsedAmount = parseFloat(amount) || 0
  const netAmount = parsedAmount > 0 ? parsedAmount - PAYOUT_FEE : 0
  const exceedsBalance = parsedAmount > availableBalance
  const belowMinimum = parsedAmount > 0 && parsedAmount < MIN_PAYOUT

  // Fetch banks
  const handleFetchBanks = async () => {
    setBanksLoading(true)
    try {
      const data = await api.get('/api/payments/banks')
      setBanks(data.banks || [])
      setBanksFetched(true)
    } catch {
      setError('Failed to fetch banks. Please try again.')
    } finally {
      setBanksLoading(false)
    }
  }

  // Filter banks by search
  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  )

  // Select a bank
  const handleSelectBank = (bank: Bank) => {
    setBankName(bank.name)
    setBankCode(bank.code)
    setBankSearch('')
    setBankDropdownOpen(false)
  }

  // Submit withdrawal
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (belowMinimum) {
      setError(`Minimum withdrawal is ₦${MIN_PAYOUT.toLocaleString()}`)
      return
    }
    if (exceedsBalance) {
      setError('Amount exceeds your available balance')
      return
    }
    if (!bankName.trim()) {
      setError('Please select a bank')
      return
    }
    if (!accountNumber.trim() || accountNumber.trim().length < 10) {
      setError('Please enter a valid account number (at least 10 digits)')
      return
    }
    if (!accountName.trim()) {
      setError('Please enter the account name')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/api/runner/payout', {
        amount: parsedAmount,
        bankName: bankName.trim(),
        bankCode: bankCode || undefined,
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
      })
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Withdrawal request failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const isFormValid = parsedAmount >= MIN_PAYOUT && !exceedsBalance && bankName && accountNumber.trim().length >= 10 && accountName.trim()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="font-bold text-lg">Withdraw Funds</h2>
          <p className="text-xs text-muted-foreground">Transfer to your bank account</p>
        </div>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-0">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-5 h-5" />
            <span className="text-sm font-medium opacity-90">Available Balance</span>
          </div>
          <p className="text-3xl font-bold">₦{availableBalance.toLocaleString()}</p>
          {earnings.pendingPayout > 0 && (
            <p className="text-sm opacity-80 mt-1">
              ₦{earnings.pendingPayout.toLocaleString()} pending
            </p>
          )}
        </CardContent>
      </Card>

      {/* Fee Notice */}
      <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl">
        <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-700 dark:text-amber-400">
          <p className="font-medium">Withdrawal Fee: ₦{PAYOUT_FEE}</p>
          <p className="mt-0.5">Minimum withdrawal: ₦{MIN_PAYOUT.toLocaleString()}. Funds typically arrive within 1-2 business hours.</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amount */}
        <div className="space-y-2">
          <Label htmlFor="amount" className="text-sm font-medium">
            Amount (₦)
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">₦</span>
            <Input
              id="amount"
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(null) }}
              className="pl-7 text-lg font-bold h-12"
              min={MIN_PAYOUT}
              max={availableBalance}
            />
          </div>
          {parsedAmount > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className={belowMinimum ? 'text-red-500' : exceedsBalance ? 'text-red-500' : 'text-muted-foreground'}>
                {belowMinimum
                  ? `Minimum is ₦${MIN_PAYOUT.toLocaleString()}`
                  : exceedsBalance
                    ? 'Exceeds available balance'
                    : `You'll receive`}
              </span>
              {!belowMinimum && !exceedsBalance && (
                <span className="font-semibold text-emerald-600">₦{netAmount.toLocaleString()}</span>
              )}
            </div>
          )}
          {/* Quick amount buttons */}
          <div className="flex gap-2">
            {[1000, 2000, 5000, 10000].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => { setAmount(String(val)); setError(null) }}
                disabled={val > availableBalance}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  parsedAmount === val
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                    : val > availableBalance
                      ? 'bg-muted/50 border-border text-muted-foreground/40 cursor-not-allowed'
                      : 'bg-background border-border text-muted-foreground hover:border-emerald-500/50 hover:text-emerald-600'
                }`}
              >
                ₦{val >= 1000 ? `${val / 1000}k` : val}
              </button>
            ))}
          </div>
        </div>

        {/* Bank Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Bank</Label>
          {!banksFetched ? (
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 gap-2"
              onClick={handleFetchBanks}
              disabled={banksLoading}
            >
              {banksLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Fetching banks...
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4" />
                  Fetch Banks
                </>
              )}
            </Button>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setBankDropdownOpen(!bankDropdownOpen)}
                className={`w-full h-12 px-3 flex items-center justify-between rounded-md border bg-transparent text-left transition-colors ${
                  bankName
                    ? 'border-emerald-500/50 text-foreground'
                    : 'border-border text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{bankName || 'Select your bank'}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${bankDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {bankDropdownOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <Input
                      placeholder="Search banks..."
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredBanks.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No banks found</p>
                    ) : (
                      filteredBanks.map((bank) => (
                        <button
                          key={bank.code}
                          type="button"
                          onClick={() => handleSelectBank(bank)}
                          className={`w-full px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors flex items-center justify-between ${
                            bankName === bank.name ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : ''
                          }`}
                        >
                          <span>{bank.name}</span>
                          {bankName === bank.name && (
                            <span className="text-emerald-600 text-xs font-medium">Selected</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Account Number */}
        <div className="space-y-2">
          <Label htmlFor="accountNumber" className="text-sm font-medium">
            Account Number
          </Label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="accountNumber"
              type="text"
              inputMode="numeric"
              placeholder="Enter 10-digit account number"
              value={accountNumber}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 20)
                setAccountNumber(val)
                setError(null)
              }}
              className="pl-9 h-12"
              maxLength={20}
            />
          </div>
        </div>

        {/* Account Name */}
        <div className="space-y-2">
          <Label htmlFor="accountName" className="text-sm font-medium">
            Account Name
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="accountName"
              type="text"
              placeholder="Name on the account"
              value={accountName}
              onChange={(e) => { setAccountName(e.target.value); setError(null) }}
              className="pl-9 h-12"
            />
          </div>
        </div>

        {/* Summary */}
        {parsedAmount >= MIN_PAYOUT && !exceedsBalance && (
          <Card className="border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/10">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Withdrawal amount</span>
                <span className="font-medium">₦{parsedAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Processing fee</span>
                <span className="font-medium text-red-500">-₦{PAYOUT_FEE}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">You&apos;ll receive</span>
                <span className="font-bold text-emerald-600 text-lg">₦{netAmount.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm"
          disabled={!isFormValid || submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              <Wallet className="w-4 h-4 mr-2" />
              Withdraw ₦{parsedAmount > 0 ? parsedAmount.toLocaleString() : '0'}
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
