'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Send, ArrowLeft, CheckCircle, Star, Package, Loader2, ImagePlus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { User as UserType, Chat, Message } from '@/lib/types';
import { timeAgo, getInitials, getListingFirstImage } from '@/lib/marketplace-utils';
import { getSocketInstance } from '@/hooks/use-socket';
import type { OurFileRouter } from '@/lib/uploadthing';

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

function compressChatImage(file: File, maxSize = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;

        if (w > h) {
          if (w > maxSize) { h *= maxSize / w; w = maxSize; }
        } else {
          if (h > maxSize) { w *= maxSize / h; h = maxSize; }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context failed')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ChatDetail({ chat, user, onBack }: { chat: Chat; user: UserType; onBack: () => void }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [dealCompleted, setDealCompleted] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // WebSocket real-time chat + fallback polling
  useEffect(() => {
    fetchMessages();
    markChatNotificationsRead();

    // Listen for real-time messages via socket
    const socket = getSocketInstance();
    const handleChatMessage = (data: { id: string; chatId: string; senderId: string; content: string; imageUrl: string; createdAt: string }) => {
      if (data.chatId !== chat.id) return;
      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, {
          id: data.id,
          chatId: data.chatId,
          senderId: data.senderId,
          message: data.content,
          imageUrl: data.imageUrl || null,
          seen: true,
          createdAt: data.createdAt,
          sender: data.senderId === user.id
            ? { id: user.id, username: user.username, avatar: user.avatar }
            : { id: other.id, username: other.username, avatar: other.avatar },
        } as Message];
      });
    };

    if (socket) {
      socket.on('chat:message', handleChatMessage);
    }

    // Fallback polling (less frequent now that we have WebSocket)
    const i = setInterval(fetchMessages, 30000);

    return () => {
      if (socket) {
        socket.off('chat:message', handleChatMessage);
      }
      clearInterval(i);
    };
  }, [fetchMessages, markChatNotificationsRead, chat.id, user.id, user.username, user.avatar, other.id, other.username, other.avatar]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    const textToSend = newMsg.trim();
    const imageToSend = pendingImageUrl;
    if ((!textToSend && !imageToSend) || sending) return;
    setSending(true);
    try {
      await api.post('/api/messages', {
        chatId: chat.id,
        senderId: user.id,
        message: textToSend || (imageToSend ? '📷 Photo' : ''),
        imageUrl: imageToSend || undefined,
      });
      setNewMsg('');
      setPendingImageUrl(null);
      // If socket is connected, the message will arrive via socket; otherwise refresh
      const socket = getSocketInstance();
      if (!socket?.connected) {
        fetchMessages();
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to send message', description: 'Please try again.', variant: 'destructive' });
    }
    finally { setSending(false); }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file.', variant: 'destructive' });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Image must be under 4MB.', variant: 'destructive' });
      return;
    }

    setUploadingImage(true);
    try {
      // Use Uploadthing via generateReactHelpers if available, fallback to base64
      try {
        const { generateReactHelpers } = await import('@uploadthing/react');
        const helpers = generateReactHelpers<OurFileRouter>();
        const res = await helpers.uploadFiles('messageImage', { files: [file] });
        if (res?.[0]?.url) {
          setPendingImageUrl(res[0].url);
          setUploadingImage(false);
          if (e.target) e.target.value = '';
          return;
        }
      } catch {
        // Uploadthing not available, fall through to base64
      }

      // Base64 fallback
      const base64 = await compressChatImage(file);
      setPendingImageUrl(base64);
    } catch (err) {
      console.error(err);
      toast({ title: 'Image upload failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setUploadingImage(false);
      if (e.target) e.target.value = '';
    }
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
                  {msg.imageUrl && (
                    <div className="mb-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={msg.imageUrl}
                        alt="Shared image"
                        className="max-w-full rounded-lg max-h-60 object-cover cursor-pointer"
                        onClick={() => window.open(msg.imageUrl!, '_blank')}
                      />
                    </div>
                  )}
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

      {/* Pending image preview */}
      {pendingImageUrl && (
        <div className="px-3 py-2 border-t bg-muted/30">
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingImageUrl} alt="Pending" className="w-20 h-20 rounded-lg object-cover" />
            <button
              onClick={() => setPendingImageUrl(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs shadow-sm"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      <div className="p-3 border-t flex gap-2 pb-16 safe-bottom">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage}
          className="p-2.5 rounded-full border hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50"
          aria-label="Attach image"
        >
          {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4 text-muted-foreground" />}
        </button>
        <Input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message..." className="flex-1" onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()} />
        <button onClick={handleSend} disabled={sending || (!newMsg.trim() && !pendingImageUrl)} className="p-2.5 bg-primary text-primary-foreground rounded-full disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center">
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
      setChats(data?.chats || data || []);
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
