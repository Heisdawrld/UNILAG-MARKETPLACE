'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Clock, Zap, ArrowLeft, Send, CheckCircle2,
  Plus, Filter, Users, Award, AlertTriangle, ChevronRight, Camera,
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
import { useToast } from '@/hooks/use-toast';
import {
  User as UserType, Task, TaskApplication,
  TASK_CATEGORIES, URGENCY_LABELS, URGENCY_COLORS,
  TASK_STATUS_LABELS,
} from '@/lib/types';
import { formatPrice, timeAgo, getInitials } from '@/lib/marketplace-utils';

const api = {
  get: async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  },
  post: async (url: string, body?: unknown) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  },
  patch: async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Update failed');
    return res.json();
  },
};

// ── Runner Application Card ──
function RunnerApplicationCard({ user, onApplied }: { user: UserType; onApplied: () => void }) {
  const { toast } = useToast();
  const [studentId, setStudentId] = useState('');
  const [motivation, setMotivation] = useState('');
  const [availability, setAvailability] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [selfie, setSelfie] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleSelfie = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 500;
        let w = img.width; let h = img.height;
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
        else { if (h > MAX) { w *= MAX / h; h = MAX; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        setSelfie(canvas.toDataURL('image/webp', 0.85));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleApply = async () => {
    if (!studentId.trim()) {
      toast({ title: 'Student ID required', variant: 'destructive' }); return;
    }
    if (!selfie) {
      toast({ title: 'Selfie/ID photo required', description: 'Upload a clear photo for verification', variant: 'destructive' }); return;
    }
    if (!emergencyContact.trim()) {
      toast({ title: 'Emergency contact required', variant: 'destructive' }); return;
    }
    setSubmitting(true);
    try {
      await fetch('/api/runner-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          studentId,
          motivation,
          availability,
          emergencyContact,
          selfie,
          username: user.username,
          email: user.email,
          phone: user.phone || '',
          faculty: user.faculty || '',
          hostel: user.hostel || '',
        }),
      });
      setApplied(true);
      onApplied();
    } catch {
      toast({ title: 'Failed to submit', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  if (applied) {
    return (
      <Card className="border-0 shadow-sm bg-amber-50 dark:bg-amber-900/20">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Application submitted!</p>
            <p className="text-xs text-muted-foreground">Admin will review your details and approve you as a runner</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Become a Verified Runner</h4>
            <p className="text-xs text-muted-foreground">Runners handle real products. We verify your identity for safety.</p>
          </div>
        </div>

        {/* Selfie / ID Photo */}
        <div>
          <Label className="text-xs font-medium mb-1 block">Your Photo / Student ID Card *</Label>
          <div className="flex items-center gap-3">
            {selfie ? (
              <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-amber-400">
                <img src={selfie} alt="Selfie" className="w-full h-full object-cover" />
              </div>
            ) : (
              <label className="w-16 h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-amber-400 transition-colors">
                <Camera className="w-5 h-5 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground">Upload</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleSelfie} />
              </label>
            )}
            <p className="text-[10px] text-muted-foreground flex-1">Clear photo of yourself or your student ID card. This helps us verify your identity.</p>
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium mb-1 block">Student ID / Matric Number *</Label>
          <Input placeholder="e.g. 190405001" value={studentId} onChange={e => setStudentId(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs font-medium mb-1 block">Emergency Contact (Parent/Guardian) *</Label>
          <Input placeholder="e.g. 08012345678" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs font-medium mb-1 block">Why do you want to be a runner?</Label>
          <Textarea placeholder="Tell us about yourself and why you want to run errands on campus..." value={motivation} onChange={e => setMotivation(e.target.value)} rows={2} maxLength={300} />
        </div>
        <div>
          <Label className="text-xs font-medium mb-1 block">Available hours</Label>
          <Input placeholder="e.g. Weekdays 2pm-6pm, weekends anytime" value={availability} onChange={e => setAvailability(e.target.value)} />
        </div>
        <Button onClick={handleApply} disabled={submitting} className="w-full bg-amber-500 hover:bg-amber-600 text-white">
          {submitting ? 'Submitting...' : 'Apply to Become a Runner ⚡'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Task Card ──
function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const urgencyClass = URGENCY_COLORS[task.urgency] || URGENCY_COLORS.medium;
  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="cursor-pointer" onClick={onClick}>
      <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-sm line-clamp-2 leading-tight flex-1">{task.title}</h3>
            <Badge className={`text-[10px] px-1.5 py-0.5 flex-shrink-0 ${urgencyClass}`}>
              {URGENCY_LABELS[task.urgency] || task.urgency}
            </Badge>
          </div>
          <p className="text-primary font-bold text-lg mb-2">{formatPrice(task.reward)}</p>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{task.description}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
            <Badge variant="outline" className="text-[10px]">{task.category}</Badge>
            {task.location && (
              <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{task.location}</span>
            )}
            {task.deadline && (
              <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{timeAgo(task.deadline)}</span>
            )}
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Avatar className="w-5 h-5">
                <AvatarImage src={task.creator.avatar || undefined} />
                <AvatarFallback className="text-[8px]">{getInitials(task.creator.username)}</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">{task.creator.username}</span>
            </div>
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Users className="w-3 h-3" />
              {task._count?.applications || 0} applied
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Create Task Form ──
function CreateTaskForm({ user, onCreated, onCancel }: { user: UserType; onCreated: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title || !description || !reward || !category) {
      toast({ title: 'Missing fields', description: 'Fill in all required fields', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/tasks', { creatorId: user.id, title, description, reward, category, location, urgency });
      toast({ title: 'Task posted!', description: 'Runners can now apply' });
      onCreated();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-muted"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="font-bold text-xl">Post a Task</h2>
      </div>
      <div>
        <Label className="text-sm font-medium mb-1.5 block">Title *</Label>
        <Input placeholder="e.g., Pick up food from Jaja" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
      </div>
      <div>
        <Label className="text-sm font-medium mb-1.5 block">Description *</Label>
        <Textarea placeholder="Describe the task in detail..." value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={500} />
      </div>
      <div>
        <Label className="text-sm font-medium mb-1.5 block">Reward (₦) *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₦</span>
          <Input type="number" placeholder="500" value={reward} onChange={(e) => setReward(e.target.value)} className="pl-8" min="0" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Category *</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {TASK_CATEGORIES.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Urgency</Label>
          <Select value={urgency} onValueChange={setUrgency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">🔥 Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium mb-1.5 block">Location</Label>
        <Input placeholder="e.g., Moremi Hall" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <Button onClick={handleSubmit} disabled={submitting} className="w-full h-11">
        {submitting ? 'Posting...' : 'Post Task'}
      </Button>
    </div>
  );
}

// ── Task Detail ──
function TaskDetail({ taskId, user, onBack }: { taskId: string; user: UserType; onBack: () => void }) {
  const { toast } = useToast();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyMsg, setApplyMsg] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    api.get(`/api/tasks/${taskId}`).then(setTask).catch(console.error).finally(() => setLoading(false));
  }, [taskId]);

  const handleApply = async () => {
    setApplying(true);
    try {
      await api.post(`/api/tasks/${taskId}/apply`, { runnerId: user.id, message: applyMsg });
      toast({ title: 'Applied!', description: 'The task creator will review your application' });
      const updated = await api.get(`/api/tasks/${taskId}`);
      setTask(updated);
      setApplyMsg('');
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const handleAccept = async (applicationId: string) => {
    try {
      await api.patch(`/api/tasks/${taskId}/apply`, { applicationId, action: 'accept' });
      toast({ title: 'Runner accepted!' });
      const updated = await api.get(`/api/tasks/${taskId}`);
      setTask(updated);
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const handleUpdateStatus = async (status: string) => {
    try {
      await api.patch(`/api/tasks/${taskId}`, { status });
      toast({ title: `Task ${status.replace('_', ' ')}` });
      const updated = await api.get(`/api/tasks/${taskId}`);
      setTask(updated);
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!task) return <div className="p-8 text-center text-muted-foreground">Task not found</div>;

  const isCreator = task.creatorId === user.id;
  const hasApplied = task.applications?.some((a) => a.runnerId === user.id);
  const isAssigned = task.assignedRunnerId === user.id;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-muted"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="font-bold text-lg flex-1">Task Details</h2>
        <Badge className={URGENCY_COLORS[task.urgency]}>{URGENCY_LABELS[task.urgency]}</Badge>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline">{task.category}</Badge>
            <Badge variant={task.status === 'open' ? 'default' : 'secondary'}>{TASK_STATUS_LABELS[task.status]}</Badge>
          </div>
          <h3 className="font-bold text-xl">{task.title}</h3>
          <p className="text-2xl font-bold text-primary">{formatPrice(task.reward)}</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
          {task.location && <p className="text-sm flex items-center gap-1"><MapPin className="w-4 h-4" />{task.location}</p>}
          <Separator />
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={task.creator.avatar || undefined} />
              <AvatarFallback>{getInitials(task.creator.username)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{task.creator.username}</p>
              <p className="text-[10px] text-muted-foreground">Posted {timeAgo(task.createdAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Apply section — only for non-creators on open tasks */}
      {!isCreator && task.status === 'open' && !hasApplied && (
        user.isRunner ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <h4 className="font-semibold text-sm">Apply as Runner</h4>
              <Textarea placeholder="Why should they pick you? (optional)" value={applyMsg} onChange={(e) => setApplyMsg(e.target.value)} rows={2} />
              <Button onClick={handleApply} disabled={applying} className="w-full">
                <Send className="w-4 h-4 mr-2" />{applying ? 'Applying...' : 'Apply Now'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <RunnerApplicationCard user={user} onApplied={() => toast({ title: 'Application sent!', description: 'Admin will review and approve you as a runner' })} />
        )
      )}

      {hasApplied && !isAssigned && (
        <Card className="border-0 shadow-sm bg-primary/5">
          <CardContent className="p-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <p className="text-sm font-medium">You&apos;ve applied for this task</p>
          </CardContent>
        </Card>
      )}

      {isAssigned && (
        <Card className="border-0 shadow-sm bg-emerald-50 dark:bg-emerald-900/20">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">You&apos;re the assigned runner!</p>
            </div>
            {task.status === 'assigned' && (
              <Button size="sm" onClick={() => handleUpdateStatus('in_progress')}>Start Task</Button>
            )}
            {task.status === 'in_progress' && (
              <Button size="sm" onClick={() => handleUpdateStatus('completed')}>Mark Complete</Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Creator view — see applications */}
      {isCreator && task.applications && task.applications.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h4 className="font-semibold text-sm">Applications ({task.applications.length})</h4>
            {task.applications.map((app) => (
              <div key={app.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={app.runner.avatar || undefined} />
                  <AvatarFallback>{getInitials(app.runner.username)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{app.runner.username}</p>
                  <p className="text-[10px] text-muted-foreground">{app.runner.tasksCompleted} tasks done · ★ {app.runner.runnerRating.toFixed(1)}</p>
                  {app.message && <p className="text-xs text-muted-foreground mt-0.5">{app.message}</p>}
                </div>
                {app.status === 'pending' && task.status === 'open' && (
                  <Button size="sm" className="h-7 text-xs" onClick={() => handleAccept(app.id)}>Accept</Button>
                )}
                {app.status === 'accepted' && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Accepted</Badge>}
                {app.status === 'rejected' && <Badge variant="secondary" className="text-[10px]">Rejected</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isCreator && task.status === 'open' && (
        <Button variant="destructive" size="sm" onClick={() => handleUpdateStatus('cancelled')} className="w-full">Cancel Task</Button>
      )}
    </div>
  );
}

// ── Main Tasks View ──
export default function TasksView({ user }: { user: UserType }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showRunnerApply, setShowRunnerApply] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: 'open', limit: '30' });
      if (categoryFilter) params.set('category', categoryFilter);
      const data = await api.get(`/api/tasks?${params}`);
      setTasks(data.tasks || []);
    } catch (err) { console.error('Failed to fetch tasks:', err); }
    finally { setLoading(false); }
  }, [categoryFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  if (selectedTaskId) {
    return <TaskDetail taskId={selectedTaskId} user={user} onBack={() => { setSelectedTaskId(null); fetchTasks(); }} />;
  }

  if (showCreate) {
    return <CreateTaskForm user={user} onCreated={() => { setShowCreate(false); fetchTasks(); }} onCancel={() => setShowCreate(false)} />;
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-bold text-lg">Campus Tasks</h1>
            <p className="text-[10px] text-muted-foreground">Errands & micro-jobs by students</p>
          </div>
          <div className="flex items-center gap-2">
            {!user.isRunner && (
              <Button size="sm" variant="outline" onClick={() => setShowRunnerApply(!showRunnerApply)} className="h-8 gap-1 border-amber-400 text-amber-600 hover:bg-amber-50">
                <Zap className="w-3.5 h-3.5" />Become Runner
              </Button>
            )}
            {user.isRunner && (
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-300 text-[10px]">
                <Zap className="w-3 h-3 mr-0.5" /> Verified Runner
              </Badge>
            )}
            <Button size="sm" onClick={() => setShowCreate(true)} className="h-8 gap-1">
              <Plus className="w-3.5 h-3.5" />Post Task
            </Button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          <Badge variant={categoryFilter === '' ? 'default' : 'outline'} className="cursor-pointer flex-shrink-0" onClick={() => setCategoryFilter('')}>All</Badge>
          {TASK_CATEGORIES.map((cat) => (
            <Badge key={cat} variant={categoryFilter === cat ? 'default' : 'outline'} className="cursor-pointer flex-shrink-0 whitespace-nowrap" onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}>{cat}</Badge>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="px-4 py-4 space-y-3">
        {/* Runner Application */}
        {showRunnerApply && !user.isRunner && (
          <RunnerApplicationCard user={user} onApplied={() => setShowRunnerApply(false)} />
        )}

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4 space-y-2">
              <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-6 w-1/3 bg-muted rounded animate-pulse" />
              <div className="h-3 w-full bg-muted rounded animate-pulse" />
            </CardContent></Card>
          ))
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Zap className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No tasks yet</p>
            <p className="text-sm mb-4">Be the first to post a task!</p>
            <Button variant="outline" onClick={() => setShowCreate(true)}>Post a Task</Button>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => setSelectedTaskId(task.id)} />
          ))
        )}
      </div>
    </div>
  );
}
