'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Send, ArrowLeft, CheckCircle, Star, Package, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { User as UserType, Chat, Message } from '@/lib/types';
import { timeAgo, getInitials, getListingFirstImage } from '@/lib/marketplace-utils';

function getChatCounterparty(chat: Chat, currentUserId: string) {
  const other = chat.buyerId === currentUserId ? chat.seller : chat.buyer;
  const isBuyerView = chat.buyerId === currentUserId;

  if (isBuyerView && chat.listing.store) {
    return {
      id: other.id,
      name: chat.listing.store.name,
      avatar: chat.listing.store.logo,
    };
  }

  return {
    id: other.id,
    name: other.username,
    avatar: other.avatar,
  };
}

function ReviewModal({ seller, onSubmit, onClose }: { seller: any; onSubmit: (rating: number, comment: string) => void; onClose: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-background rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
        <div className="text-center mb-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <h3 className="font-bold text-lg">Deal Completed! 🎉</h3>
          <p className="text-sm text-muted-foreground">Rate your experience with <strong>{seller.username}</strong></p>
        </div>

        {/* Star rating */}
        <div className="flex justify-center gap-1 mb-4">
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s} onClick={() => setRating(s)} aria-label={`Rate ${s} out of 5 stars`} aria-pressed={s === rating} className="p-1 transition-transform hover:scale-110">
              <Star className={`w-8 h-8 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
            </button>
          ))}
        </div>

        <Textarea
          placeholder="Share your experience (optional)..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          className="mb-4"
          maxLength={300}
        />

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border text-sm hover:bg-muted transition-colors">
            Skip
          </button>
          <button
            onClick={async () => { setSubmitting(true); await onSubmit(rating, comment); setSubmitting(false); }}
            disabled={submitting}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatDetail({ chat, user, onBack }: { chat: Chat; user: UserType; onBack: () => void }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [dealCompleted, setDealCompleted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const other = chat.buyerId === user.id ? chat.seller : chat.buyer;
  const counterparty = getChatCounterparty(chat, user.id);
  const isBuyer = chat.buyerId === user.id;

  const fetchMessages = useCallback(async () => {
    try {
      const data = await api.get(`/api/messages?chatId=${chat.id}`);
      setMessages(data || []);
    } catch (e) { console.error(e); }
  }, [chat.id]);

  const markChatNotificationsRead = useCallback(async () => {
    try {
      await api.patch('/api/notifications/read', { userId: user.id, chatId: chat.id });
    } catch (e) {
      console.error(e);
    }
  }, [chat.id, user.id]);

  useEffect(() => { fetchMessages(); const i = setInterval(fetchMessages, 10000); return () => clearInterval(i); }, [fetchMessages]);
  useEffect(() => { markChatNotificationsRead(); }, [markChatNotificationsRead]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!newMsg.trim() || sending) return;
    setSending(true);
    try {
      await api.post('/api/messages', { chatId: chat.id, senderId: user.id, message: newMsg.trim() });
      setNewMsg('');
      fetchMessages();
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to send message', description: 'Please try again.', variant: 'destructive' });
    }
    finally { setSending(false); }
  };

  const handleCreateOrder = async () => {
    setSending(true);
    try {
      await api.post('/api/messages', { chatId: chat.id, senderId: user.id, message: '📦 [SYSTEM:ORDER_CREATED]' });
      fetchMessages();
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  const handleConfirmDeal = async () => {
    setDealCompleted(true);
    try {
      await api.post('/api/messages', { chatId: chat.id, senderId: user.id, message: '✅ [SYSTEM:ORDER_COMPLETED]' });
      await api.patch(`/api/listings/${chat.listing.id}`, { status: 'sold' });
    } catch (e) { console.error(e); }
    setShowReview(true);
  };

  const handleSubmitReview = async (rating: number, comment: string) => {
    try {
      await api.post('/api/reviews', {
        reviewerId: user.id,
        sellerId: other.id,
        rating,
        comment: comment || `Great transaction for ${chat.listing.title}`,
      });
    } catch (e) { console.error(e); }
    setShowReview(false);
  };

  const orderCreated = messages.some(m => m.message.includes('[SYSTEM:ORDER_CREATED]'));
  const orderCompleted = messages.some(m => m.message.includes('[SYSTEM:ORDER_COMPLETED]'));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 safe-top p-3 border-b bg-background/95 backdrop-blur-md">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-muted"><ArrowLeft className="w-5 h-5" /></button>
        <Avatar className="w-8 h-8"><AvatarImage src={counterparty.avatar || undefined} /><AvatarFallback>{getInitials(counterparty.name)}</AvatarFallback></Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{counterparty.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{chat.listing.title}</p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {messages.map(msg => {
            const isSysCreate = msg.message.includes('[SYSTEM:ORDER_CREATED]');
            const isSysComplete = msg.message.includes('[SYSTEM:ORDER_COMPLETED]');
            
            if (isSysCreate) {
              return (
                <div key={msg.id} className="flex justify-center my-4">
                  <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full text-[10px] text-amber-600 font-medium flex items-center gap-1.5">
                    <Package className="w-3 h-3" /> Order Initiated
                  </div>
                </div>
              );
            }
            if (isSysComplete) {
              return (
                <div key={msg.id} className="flex justify-center my-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full text-[10px] text-emerald-600 font-medium flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3" /> Order Received & Completed
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${msg.senderId === user.id ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'}`}>
                  <p>{msg.message}</p>
                  <p className={`text-[9px] mt-0.5 ${msg.senderId === user.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{timeAgo(msg.createdAt)}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Action Area based on Order State */}
      {chat.listing.status !== 'sold' && !orderCompleted && (
        <div className="px-3 py-2 border-t bg-muted/30">
          {!orderCreated ? (
            <button onClick={handleCreateOrder} disabled={sending} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 transition-colors">
              <Package className="w-4 h-4" /> Create Order
            </button>
          ) : isBuyer ? (
            <button onClick={handleConfirmDeal} disabled={sending} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors shadow-sm animate-pulse-once">
              <CheckCircle className="w-4 h-4" /> I Have Received My Order
            </button>
          ) : (
            <p className="text-xs text-center text-muted-foreground py-1">Waiting for buyer to confirm receipt...</p>
          )}
        </div>
      )}

      {(orderCompleted || chat.listing.status === 'sold') && (
        <div className="px-3 py-2 border-t bg-emerald-500/5 text-center">
          <p className="text-sm text-emerald-600 font-medium flex items-center justify-center gap-1">
            <CheckCircle className="w-4 h-4" /> Deal completed! Thank you 🎉
          </p>
        </div>
      )}

      <div className="p-3 border-t flex gap-2">
        <Input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message..." className="flex-1" onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()} />
        <button onClick={handleSend} disabled={sending || !newMsg.trim()} className="p-2.5 bg-primary text-primary-foreground rounded-full disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <Send className="w-4 h-4" />
        </button>
      </div>

      {showReview && <ReviewModal seller={{ username: counterparty.name }} onSubmit={handleSubmitReview} onClose={() => setShowReview(false)} />}
    </div>
  );
}

export default function MessagesView({
  user,
  initialChatId,
  onInitialChatOpened,
}: {
  user: UserType;
  initialChatId?: string | null;
  onInitialChatOpened?: () => void;
}) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);

  const fetchChats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/chats?userId=${user.id}`);
      setChats(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user.id]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    if (!initialChatId || loading) return;

    const chat = chats.find(c => c.id === initialChatId);
    if (chat) setActiveChat(chat);
    onInitialChatOpened?.();
  }, [chats, initialChatId, loading, onInitialChatOpened]);

  if (activeChat) {
    return <ChatDetail chat={activeChat} user={user} onBack={() => { setActiveChat(null); fetchChats(); }} />;
  }

  return (
    <div>
      <div className="sticky top-0 z-30 safe-top bg-background/95 backdrop-blur-md border-b px-4 py-3">
        <h1 className="font-bold text-lg">Messages</h1>
      </div>
      {loading ? (
        <div className="p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm">Loading chats...</p>
        </div>
      ) : chats.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <p className="font-medium">No messages yet</p>
          <p className="text-sm">Start a conversation by messaging a store</p>
        </div>
      ) : (
        <div>
          {chats.map(chat => {
            const counterparty = getChatCounterparty(chat, user.id);
            const img = getListingFirstImage(chat.listing.images, '');
            return (
              <button key={chat.id} onClick={() => setActiveChat(chat)} className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b text-left">
                <div className="relative">
                  <Avatar className="w-12 h-12"><AvatarImage src={counterparty.avatar || undefined} /><AvatarFallback>{getInitials(counterparty.name)}</AvatarFallback></Avatar>
                  {chat.unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm truncate">{counterparty.name}</p>
                    {chat.lastMessage && <span className="text-[10px] text-muted-foreground">{timeAgo(chat.lastMessage.createdAt)}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{chat.listing.title}</p>
                  {chat.lastMessage && <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.lastMessage.message.includes('[SYSTEM:') ? 'System notification' : chat.lastMessage.message}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
