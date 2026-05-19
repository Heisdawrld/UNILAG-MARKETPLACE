'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Clock,
  ArrowLeft,
  Send,
  CheckCircle2,
  Plus,
  Users,
  Award,
  AlertTriangle,
  ChevronRight,
  Camera,
  Sparkles,
  ShieldCheck,
  Route,
  Bike,
  Footprints,
  IdCard,
  Phone,
  Clock3,
  Star,
  Zap,
  Radio,
  RefreshCcw,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import {
  User as UserType,
  Task,
  RunnerApplication,
  TASK_CATEGORIES,
  URGENCY_LABELS,
  URGENCY_COLORS,
  TASK_STATUS_LABELS,
} from '@/lib/types';
import { formatPrice, timeAgo, getInitials } from '@/lib/marketplace-utils';
import { getRunnerPricingGuide, type RunnerPricingGuide } from '@/lib/runner-pricing';

const RUNNER_STORAGE_KEY_PREFIX = 'unilag_runner_mode:';
const APP_STEP_LABELS = ['About you', 'Runner profile', 'Verification'];
const REQUEST_STEP_LABELS = ['What needs to move?', 'Route & timing', 'Budget & review'];
const TRANSPORT_OPTIONS = [
  { value: 'bicycle', label: 'Bicycle', icon: Bike },
  { value: 'motorbike', label: 'Motorbike', icon: Route },
  { value: 'walking', label: 'On foot', icon: Footprints },
  { value: 'scooter', label: 'Scooter', icon: Zap },
];

type RunnerEntryMode = 'intro' | 'customer' | 'runner_apply' | 'runner';

type RequestBudgetTone = 'low' | 'fair' | 'premium';
type MarketplaceSortMode = 'live' | 'urgent' | 'best_budget' | 'highest_budget';

const LIVE_REQUEST_WINDOW_MS = 1000 * 60 * 45;
const LIVE_OFFER_WINDOW_MS = 1000 * 60 * 12;

function isFreshTimestamp(value?: string | null, freshnessWindowMs = LIVE_REQUEST_WINDOW_MS) {
  if (!value) return false;

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;

  return Date.now() - timestamp <= freshnessWindowMs;
}

function getUrgencyRank(urgency?: string | null) {
  return {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  }[urgency || 'medium'] || 0;
}

function getTaskBudgetGap(task: Task) {
  if (!task.pricingGuide) return Number.MAX_SAFE_INTEGER;
  return Math.abs(task.reward - task.pricingGuide.recommended);
}

function sortMarketplaceTasks(tasks: Task[], mode: MarketplaceSortMode) {
  return [...tasks].sort((left, right) => {
    if (mode === 'urgent') {
      return getUrgencyRank(right.urgency) - getUrgencyRank(left.urgency)
        || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }

    if (mode === 'best_budget') {
      return getTaskBudgetGap(left) - getTaskBudgetGap(right)
        || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }

    if (mode === 'highest_budget') {
      return right.reward - left.reward
        || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function formatLiveSyncLabel(lastSyncedAt: Date | null) {
  if (!lastSyncedAt) return 'Waiting for first sync';

  const secondsAgo = Math.max(0, Math.round((Date.now() - lastSyncedAt.getTime()) / 1000));
  if (secondsAgo < 5) return 'Synced just now';
  if (secondsAgo < 60) return `Synced ${secondsAgo}s ago`;

  const minutesAgo = Math.round(secondsAgo / 60);
  return `Synced ${minutesAgo}m ago`;
}

function getRunnerStorageKey(userId: string) {
  return `${RUNNER_STORAGE_KEY_PREFIX}${userId}`;
}

async function compressImage(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  const maxEdge = 900;
  let width = image.width;
  let height = image.height;

  if (width > height && width > maxEdge) {
    height *= maxEdge / width;
    width = maxEdge;
  } else if (height >= width && height > maxEdge) {
    width *= maxEdge / height;
    height = maxEdge;
  }

  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/webp', 0.88);
}

function parseTaskImages(images: string | null | undefined) {
  if (!images) return [] as string[];

  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
  } catch {
    return [];
  }
}

function getRouteSummary(pickupLocation?: string | null, dropoffLocation?: string | null) {
  if (pickupLocation && dropoffLocation) {
    return `${pickupLocation} → ${dropoffLocation}`;
  }

  return pickupLocation || dropoffLocation || 'Route details coming soon';
}

function getBudgetTone(pricingGuide?: RunnerPricingGuide | null): RequestBudgetTone {
  if (!pricingGuide?.budgetPosition || pricingGuide.budgetPosition === 'fair') {
    return 'fair';
  }

  return pricingGuide.budgetPosition;
}

function getBudgetToneCopy(pricingGuide?: RunnerPricingGuide | null) {
  const tone = getBudgetTone(pricingGuide);

  if (tone === 'low') {
    return {
      label: 'Below guide',
      cardClass: 'border-amber-300/40 bg-amber-50/80 dark:bg-amber-900/10',
      badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
      description: 'Expect more counter-offers unless a runner is already moving on the same route.',
    };
  }

  if (tone === 'premium') {
    return {
      label: 'Premium budget',
      cardClass: 'border-emerald-300/40 bg-emerald-50/80 dark:bg-emerald-900/10',
      badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
      description: 'You are paying above the current guide, which can pull faster responses.',
    };
  }

  return {
    label: 'Fair budget',
    cardClass: 'border-primary/20 bg-primary/5',
    badgeClass: 'bg-primary/10 text-primary',
    description: 'This sits in the current guide range and should feel balanced to most runners.',
  };
}

function sortOfferApplications(task: Task, applications: Task['applications'] = []) {
  return [...applications].sort((left, right) => {
    const leftAccepted = left.status === 'accepted' ? 1 : 0;
    const rightAccepted = right.status === 'accepted' ? 1 : 0;
    if (leftAccepted !== rightAccepted) return rightAccepted - leftAccepted;

    const leftPending = left.status === 'pending' ? 1 : 0;
    const rightPending = right.status === 'pending' ? 1 : 0;
    if (leftPending !== rightPending) return rightPending - leftPending;

    const leftPrice = left.proposedPrice || task.reward;
    const rightPrice = right.proposedPrice || task.reward;
    const leftDelta = Math.abs(leftPrice - task.reward);
    const rightDelta = Math.abs(rightPrice - task.reward);
    if (leftDelta !== rightDelta) return leftDelta - rightDelta;

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function RunnerStatusPanel({
  application,
  onPrimaryAction,
}: {
  application: RunnerApplication;
  onPrimaryAction: () => void;
}) {
  const statusCopy = {
    pending: {
      title: 'Application under review',
      description: 'Your documents are in the admin review queue. We will notify you as soon as a decision is made.',
      accent: 'from-amber-500/20 via-orange-500/10 to-background',
      border: 'border-amber-400/30',
      button: 'Back to Runner home',
    },
    approved: {
      title: 'You are approved as a Runner',
      description: 'Your runner profile is live. Open your dashboard and start exploring campus requests.',
      accent: 'from-emerald-500/20 via-teal-500/10 to-background',
      border: 'border-emerald-400/30',
      button: 'Open runner dashboard',
    },
    rejected: {
      title: 'Application needs another pass',
      description: 'Review your details, update any missing information, and send a stronger application back to admin.',
      accent: 'from-rose-500/20 via-orange-500/10 to-background',
      border: 'border-rose-400/30',
      button: 'Update & reapply',
    },
  }[application.status];

  return (
    <Card className={`border ${statusCopy.border} shadow-lg overflow-hidden`}>
      <CardContent className={`p-0 bg-gradient-to-br ${statusCopy.accent}`}>
        <div className="p-5 md:p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-background/80 shadow-sm flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Runner application</p>
              <h3 className="text-xl font-bold">{statusCopy.title}</h3>
              <p className="text-sm text-muted-foreground max-w-xl">{statusCopy.description}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <div className="rounded-2xl border bg-background/70 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Movement</p>
              <p className="font-medium capitalize">{application.transportMode || 'Not set'}</p>
            </div>
            <div className="rounded-2xl border bg-background/70 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Submitted</p>
              <p className="font-medium">{new Date(application.submittedAt).toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border bg-background/70 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Availability</p>
              <p className="font-medium">{application.availability || 'Not provided'}</p>
            </div>
          </div>

          {application.reviewNote && (
            <div className="rounded-2xl border bg-background/70 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Admin note</p>
              <p className="text-sm leading-6">{application.reviewNote}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {application.status === 'pending'
                ? 'Approval will unlock the dedicated runner dashboard automatically.'
                : application.status === 'approved'
                  ? 'Your runner tools and request marketplace are now unlocked.'
                  : 'Tighten your profile, upload cleaner documents, and try again.'}
            </div>
            <Button onClick={onPrimaryAction} className="sm:min-w-[220px]">
              {statusCopy.button}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RunnerApplicationFlow({
  user,
  currentApplication,
  onSubmitted,
  onBack,
  onApproved,
}: {
  user: UserType;
  currentApplication: RunnerApplication | null;
  onSubmitted: (application: RunnerApplication) => void;
  onBack: () => void;
  onApproved: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState(!currentApplication);
  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState(currentApplication?.phone || user.phone || '');
  const [whatsapp, setWhatsapp] = useState(currentApplication?.whatsapp || user.whatsapp || '');
  const [faculty, setFaculty] = useState(currentApplication?.faculty || user.faculty || '');
  const [hostel, setHostel] = useState(currentApplication?.hostel || user.hostel || '');
  const [transportMode, setTransportMode] = useState(currentApplication?.transportMode || 'walking');
  const [availability, setAvailability] = useState(currentApplication?.availability || '');
  const [preferredZone, setPreferredZone] = useState(currentApplication?.preferredZone || '');
  const [deliveryExperience, setDeliveryExperience] = useState(currentApplication?.deliveryExperience || '');
  const [motivation, setMotivation] = useState(currentApplication?.motivation || '');
  const [studentId, setStudentId] = useState(currentApplication?.studentId || '');
  const [emergencyContactName, setEmergencyContactName] = useState(currentApplication?.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(currentApplication?.emergencyContactPhone || '');
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState(currentApplication?.emergencyContactRelationship || '');
  const [profilePhoto, setProfilePhoto] = useState(currentApplication?.profilePhoto || '');
  const [studentIdImage, setStudentIdImage] = useState(currentApplication?.studentIdImage || '');
  const progress = ((step + 1) / APP_STEP_LABELS.length) * 100;

  useEffect(() => {
    setEditing(!currentApplication);
  }, [currentApplication]);

  const handleUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    setter: (value: string) => void,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setter(await compressImage(file));
    } catch {
      toast({ title: 'Upload failed', description: 'Please try another image.', variant: 'destructive' });
    }
  };

  const validateStep = () => {
    if (step === 0 && (!phone.trim() || !faculty.trim() || !hostel.trim())) {
      toast({ title: 'Complete your identity details', description: 'Phone, faculty, and hostel are required.', variant: 'destructive' });
      return false;
    }

    if (step === 1 && (!transportMode || !availability.trim() || !motivation.trim())) {
      toast({ title: 'Tell us how you run', description: 'Movement type, availability, and motivation are required.', variant: 'destructive' });
      return false;
    }

    if (step === 2 && (!studentId.trim() || !emergencyContactName.trim() || !emergencyContactPhone.trim() || !profilePhoto || !studentIdImage)) {
      toast({ title: 'Finish verification', description: 'Runner verification needs your ID details, emergency contact, and both images.', variant: 'destructive' });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setSubmitting(true);
    try {
      const response = await api.post('/api/runner-applications', {
        userId: user.id,
        phone,
        whatsapp,
        faculty,
        hostel,
        transportMode,
        availability,
        preferredZone,
        deliveryExperience,
        motivation,
        studentId,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelationship,
        profilePhoto,
        studentIdImage,
      });

      toast({ title: 'Application submitted', description: 'Admin can now review your runner profile and documents.' });
      setEditing(false);
      onSubmitted(response.application);
    } catch (error) {
      toast({
        title: 'Submission failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (currentApplication && !editing) {
    return (
      <RunnerStatusPanel
        application={currentApplication}
        onPrimaryAction={() => {
          if (currentApplication.status === 'approved') {
            onApproved();
            return;
          }
          if (currentApplication.status === 'rejected') {
            setEditing(true);
            setStep(0);
            return;
          }
          onBack();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card className="border-0 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-br from-primary/10 via-amber-500/10 to-background p-5 md:p-6 border-b">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Become a Runner</p>
                <h2 className="text-2xl font-bold">Premium runner application</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                  Build trust before you ever take a request. Submit your movement style, availability, identity details, and supporting documents in one polished flow.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={onBack} className="rounded-full">Back</Button>
            </div>

            <div className="mt-6 space-y-3">
              <Progress value={progress} className="h-2" />
              <div className="grid grid-cols-3 gap-2 text-xs">
                {APP_STEP_LABELS.map((label, index) => (
                  <div key={label} className={`rounded-2xl border px-3 py-2 text-center ${index === step ? 'border-primary bg-primary/10 text-primary' : index < step ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-600' : 'border-border text-muted-foreground'}`}>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5 md:p-6 space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {step === 0 && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Phone number *</Label>
                        <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0801 234 5678" />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">WhatsApp</Label>
                        <Input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="0801 234 5678" />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Faculty *</Label>
                        <Input value={faculty} onChange={(event) => setFaculty(event.target.value)} placeholder="Engineering" />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Hostel / area *</Label>
                        <Input value={hostel} onChange={(event) => setHostel(event.target.value)} placeholder="Sodeinde Hall" />
                      </div>
                    </div>
                    <div className="rounded-3xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                      These details help admin verify that you are a real UNILAG runner and make it easier to reach you quickly once approved.
                    </div>
                  </>
                )}

                {step === 1 && (
                  <>
                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground block">How do you move around campus? *</Label>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {TRANSPORT_OPTIONS.map((option) => {
                          const Icon = option.icon;
                          const active = transportMode === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setTransportMode(option.value)}
                              className={`rounded-3xl border p-4 text-left transition-all ${active ? 'border-primary bg-primary/10 shadow-sm' : 'border-border hover:border-primary/30'}`}
                            >
                              <div className="w-11 h-11 rounded-2xl bg-background shadow-sm flex items-center justify-center mb-3">
                                <Icon className={`w-5 h-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                              </div>
                              <p className="font-semibold text-sm">{option.label}</p>
                              <p className="text-xs text-muted-foreground mt-1">This helps customers know your delivery style.</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Availability *</Label>
                        <Input value={availability} onChange={(event) => setAvailability(event.target.value)} placeholder="Weekdays 3pm – 8pm" />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Preferred zone</Label>
                        <Input value={preferredZone} onChange={(event) => setPreferredZone(event.target.value)} placeholder="Jaja, New Hall, Main Gate" />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Why should admin trust you as a runner? *</Label>
                      <Textarea value={motivation} onChange={(event) => setMotivation(event.target.value)} rows={4} maxLength={320} placeholder="I know campus routes well, I respond quickly, and I handle delivery handovers professionally..." />
                    </div>

                    <div>
                      <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Delivery or errand experience</Label>
                      <Textarea value={deliveryExperience} onChange={(event) => setDeliveryExperience(event.target.value)} rows={3} maxLength={260} placeholder="Optional: logistics work, dispatch experience, class rep deliveries, hostel pickup help..." />
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Matric / student ID number *</Label>
                        <Input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="190405001" />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Emergency contact name *</Label>
                        <Input value={emergencyContactName} onChange={(event) => setEmergencyContactName(event.target.value)} placeholder="Mrs. Adiele" />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Emergency contact phone *</Label>
                        <Input value={emergencyContactPhone} onChange={(event) => setEmergencyContactPhone(event.target.value)} placeholder="0801 234 5678" />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Relationship</Label>
                        <Input value={emergencyContactRelationship} onChange={(event) => setEmergencyContactRelationship(event.target.value)} placeholder="Parent / Guardian / Sibling" />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-3xl border p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Camera className="w-4 h-4 text-primary" />
                          <p className="font-semibold text-sm">Profile photo *</p>
                        </div>
                        <p className="text-xs text-muted-foreground">Use a clean face shot so admin can identify you easily in Runner ops.</p>
                        {profilePhoto ? (
                          <img src={profilePhoto} alt="Profile" className="w-full aspect-[4/3] rounded-2xl object-cover border" />
                        ) : (
                          <label className="block rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer hover:border-primary/40 transition-colors">
                            <Camera className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm font-medium">Upload profile photo</p>
                            <p className="text-xs text-muted-foreground mt-1">PNG, JPG, or HEIC</p>
                            <input type="file" accept="image/*" className="hidden" onChange={(event) => handleUpload(event, setProfilePhoto)} />
                          </label>
                        )}
                      </div>

                      <div className="rounded-3xl border p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <IdCard className="w-4 h-4 text-primary" />
                          <p className="font-semibold text-sm">Student ID / document *</p>
                        </div>
                        <p className="text-xs text-muted-foreground">Upload your student ID card or another clear campus-verifiable document.</p>
                        {studentIdImage ? (
                          <img src={studentIdImage} alt="Student ID" className="w-full aspect-[4/3] rounded-2xl object-cover border" />
                        ) : (
                          <label className="block rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer hover:border-primary/40 transition-colors">
                            <IdCard className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm font-medium">Upload ID photo</p>
                            <p className="text-xs text-muted-foreground mt-1">Front-facing and readable</p>
                            <input type="file" accept="image/*" className="hidden" onChange={(event) => handleUpload(event, setStudentIdImage)} />
                          </label>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
              <div className="text-xs text-muted-foreground">Step {step + 1} of {APP_STEP_LABELS.length}</div>
              <div className="flex gap-2">
                {step > 0 && (
                  <Button variant="outline" onClick={() => setStep((current) => current - 1)}>Back</Button>
                )}
                {step < APP_STEP_LABELS.length - 1 ? (
                  <Button
                    onClick={() => {
                      if (!validateStep()) return;
                      setStep((current) => current + 1);
                    }}
                  >
                    Continue <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={submitting} className="min-w-[180px]">
                    {submitting ? 'Submitting...' : 'Submit runner application'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PricingGuidePanel({
  pricingGuide,
  reward,
  compact = false,
}: {
  pricingGuide: RunnerPricingGuide;
  reward?: number | null;
  compact?: boolean;
}) {
  const tone = getBudgetToneCopy(pricingGuide);

  return (
    <div className={`rounded-3xl border ${tone.cardClass} ${compact ? 'p-3 space-y-2' : 'p-4 space-y-3'}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Smart pricing guide</p>
          <p className={`${compact ? 'text-sm' : 'text-base'} font-semibold`}>{formatPrice(pricingGuide.suggestedMin)} – {formatPrice(pricingGuide.suggestedMax)}</p>
        </div>
        <Badge className={tone.badgeClass}>{tone.label}</Badge>
      </div>

      <p className="text-xs text-muted-foreground leading-6">{tone.description}</p>

      <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'sm:grid-cols-3'}`}>
        <div className="rounded-2xl border bg-background/70 p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Recommended</p>
          <p className="font-semibold">{formatPrice(pricingGuide.recommended)}</p>
        </div>
        <div className="rounded-2xl border bg-background/70 p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Route</p>
          <p className="font-semibold text-sm">{pricingGuide.routeLabel}</p>
        </div>
        <div className="rounded-2xl border bg-background/70 p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Confidence</p>
          <p className="font-semibold text-sm">{pricingGuide.confidenceLabel}</p>
        </div>
      </div>

      {!compact && typeof reward === 'number' && reward > 0 && (
        <div className="text-xs text-muted-foreground">
          Your current budget is <span className="font-semibold text-foreground">{formatPrice(reward)}</span>.
        </div>
      )}
    </div>
  );
}

function OfferComparisonSummary({
  task,
  applications,
}: {
  task: Task;
  applications: NonNullable<Task['applications']>;
}) {
  const pendingOffers = applications.filter((application) => application.status === 'pending');
  const lowestOffer = pendingOffers.reduce<number | null>((best, application) => {
    const currentValue = application.proposedPrice || task.reward;
    return best === null || currentValue < best ? currentValue : best;
  }, null);
  const exactMatches = pendingOffers.filter((application) => !application.proposedPrice || application.proposedPrice === task.reward).length;
  const freshOffers = pendingOffers.filter((application) => isFreshTimestamp(application.createdAt, LIVE_OFFER_WINDOW_MS)).length;

  return (
    <div className="grid gap-3 md:grid-cols-4">
      {[
        { label: 'Live offers', value: pendingOffers.length, caption: 'Still waiting for your decision' },
        { label: 'Best current price', value: lowestOffer ? formatPrice(lowestOffer) : formatPrice(task.reward), caption: lowestOffer && lowestOffer < task.reward ? `${formatPrice(task.reward - lowestOffer)} below budget` : 'At or above your budget' },
        { label: 'Exact matches', value: exactMatches, caption: 'Runners accepting your amount' },
        { label: 'Fresh offers', value: freshOffers, caption: 'Submitted in the live window' },
      ].map((item) => (
        <Card key={item.label} className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
            <p className="text-xl font-bold">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.caption}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RequestCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const urgencyClass = URGENCY_COLORS[task.urgency] || URGENCY_COLORS.medium;
  const budgetTone = getBudgetToneCopy(task.pricingGuide);
  const previewImage = parseTaskImages(task.images)[0] || null;
  const isLiveRequest = isFreshTimestamp(task.createdAt);

  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.985 }} className="cursor-pointer" onClick={onClick}>
      <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
        {previewImage && (
          <div className="px-4 pt-4">
            <img src={previewImage} alt={task.title} className="w-full h-36 rounded-2xl object-cover border" />
          </div>
        )}

        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-sm line-clamp-2 leading-tight flex-1">{task.title}</h3>
            <div className="flex flex-col items-end gap-1">
              {isLiveRequest && (
                <Badge className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                  Live now
                </Badge>
              )}
              <Badge className={`text-[10px] px-1.5 py-0.5 flex-shrink-0 ${urgencyClass}`}>
                {URGENCY_LABELS[task.urgency] || task.urgency}
              </Badge>
            </div>
          </div>

          <p className="text-primary font-bold text-lg mb-2">{formatPrice(task.reward)}</p>
          {task.pricingGuide && (
            <div className={`rounded-2xl border ${budgetTone.cardClass} px-3 py-2 mb-3`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Guide</span>
                <Badge className={budgetTone.badgeClass}>{budgetTone.label}</Badge>
              </div>
              <p className="text-xs font-semibold mt-1">{formatPrice(task.pricingGuide.suggestedMin)} – {formatPrice(task.pricingGuide.suggestedMax)}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{task.description}</p>

          <div className="rounded-2xl border bg-muted/20 px-3 py-2 mb-3 text-xs">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Route</p>
            <p className="font-medium line-clamp-2">{getRouteSummary(task.pickupLocation, task.location)}</p>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">{task.category}</Badge>
            {task.pickupLocation && (
              <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{task.pickupLocation}</span>
            )}
            {task.deadline && (
              <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{timeAgo(task.deadline)}</span>
            )}
          </div>

          <Separator className="my-2" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar className="w-5 h-5">
                <AvatarImage src={task.creator.avatar || undefined} />
                <AvatarFallback className="text-[8px]">{getInitials(task.creator.username)}</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate">{task.creator.username}</span>
            </div>
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Users className="w-3 h-3" />
              {task._count?.applications || 0} offers
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CreateTaskForm({ user, onCreated, onCancel }: { user: UserType; onCreated: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('');
  const [category, setCategory] = useState('Delivery');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const numericReward = reward ? parseFloat(reward) : NaN;
  const parsedReward = Number.isFinite(numericReward) ? numericReward : null;
  const progress = ((step + 1) / REQUEST_STEP_LABELS.length) * 100;

  const pricingGuide = useMemo(() => getRunnerPricingGuide({
    category,
    urgency,
    pickupLocation,
    dropoffLocation,
    deadline: deadline || null,
    reward: parsedReward,
  }), [category, urgency, pickupLocation, dropoffLocation, deadline, parsedReward]);

  const budgetTone = getBudgetToneCopy(pricingGuide);
  const supportImage = images[0] || null;

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      setImages([compressed]);
    } catch {
      toast({ title: 'Upload failed', description: 'Please try a different image.', variant: 'destructive' });
    }
  };

  const validateStep = (currentStep = step) => {
    if (currentStep === 0 && (!title.trim() || !description.trim() || !category)) {
      toast({ title: 'Finish the request basics', description: 'Add a title, request type, and a clear description.', variant: 'destructive' });
      return false;
    }

    if (currentStep === 1 && (!pickupLocation.trim() || !dropoffLocation.trim())) {
      toast({ title: 'Add the full route', description: 'Pickup and drop-off points are required for smart pricing.', variant: 'destructive' });
      return false;
    }

    if (currentStep === 2 && (!parsedReward || parsedReward <= 0)) {
      toast({ title: 'Set your budget', description: 'Enter a valid amount before posting the runner request.', variant: 'destructive' });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep(2)) return;

    setSubmitting(true);
    try {
      await api.post('/api/tasks', {
        creatorId: user.id,
        title: title.trim(),
        description: description.trim(),
        reward: parsedReward,
        category,
        location: dropoffLocation.trim(),
        pickupLocation: pickupLocation.trim(),
        urgency,
        deadline: deadline || null,
        images,
      });
      toast({ title: 'Runner request posted', description: 'Your route and budget are now live for approved runners.' });
      onCreated();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to create request', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="safe-top p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-muted"><ArrowLeft className="w-5 h-5" /></button>
        <div>
          <h2 className="font-bold text-2xl">Build a Runner request</h2>
          <p className="text-sm text-muted-foreground">Shape the route, set the timing, and land on a cleaner budget before you post.</p>
        </div>
      </div>

      <Card className="border-0 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-br from-primary/12 via-amber-500/10 to-background p-5 md:p-6 border-b space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Runner request builder</p>
                <h3 className="text-2xl md:text-3xl font-bold">Post smarter. Price clearer. Get better runner offers.</h3>
                <p className="text-sm text-muted-foreground mt-3 leading-7">
                  This phase upgrades Runner request posting with route-aware pricing guidance, cleaner timing signals, and a stronger first impression for approved runners.
                </p>
              </div>
              <div className="rounded-3xl border bg-background/75 p-4 min-w-[260px] space-y-2">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Live request preview</p>
                <p className="font-semibold line-clamp-2">{title.trim() || 'Your request title will appear here'}</p>
                <p className="text-sm text-muted-foreground">{category || 'Pick a request type'} · {getRouteSummary(pickupLocation, dropoffLocation)}</p>
                <p className="text-lg font-bold text-primary">{parsedReward ? formatPrice(parsedReward) : 'Set your budget'}</p>
              </div>
            </div>

            <Progress value={progress} className="h-2" />
            <div className="grid gap-3 md:grid-cols-3">
              {REQUEST_STEP_LABELS.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (index <= step) {
                      setStep(index);
                    }
                  }}
                  className={`rounded-full border px-4 py-3 text-sm transition-colors ${index === step ? 'border-primary bg-primary/8 text-foreground' : 'bg-background/70 text-muted-foreground hover:border-primary/30'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 md:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {step === 0 && (
                  <>
                    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Request title *</Label>
                          <Input placeholder="Pick up food from Jaja and drop in Moremi" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} />
                        </div>
                        <div>
                          <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Request type *</Label>
                          <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger><SelectValue placeholder="Select request type" /></SelectTrigger>
                            <SelectContent>
                              {TASK_CATEGORIES.map((item) => (
                                <SelectItem key={item} value={item}>{item}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">What exactly needs to happen? *</Label>
                          <Textarea
                            placeholder="Describe the errand, item size, handoff instructions, payment expectations, and anything that would help a runner say yes faster..."
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            rows={6}
                            maxLength={500}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-3xl border p-4 bg-muted/20">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">What good requests include</p>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            {[
                              'Exact item or task details',
                              'A realistic pickup and drop-off route',
                              'A budget that feels fair for the urgency',
                            ].map((item) => (
                              <div key={item} className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-3xl border p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Camera className="w-4 h-4 text-primary" />
                            <p className="font-semibold text-sm">Optional support photo</p>
                          </div>
                          <p className="text-xs text-muted-foreground">Show the package, print job, or item list if that will reduce back-and-forth.</p>
                          {supportImage ? (
                            <div className="space-y-3">
                              <img src={supportImage} alt="Request support" className="w-full aspect-[4/3] rounded-2xl object-cover border" />
                              <Button type="button" variant="outline" size="sm" onClick={() => setImages([])}>Remove image</Button>
                            </div>
                          ) : (
                            <label className="block rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer hover:border-primary/40 transition-colors">
                              <Camera className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm font-medium">Upload support photo</p>
                              <p className="text-xs text-muted-foreground mt-1">Optional · keeps the request clearer</p>
                              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {step === 1 && (
                  <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Pickup / start point *</Label>
                        <Input placeholder="e.g. Jaja Hall front desk" value={pickupLocation} onChange={(event) => setPickupLocation(event.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Drop-off / end point *</Label>
                        <Input placeholder="e.g. Moremi Hall reception" value={dropoffLocation} onChange={(event) => setDropoffLocation(event.target.value)} />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Urgency</Label>
                          <Select value={urgency} onValueChange={setUrgency}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Normal</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Preferred deadline</Label>
                          <Input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-3xl border p-4 bg-background/70">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Route summary</p>
                        <h4 className="font-semibold text-lg">{getRouteSummary(pickupLocation, dropoffLocation)}</h4>
                        <div className="grid gap-3 sm:grid-cols-2 mt-4 text-sm">
                          <div className="rounded-2xl border bg-muted/20 p-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Urgency</p>
                            <p className="font-semibold">{URGENCY_LABELS[urgency] || 'Normal'}</p>
                          </div>
                          <div className="rounded-2xl border bg-muted/20 p-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Timing</p>
                            <p className="font-semibold">{deadline ? new Date(deadline).toLocaleString() : 'Flexible timing'}</p>
                          </div>
                        </div>
                      </div>

                      <PricingGuidePanel pricingGuide={pricingGuide} compact />
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 block">What are you paying? *</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₦</span>
                          <Input type="number" placeholder={String(pricingGuide.recommended)} value={reward} onChange={(event) => setReward(event.target.value)} className="pl-8" min="0" />
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        {[
                          { label: 'Lean', value: pricingGuide.suggestedMin },
                          { label: 'Recommended', value: pricingGuide.recommended },
                          { label: 'Priority', value: pricingGuide.suggestedMax },
                        ].map((preset) => (
                          <Button key={preset.label} type="button" variant="outline" className="justify-between" onClick={() => setReward(String(preset.value))}>
                            <span>{preset.label}</span>
                            <span>{formatPrice(preset.value)}</span>
                          </Button>
                        ))}
                      </div>

                      <PricingGuidePanel pricingGuide={pricingGuide} reward={parsedReward} />

                      <div className={`rounded-3xl border p-4 ${budgetTone.cardClass}`}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Final review</p>
                            <h4 className="font-semibold text-lg">{title.trim() || 'Untitled request'}</h4>
                          </div>
                          <Badge className={budgetTone.badgeClass}>{budgetTone.label}</Badge>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3 mt-4 text-sm">
                          <div className="rounded-2xl border bg-background/70 p-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Route</p>
                            <p className="font-semibold leading-6">{getRouteSummary(pickupLocation, dropoffLocation)}</p>
                          </div>
                          <div className="rounded-2xl border bg-background/70 p-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Timing</p>
                            <p className="font-semibold">{deadline ? new Date(deadline).toLocaleString() : 'Flexible timing'}</p>
                          </div>
                          <div className="rounded-2xl border bg-background/70 p-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Budget</p>
                            <p className="font-semibold">{parsedReward ? formatPrice(parsedReward) : 'Set a budget'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border bg-muted/20 p-5 space-y-4 h-fit">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Why this helps</p>
                      <div className="space-y-3 text-sm text-muted-foreground leading-6">
                        <p>Runners can now judge the route faster because they see a cleaner pickup-to-drop-off story.</p>
                        <p>The budget guide is not surge pricing. It is just a cleaner benchmark based on request type, urgency, and route signal.</p>
                        <p>When your budget lands in range, you are more likely to get fast, cleaner offers instead of endless back-and-forth.</p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-5">
              <div className="text-xs text-muted-foreground">Step {step + 1} of {REQUEST_STEP_LABELS.length}</div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={step === 0 ? onCancel : () => setStep((current) => current - 1)}>
                  {step === 0 ? 'Cancel' : 'Back'}
                </Button>
                {step < REQUEST_STEP_LABELS.length - 1 ? (
                  <Button
                    type="button"
                    onClick={() => {
                      if (!validateStep(step)) return;
                      setStep((current) => current + 1);
                    }}
                  >
                    Continue <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={submitting} className="min-w-[190px]">
                    {submitting ? 'Posting...' : 'Post runner request'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TaskDetail({
  taskId,
  user,
  isApprovedRunner,
  currentApplication,
  onOpenRunnerApplication,
  onBack,
}: {
  taskId: string;
  user: UserType;
  isApprovedRunner: boolean;
  currentApplication: RunnerApplication | null;
  onOpenRunnerApplication: () => void;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyMsg, setApplyMsg] = useState('');
  const [proposedPrice, setProposedPrice] = useState('');
  const [applying, setApplying] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [offerDraftDirty, setOfferDraftDirty] = useState(false);
  const previousOfferCountRef = useRef<number | null>(null);

  const fetchTask = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const nextTask = await api.get(`/api/tasks/${taskId}`);
      setTask(nextTask);
      setLastSyncedAt(new Date());

      if (nextTask.creatorId === user.id) {
        const pendingOfferCount = nextTask.applications?.filter((application: NonNullable<Task['applications']>[number]) => application.status === 'pending').length ?? 0;
        if (previousOfferCountRef.current !== null && pendingOfferCount > previousOfferCountRef.current) {
          const addedOffers = pendingOfferCount - previousOfferCountRef.current;
          toast({
            title: addedOffers > 1 ? `${addedOffers} new offers arrived` : 'A new offer just landed',
            description: 'Runner is updating live. Compare the offers below.',
          });
        }
        previousOfferCountRef.current = pendingOfferCount;
      }
    } catch (error) {
      console.error(error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [taskId, toast, user.id]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  useEffect(() => {
    if (!task || !['open', 'assigned', 'in_progress'].includes(task.status)) return;

    const timer = setInterval(() => {
      fetchTask({ silent: true });
    }, 8000);

    return () => clearInterval(timer);
  }, [fetchTask, task]);

  useEffect(() => {
    api.patch('/api/notifications/read', { userId: user.id, taskId }).catch(console.error);
  }, [taskId, user.id]);

  useEffect(() => {
    const nextRunnerApplication = task?.applications?.find((application) => application.runnerId === user.id) || null;
    if (!nextRunnerApplication || offerDraftDirty) return;

    setApplyMsg(nextRunnerApplication.message || '');
    setProposedPrice(nextRunnerApplication.proposedPrice ? String(nextRunnerApplication.proposedPrice) : '');
  }, [offerDraftDirty, task, user.id]);

  const handleApply = async () => {
    setApplying(true);
    try {
      await api.post(`/api/tasks/${taskId}/apply`, {
        runnerId: user.id,
        message: applyMsg,
        proposedPrice: proposedPrice || null,
      });
      toast({
        title: task?.applications?.some((application) => application.runnerId === user.id) ? 'Offer updated' : 'Offer sent',
        description: 'The customer can compare your live offer immediately.',
      });
      setOfferDraftDirty(false);
      await fetchTask({ silent: true });
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to apply', variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const handleAccept = async (applicationId: string) => {
    try {
      await api.patch(`/api/tasks/${taskId}/apply`, { applicationId, action: 'accept' });
      toast({ title: 'Runner selected', description: 'The accepted runner has been notified.' });
      await fetchTask();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleUpdateStatus = async (status: string) => {
    try {
      await api.patch(`/api/tasks/${taskId}`, { status });
      toast({ title: `Request ${status.replace('_', ' ')}` });
      await fetchTask();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading request...</div>;
  if (!task) return <div className="p-8 text-center text-muted-foreground">Runner request not found</div>;

  const isCreator = task.creatorId === user.id;
  const runnerApplication = task.applications?.find((application) => application.runnerId === user.id) || null;
  const hasApplied = Boolean(runnerApplication);
  const isAssigned = task.assignedRunnerId === user.id;
  const previewImage = parseTaskImages(task.images)[0] || null;
  const budgetTone = getBudgetToneCopy(task.pricingGuide);
  const priceDifference = task.pricingGuide ? task.reward - task.pricingGuide.recommended : 0;
  const canManageOffer = !isCreator && isApprovedRunner && task.status === 'open' && runnerApplication?.status !== 'accepted';
  const sortedApplications = sortOfferApplications(task, task.applications || []);
  const lowestPendingOffer = sortedApplications.reduce<number | null>((best, application) => {
    if (application.status !== 'pending') return best;
    const currentValue = application.proposedPrice || task.reward;
    return best === null || currentValue < best ? currentValue : best;
  }, null);

  return (
    <div className="safe-top p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-muted"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="font-bold text-lg flex-1">Runner request</h2>
        <Badge className={URGENCY_COLORS[task.urgency]}>{URGENCY_LABELS[task.urgency]}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 border-primary/30 text-primary">
          <Radio className="w-3 h-3" /> Live board
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">{formatLiveSyncLabel(lastSyncedAt)}</Badge>
        {(task._count?.applications || 0) > 0 && (
          <Badge variant="secondary" className="rounded-full px-3 py-1">{task._count?.applications} total offers</Badge>
        )}
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-br from-primary/10 via-amber-500/10 to-background p-5 border-b">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Badge variant="outline">{task.category}</Badge>
              <div className="flex items-center gap-2 flex-wrap">
                {task.pricingGuide && <Badge className={budgetTone.badgeClass}>{budgetTone.label}</Badge>}
                <Badge variant={task.status === 'open' ? 'default' : 'secondary'}>{TASK_STATUS_LABELS[task.status]}</Badge>
              </div>
            </div>
            <h3 className="font-bold text-2xl mt-3">{task.title}</h3>
            <p className="text-3xl font-bold text-primary mt-3">{formatPrice(task.reward)}</p>
            {task.pricingGuide && (
              <p className="text-sm text-muted-foreground mt-2">
                Smart guide: {formatPrice(task.pricingGuide.suggestedMin)} – {formatPrice(task.pricingGuide.suggestedMax)} · {task.pricingGuide.routeLabel}
              </p>
            )}
          </div>

          <div className="p-5 space-y-4">
            {previewImage && <img src={previewImage} alt={task.title} className="w-full aspect-[16/9] rounded-3xl object-cover border" />}
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <div className="rounded-2xl border bg-muted/20 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Pickup</p>
                <p className="font-medium">{task.pickupLocation || 'Not set'}</p>
              </div>
              <div className="rounded-2xl border bg-muted/20 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Drop-off</p>
                <p className="font-medium">{task.location || 'Not set'}</p>
              </div>
              <div className="rounded-2xl border bg-muted/20 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Deadline</p>
                <p className="font-medium">{task.deadline ? new Date(task.deadline).toLocaleString() : 'Flexible timing'}</p>
              </div>
            </div>

            {task.pricingGuide && <PricingGuidePanel pricingGuide={task.pricingGuide} reward={task.reward} />}

            {task.pricingGuide && (
              <div className={`rounded-2xl border p-3 text-sm ${budgetTone.cardClass}`}>
                {task.pricingGuide.budgetPosition === 'low'
                  ? `This request is ${formatPrice(Math.abs(priceDifference))} below the current recommendation. Counter-offers are more likely.`
                  : task.pricingGuide.budgetPosition === 'premium'
                    ? `This request is ${formatPrice(Math.abs(priceDifference))} above the current recommendation. Faster responses are more likely.`
                    : 'This request sits in the current guide range and should feel balanced to runners.'}
              </div>
            )}

            <Separator />
            <div className="flex items-center gap-2">
              <Avatar className="w-9 h-9">
                <AvatarImage src={task.creator.avatar || undefined} />
                <AvatarFallback>{getInitials(task.creator.username)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{task.creator.username}</p>
                <p className="text-[10px] text-muted-foreground">Posted {timeAgo(task.createdAt)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isCreator && task.status === 'open' && (
        isApprovedRunner ? (
          canManageOffer ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="font-semibold text-sm">{hasApplied ? 'Your live runner offer' : 'Send your runner offer'}</h4>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {hasApplied
                      ? 'Your offer is already visible in the live marketplace. Refresh the price or note any time before the customer chooses.'
                      : 'Accept the posted amount or counter with your own number. The customer can compare every offer live.'}
                  </p>
                </div>
                <Badge variant="secondary" className="rounded-full px-3 py-1">{formatLiveSyncLabel(lastSyncedAt)}</Badge>
              </div>

              {hasApplied && (
                <div className="rounded-2xl border bg-primary/5 p-3 text-xs text-muted-foreground">
                  Your current offer is live. Saving changes here immediately refreshes what the customer sees.
                </div>
              )}

              {task.pricingGuide && (
                <div className={`rounded-2xl border p-3 text-xs ${budgetTone.cardClass}`}>
                  {task.pricingGuide.budgetPosition === 'low'
                    ? 'Budget is under the guide. A counter-offer may feel more realistic for this route.'
                    : task.pricingGuide.budgetPosition === 'premium'
                      ? 'Budget is above the guide. Matching the posted amount could help you win quickly.'
                      : 'Budget is in range. You can accept the posted amount or adjust slightly based on your ETA.'}
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Your price (leave blank to accept {formatPrice(task.reward)})</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">₦</span>
                  <Input type="number" placeholder={String(task.reward)} value={proposedPrice} onChange={(event) => { setProposedPrice(event.target.value); setOfferDraftDirty(true); }} className="pl-8" min="0" />
                </div>
              </div>
              <Textarea placeholder="Optional note: ETA, route confidence, care for package, etc." value={applyMsg} onChange={(event) => { setApplyMsg(event.target.value); setOfferDraftDirty(true); }} rows={2} />
              <div className="flex flex-col gap-2 sm:flex-row">
                {hasApplied && (
                  <Button
                    type="button"
                    variant="outline"
                    className="sm:w-auto"
                    onClick={() => {
                      setApplyMsg(runnerApplication?.message || '');
                      setProposedPrice(runnerApplication?.proposedPrice ? String(runnerApplication.proposedPrice) : '');
                      setOfferDraftDirty(false);
                    }}
                  >
                    Reset
                  </Button>
                )}
                <Button onClick={handleApply} disabled={applying} className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  {applying
                    ? hasApplied ? 'Updating...' : 'Sending...'
                    : hasApplied
                      ? proposedPrice ? `Update to ₦${parseInt(proposedPrice, 10).toLocaleString()}` : `Refresh at ${formatPrice(task.reward)}`
                      : proposedPrice ? `Offer ₦${parseInt(proposedPrice, 10).toLocaleString()}` : `Accept ${formatPrice(task.reward)}`}
                </Button>
              </div>
            </CardContent>
          </Card>
          ) : null
        ) : currentApplication ? (
          <RunnerStatusPanel application={currentApplication} onPrimaryAction={onOpenRunnerApplication} />
        ) : (
          <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
            <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Become a verified Runner to send offers</p>
                <p className="text-xs text-muted-foreground mt-1">Customers can only accept offers from approved runners with reviewed documents.</p>
              </div>
              <Button onClick={onOpenRunnerApplication}>Become a Runner</Button>
            </CardContent>
          </Card>
        )
      )}

      {hasApplied && !isAssigned && !canManageOffer && runnerApplication?.status !== 'rejected' && (
        <Card className="border-0 shadow-sm bg-primary/5">
          <CardContent className="p-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <p className="text-sm font-medium">Your offer is in. The customer can choose you at any time.</p>
          </CardContent>
        </Card>
      )}

      {runnerApplication?.status === 'rejected' && !isAssigned && (
        <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Your last offer was skipped. If the customer keeps the request open, you can still refresh it from the live offer form above.
          </CardContent>
        </Card>
      )}

      {isAssigned && (
        <Card className="border-0 shadow-sm bg-emerald-50 dark:bg-emerald-900/20">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">You are the selected runner for this request.</p>
            </div>
            {task.status === 'assigned' && (
              <Button size="sm" onClick={() => handleUpdateStatus('in_progress')}>Start request</Button>
            )}
            {task.status === 'in_progress' && (
              <Button size="sm" onClick={() => handleUpdateStatus('completed')}>Mark delivered</Button>
            )}
          </CardContent>
        </Card>
      )}

      {isCreator && task.applications && task.applications.length > 0 && (
        <>
          <OfferComparisonSummary task={task} applications={task.applications} />

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h4 className="font-semibold text-sm">Runner offers ({task.applications.length})</h4>
                <p className="text-[11px] text-muted-foreground">{formatLiveSyncLabel(lastSyncedAt)}</p>
              </div>
              {sortedApplications.map((application) => {
                const offerValue = application.proposedPrice || task.reward;
                const isBestValue = application.status === 'pending' && lowestPendingOffer !== null && offerValue === lowestPendingOffer;
                const isExactMatch = !application.proposedPrice || application.proposedPrice === task.reward;
                const isFreshOffer = isFreshTimestamp(application.createdAt, LIVE_OFFER_WINDOW_MS);

                return (
              <div key={application.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="w-9 h-9">
                  <AvatarImage src={application.runner.avatar || undefined} />
                  <AvatarFallback>{getInitials(application.runner.username)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{application.runner.username}</p>
                    {isFreshOffer && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Latest</Badge>}
                    {isBestValue && <Badge className="bg-primary/10 text-primary text-[10px]">Best value</Badge>}
                    {isExactMatch && application.status === 'pending' && <Badge className="bg-blue-100 text-blue-700 text-[10px]">Exact amount</Badge>}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{application.runner.tasksCompleted} completed · ★ {application.runner.runnerRating.toFixed(1)} · sent {timeAgo(application.createdAt)}</p>
                  {application.proposedPrice && application.proposedPrice !== task.reward ? (
                    <p className="text-xs font-bold text-amber-600 mt-0.5">
                      Offers {formatPrice(application.proposedPrice)}
                      {application.proposedPrice > task.reward ? (
                        <span className="text-[10px] text-muted-foreground font-normal"> (+{formatPrice(application.proposedPrice - task.reward)})</span>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-normal"> (saves {formatPrice(task.reward - application.proposedPrice)})</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-600 mt-0.5">Accepts your exact amount</p>
                  )}
                  {application.message && <p className="text-[11px] text-muted-foreground mt-0.5 italic">“{application.message}”</p>}
                </div>
                {application.status === 'pending' && task.status === 'open' && (
                  <Button size="sm" className="h-8 text-xs px-3" onClick={() => handleAccept(application.id)}>Choose</Button>
                )}
                {application.status === 'accepted' && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Chosen</Badge>}
                {application.status === 'rejected' && <Badge variant="secondary" className="text-[10px]">Skipped</Badge>}
              </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {isCreator && task.status === 'open' && (
        <Button variant="destructive" size="sm" onClick={() => handleUpdateStatus('cancelled')} className="w-full">Cancel request</Button>
      )}
    </div>
  );
}

export default function TasksView({
  user,
  initialTaskId,
  onInitialTaskOpened,
}: {
  user: UserType;
  initialTaskId?: string | null;
  onInitialTaskOpened?: () => void;
}) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myRequests, setMyRequests] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [marketplaceSort, setMarketplaceSort] = useState<MarketplaceSortMode>('live');
  const [entryMode, setEntryMode] = useState<RunnerEntryMode>('intro');
  const [currentApplication, setCurrentApplication] = useState<RunnerApplication | null>(null);
  const [applicationLoading, setApplicationLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [refreshingMarketplace, setRefreshingMarketplace] = useState(false);
  const [liveActivityCount, setLiveActivityCount] = useState(0);
  const previousMarketplaceIdsRef = useRef<Set<string> | null>(null);
  const previousMyRequestOfferCountsRef = useRef<Map<string, number> | null>(null);

  const fetchTasks = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent) {
      setRefreshingMarketplace(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({ status: 'open', limit: '30' });
      if (categoryFilter) params.set('category', categoryFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const [marketplaceData, mineData] = await Promise.all([
        api.get(`/api/tasks?${params.toString()}`),
        api.get(`/api/tasks?creatorId=${user.id}&status=all&limit=12`),
      ]);

      const nextMarketplaceTasks = marketplaceData.tasks || [];
      const nextMineTasks = (mineData.tasks || []).slice(0, 4);

      if (silent) {
        let detectedLiveActivity = 0;

        const nextMarketplaceIds = new Set(nextMarketplaceTasks.map((task: Task) => task.id));
        if (entryMode === 'runner' && previousMarketplaceIdsRef.current) {
          detectedLiveActivity += nextMarketplaceTasks.filter((task: Task) => !previousMarketplaceIdsRef.current?.has(task.id)).length;
        }

        const nextMyRequestOfferCounts = new Map(nextMineTasks.map((task: Task) => [task.id, task._count?.applications || 0]));
        if (entryMode === 'customer' && previousMyRequestOfferCountsRef.current) {
          detectedLiveActivity += nextMineTasks.reduce((total: number, task: Task) => {
            const previousCount = previousMyRequestOfferCountsRef.current?.get(task.id) || 0;
            const currentCount = task._count?.applications || 0;
            return currentCount > previousCount ? total + (currentCount - previousCount) : total;
          }, 0);

          if (detectedLiveActivity > 0) {
            toast({
              title: detectedLiveActivity > 1 ? `${detectedLiveActivity} live updates` : 'A live update just landed',
              description: entryMode === 'customer' ? 'Your request activity changed. Open the request to compare offers.' : 'New runner-marketplace activity is available.',
            });
          }
        }

        setLiveActivityCount(detectedLiveActivity);
        previousMarketplaceIdsRef.current = nextMarketplaceIds;
        previousMyRequestOfferCountsRef.current = nextMyRequestOfferCounts;
      } else {
        previousMarketplaceIdsRef.current = new Set(nextMarketplaceTasks.map((task: Task) => task.id));
        previousMyRequestOfferCountsRef.current = new Map(nextMineTasks.map((task: Task) => [task.id, task._count?.applications || 0]));
        setLiveActivityCount(0);
      }

      setTasks(nextMarketplaceTasks);
      setMyRequests(nextMineTasks);
      setLastSyncedAt(new Date());
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      if (silent) {
        setRefreshingMarketplace(false);
      } else {
        setLoading(false);
      }
    }
  }, [categoryFilter, searchQuery, entryMode, toast, user.id]);

  const fetchApplicationState = useCallback(async () => {
    setApplicationLoading(true);
    try {
      const data = await api.get('/api/runner-applications?scope=self');
      setCurrentApplication(data.currentApplication || null);
    } catch (error) {
      console.error('Failed to fetch runner application state:', error);
      setCurrentApplication(null);
    } finally {
      setApplicationLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (showCreate || selectedTaskId || entryMode === 'intro' || entryMode === 'runner_apply') return;

    const timer = setInterval(() => {
      fetchTasks({ silent: true });
    }, 12000);

    return () => clearInterval(timer);
  }, [entryMode, fetchTasks, selectedTaskId, showCreate]);

  useEffect(() => {
    fetchApplicationState();
  }, [fetchApplicationState]);

  useEffect(() => {
    if (currentApplication?.status !== 'pending') return;
    const timer = setInterval(fetchApplicationState, 30000);
    return () => clearInterval(timer);
  }, [currentApplication?.status, fetchApplicationState]);

  useEffect(() => {
    if (!initialTaskId) return;
    setSelectedTaskId(initialTaskId);
    onInitialTaskOpened?.();
  }, [initialTaskId, onInitialTaskOpened]);

  const isApprovedRunner = user.isRunner || currentApplication?.status === 'approved';

  useEffect(() => {
    const savedMode = localStorage.getItem(getRunnerStorageKey(user.id));

    if (isApprovedRunner) {
      setEntryMode('runner');
      return;
    }

    if (savedMode === 'customer') {
      setEntryMode('customer');
      return;
    }

    if (savedMode === 'runner') {
      setEntryMode('runner_apply');
      return;
    }

    setEntryMode('intro');
  }, [user.id, isApprovedRunner]);

  const persistMode = (mode: 'customer' | 'runner') => {
    localStorage.setItem(getRunnerStorageKey(user.id), mode);
  };

  const openCustomerView = () => {
    persistMode('customer');
    setEntryMode('customer');
  };

  const openRunnerApply = () => {
    persistMode('runner');
    setEntryMode(isApprovedRunner ? 'runner' : 'runner_apply');
  };

  const marketplaceTasks = useMemo(
    () => sortMarketplaceTasks(tasks.filter((task) => task.creatorId !== user.id), marketplaceSort),
    [marketplaceSort, tasks, user.id],
  );

  const liveMarketplaceStats = useMemo(() => {
    return {
      freshRequests: marketplaceTasks.filter((task) => isFreshTimestamp(task.createdAt)).length,
      urgentRequests: marketplaceTasks.filter((task) => task.urgency === 'urgent' || task.urgency === 'high').length,
      inGuideRequests: marketplaceTasks.filter((task) => task.pricingGuide?.budgetPosition === 'fair').length,
    };
  }, [marketplaceTasks]);

  if (selectedTaskId) {
    return (
      <TaskDetail
        taskId={selectedTaskId}
        user={user}
        isApprovedRunner={isApprovedRunner}
        currentApplication={currentApplication}
        onOpenRunnerApplication={openRunnerApply}
        onBack={() => {
          setSelectedTaskId(null);
          fetchTasks();
          fetchApplicationState();
        }}
      />
    );
  }

  if (showCreate) {
    return (
      <CreateTaskForm
        user={user}
        onCreated={() => {
          setShowCreate(false);
          fetchTasks();
        }}
        onCancel={() => setShowCreate(false)}
      />
    );
  }

  if (applicationLoading && entryMode === 'runner_apply') {
    return <div className="p-8 text-center text-muted-foreground">Loading runner application...</div>;
  }

  if (entryMode === 'runner_apply') {
    return (
      <div className="safe-top px-4 py-5 max-w-5xl mx-auto">
        <RunnerApplicationFlow
          user={user}
          currentApplication={currentApplication}
          onSubmitted={(application) => setCurrentApplication(application)}
          onBack={() => setEntryMode('customer')}
          onApproved={() => setEntryMode('runner')}
        />
      </div>
    );
  }

  if (entryMode === 'intro') {
    return (
      <div className="safe-top px-4 py-5 max-w-6xl mx-auto space-y-5">
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-br from-primary/15 via-amber-500/10 to-background p-6 md:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="max-w-2xl">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground mb-3">Runner</p>
                  <h1 className="text-3xl md:text-4xl font-bold leading-tight">Campus delivery, errands, and smart runner requests inside UNILAG Marketplace.</h1>
                  <p className="text-sm md:text-base text-muted-foreground mt-4 leading-7">
                    Post what you need, compare runner offers, and manage requests in one focused space. Or become a verified Runner and earn by helping students around campus.
                  </p>
                </div>
                <div className="rounded-[2rem] bg-background/80 border shadow-lg p-5 w-full max-w-sm">
                  <div className="space-y-3 text-sm">
                    {[
                      'Guided request builder with smart campus pricing',
                      'Live runner marketplace with real-time offer refresh',
                      'Premium runner onboarding with documents',
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 mt-8">
                <button onClick={openCustomerView} className="rounded-[2rem] bg-primary text-primary-foreground px-5 py-5 text-left shadow-lg hover:bg-primary/90 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.25em] opacity-80 mb-2">Customer view</p>
                      <p className="text-2xl font-bold">Continue as Customer</p>
                      <p className="text-sm opacity-80 mt-2">Post runner requests, manage your errands, and choose the best offer when it matters.</p>
                    </div>
                    <ChevronRight className="w-5 h-5 flex-shrink-0" />
                  </div>
                </button>

                <button onClick={openRunnerApply} className="rounded-[2rem] border bg-background/85 px-5 py-5 text-left shadow-lg hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Runner path</p>
                      <p className="text-2xl font-bold">Become a Runner</p>
                      <p className="text-sm text-muted-foreground mt-2">Submit your profile, get approved by admin, and unlock the runner dashboard and offer tools.</p>
                    </div>
                    <ChevronRight className="w-5 h-5 flex-shrink-0 text-primary" />
                  </div>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: 'Clean first impression',
              description: 'Runner feels like its own premium campus service, not a leftover task tab.',
            },
            {
              icon: ShieldCheck,
              title: 'Admin-controlled trust',
              description: 'Every runner goes through document review before the marketplace lets them send offers.',
            },
            {
              icon: Route,
              title: 'Built for delivery growth',
              description: 'Runner now supports live request discovery and faster offer comparison without jumping into maps or delivery ops yet.',
            },
          ].map((item) => (
            <Card key={item.title} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-base">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-6">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 z-30 safe-top bg-background/95 backdrop-blur-sm border-b px-4 py-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-primary border-primary/30">
                  {entryMode === 'runner' ? 'Runner dashboard' : 'Customer dashboard'}
                </Badge>
                {isApprovedRunner && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-300/40 rounded-full">
                    <ShieldCheck className="w-3 h-3 mr-1" /> Approved Runner
                  </Badge>
                )}
              </div>
              <h1 className="font-bold text-2xl mt-3">{entryMode === 'runner' ? 'Runner' : 'Runner requests'}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {entryMode === 'runner'
                  ? 'Browse requests, manage your runner identity, and stay ready for campus delivery opportunities.'
                  : 'Post errands, monitor your requests, and upgrade into the verified Runner side whenever you are ready.'}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="outline" className="rounded-full px-3 py-1 gap-1.5 border-primary/30 text-primary">
                  <Radio className="w-3 h-3" /> Live marketplace
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">{formatLiveSyncLabel(lastSyncedAt)}</Badge>
                {liveActivityCount > 0 && (
                  <Badge className="rounded-full px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                    +{liveActivityCount} new {entryMode === 'runner' ? 'requests' : 'offer updates'}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!isApprovedRunner && (
                <Button variant="outline" onClick={openRunnerApply} className="gap-2">
                  <ShieldCheck className="w-4 h-4" /> Become a Runner
                </Button>
              )}
              {entryMode === 'customer' && (
                <Button onClick={() => setShowCreate(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Post request
                </Button>
              )}
              <Button variant="outline" onClick={() => fetchTasks({ silent: true })} className="gap-2" disabled={refreshingMarketplace}>
                <RefreshCcw className={`w-4 h-4 ${refreshingMarketplace ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              <Button variant="ghost" onClick={() => setEntryMode('intro')}>View intro</Button>
            </div>
          </div>

          {entryMode === 'customer' ? (
            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <Card className="border-0 shadow-md overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-gradient-to-br from-primary/15 via-amber-500/10 to-background p-5 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                      <div className="max-w-2xl">
                        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Customer lane</p>
                        <h2 className="text-2xl font-bold">Turn campus errands into clean, trackable requests.</h2>
                        <p className="text-sm text-muted-foreground mt-3 leading-7">
                          Post the errand, get a cleaner route-aware budget guide, and keep every runner conversation in one place. The live board below now refreshes automatically so fresh offers are easier to catch.
                        </p>
                      </div>
                      <Button onClick={() => setShowCreate(true)} className="min-w-[180px] h-11">Create request</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                {[
                  { label: 'Open requests', value: tasks.length, icon: Route },
                  { label: 'Your recent posts', value: myRequests.length, icon: Users },
                  { label: 'Runner-ready mode', value: currentApplication?.status === 'pending' ? 'Pending' : 'Open', icon: ShieldCheck },
                ].map((item) => (
                  <Card key={item.label} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                        <item.icon className="w-5 h-5 text-primary" />
                      </div>
                      <p className="text-2xl font-bold">{item.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-0 shadow-md overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-gradient-to-br from-emerald-500/15 via-primary/10 to-background p-5 md:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                      <div className="max-w-2xl">
                        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Approved Runner</p>
                        <h2 className="text-2xl font-bold">Your Runner identity is live.</h2>
                        <p className="text-sm text-muted-foreground mt-3 leading-7">
                          Browse customer requests, send cleaner offers, and build trust with every completed errand. This dashboard now behaves more like a live marketplace so new requests surface faster.
                        </p>
                      </div>
                      <div className="rounded-3xl border bg-background/75 px-4 py-3 min-w-[240px]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Availability</p>
                            <p className="font-semibold">{isAvailable ? 'Available for new requests' : 'Taking a short break'}</p>
                          </div>
                          <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-3">
                {[
                  { label: 'Completed', value: user.tasksCompleted, icon: CheckCircle2 },
                  { label: 'Rating', value: user.runnerRating > 0 ? user.runnerRating.toFixed(1) : 'New', icon: Star },
                  { label: 'Open requests', value: marketplaceTasks.length, icon: Route },
                ].map((item) => (
                  <Card key={item.label} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                        <item.icon className="w-5 h-5 text-primary" />
                      </div>
                      <p className="text-2xl font-bold">{item.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {currentApplication && entryMode === 'customer' && currentApplication.status !== 'approved' && (
            <RunnerStatusPanel application={currentApplication} onPrimaryAction={openRunnerApply} />
          )}

          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={entryMode === 'runner' ? 'Search by route, request title, or customer note' : 'Search the live request board'}
                className="pl-9"
              />
            </div>

            <Select value={marketplaceSort} onValueChange={(value) => setMarketplaceSort(value as MarketplaceSortMode)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort the live board" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="live">Newest first</SelectItem>
                <SelectItem value="urgent">Urgent first</SelectItem>
                <SelectItem value="best_budget">Best budget fit</SelectItem>
                <SelectItem value="highest_budget">Highest budget</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Live now', value: liveMarketplaceStats.freshRequests, caption: 'Fresh requests in the board', accent: 'bg-emerald-500/10 text-emerald-600' },
              { label: 'Urgent now', value: liveMarketplaceStats.urgentRequests, caption: 'High-priority requests', accent: 'bg-amber-500/10 text-amber-600' },
              { label: 'In guide', value: liveMarketplaceStats.inGuideRequests, caption: 'Budgets near the pricing guide', accent: 'bg-primary/10 text-primary' },
            ].map((item) => (
              <Card key={item.label} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${item.accent}`}>
                    <Radio className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className="text-xs font-medium mt-1">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.caption}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            <Badge variant={categoryFilter === '' ? 'default' : 'outline'} className="cursor-pointer flex-shrink-0" onClick={() => setCategoryFilter('')}>All requests</Badge>
            {TASK_CATEGORIES.map((category) => (
              <Badge key={category} variant={categoryFilter === category ? 'default' : 'outline'} className="cursor-pointer flex-shrink-0 whitespace-nowrap" onClick={() => setCategoryFilter(categoryFilter === category ? '' : category)}>{category}</Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-6xl mx-auto space-y-6">
        {entryMode === 'customer' && myRequests.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-base">Your recent requests</h3>
                <p className="text-sm text-muted-foreground">Keep an eye on what you have already posted inside Runner.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>Post another</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {myRequests.map((task) => (
                <RequestCard key={task.id} task={task} onClick={() => setSelectedTaskId(task.id)} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-base">{entryMode === 'runner' ? 'Open runner requests nearby' : 'Open requests from campus customers'}</h3>
              <p className="text-sm text-muted-foreground">
                {entryMode === 'runner'
                  ? 'Browse requests you can offer on right now. The board refreshes automatically in the background.'
                  : 'See how other customer requests are being structured inside Runner and watch live offer activity build.'}
              </p>
            </div>
            {entryMode === 'customer' && (
              <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1">
                <Plus className="w-3.5 h-3.5" /> Post request
              </Button>
            )}
          </div>

          {loading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="border-0 shadow-sm">
                  <CardContent className="p-4 space-y-2">
                    <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                    <div className="h-6 w-1/3 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-full bg-muted rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : marketplaceTasks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Route className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No runner requests yet</p>
              <p className="text-sm mb-4">Be the first to open up Runner on campus.</p>
              {entryMode === 'customer' && <Button variant="outline" onClick={() => setShowCreate(true)}>Post a request</Button>}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {marketplaceTasks.map((task) => (
                <RequestCard key={task.id} task={task} onClick={() => setSelectedTaskId(task.id)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
