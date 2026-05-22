'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Clock, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Task } from '@/lib/types';
import { formatPrice, getInitials } from '@/lib/marketplace-utils';
import {
  isFreshTimestamp,
  getTaskPickupLabel,
  getTaskDropoffLabel,
  getTaskOfferCount,
  getBudgetToneCopy,
} from './task-utils';

interface RequestCardProps {
  task: Task;
  onClick: () => void;
}

const URGENCY_BORDER: Record<string, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-amber-500',
  medium: 'border-l-blue-500',
  low: 'border-l-slate-300',
};

const URGENCY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function RequestCard({ task, onClick }: RequestCardProps) {
  const urgencyClass = URGENCY_BORDER[task.urgency] || 'border-l-slate-300';
  const urgencyBadge = URGENCY_BADGE[task.urgency] || 'bg-slate-100 text-slate-600 border-slate-200';
  const isLive = isFreshTimestamp(task.createdAt);
  const offerCount = getTaskOfferCount(task);
  const budgetTone = getBudgetToneCopy(task.pricingGuide);

  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.985 }} className="cursor-pointer" onClick={onClick}>
      <Card className={`overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow border-l-[3px] ${urgencyClass}`}>
        <CardContent className="p-3.5">
          {/* Top row: category + urgency + live */}
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline" className="text-[10px] px-2 py-0 rounded-full">
              {task.category}
            </Badge>
            <div className="flex items-center gap-1.5">
              {isLive && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              )}
              <Badge className={`text-[10px] px-1.5 py-0 rounded-full border ${urgencyBadge}`}>
                {task.urgency}
              </Badge>
            </div>
          </div>

          {/* Route */}
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">
              {getTaskPickupLabel(task)} → {getTaskDropoffLabel(task)}
            </span>
          </p>

          {/* Title */}
          <h3 className="font-semibold text-sm line-clamp-1 mb-2">{task.title}</h3>

          {/* Price — THE hero */}
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-2xl font-extrabold text-primary tracking-tight">
                {formatPrice(task.reward)}
              </p>
              {task.pricingGuide && (
                <p className={`text-[10px] font-medium ${budgetTone.badgeClass} px-2 py-0.5 rounded-full inline-block mt-0.5`}>
                  {budgetTone.label}
                </p>
              )}
            </div>
            {offerCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageCircle className="w-3.5 h-3.5" />
                {offerCount}
              </div>
            )}
          </div>

          {/* Footer: creator + time */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar className="w-5 h-5">
                <AvatarImage src={task.creator.avatar || undefined} />
                <AvatarFallback className="text-[8px]">{getInitials(task.creator.username)}</AvatarFallback>
              </Avatar>
              <span className="text-[11px] text-muted-foreground truncate">{task.creator.username}</span>
            </div>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {task.createdAt ? new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
