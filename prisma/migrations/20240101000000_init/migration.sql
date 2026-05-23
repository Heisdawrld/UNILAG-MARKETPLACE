-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatar" TEXT,
    "faculty" TEXT,
    "department" TEXT,
    "level" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "hostel" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "trustScore" INTEGER NOT NULL DEFAULT 0,
    "ratingAverage" REAL NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "role" TEXT NOT NULL DEFAULT 'user',
    "isRunner" BOOLEAN NOT NULL DEFAULT false,
    "runnerRating" REAL NOT NULL DEFAULT 0,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "runnerAvailabilityStatus" TEXT NOT NULL DEFAULT 'offline',
    "runnerLastActiveAt" DATETIME,
    "runnerCurrentLat" REAL,
    "runnerCurrentLng" REAL,
    "runnerLocationUpdatedAt" DATETIME,
    "clerkId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "storeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "category" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "negotiable" BOOLEAN NOT NULL DEFAULT true,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "views" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "boosted" BOOLEAN NOT NULL DEFAULT false,
    "boostedUntil" DATETIME,
    "images" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Listing_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Chat_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Chat_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Chat_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "imageUrl" TEXT,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SavedListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporterId" TEXT NOT NULL,
    "listingId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "data" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "banner" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "instagram" TEXT,
    "twitter" TEXT,
    "address" TEXT,
    "openHours" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "followCount" INTEGER NOT NULL DEFAULT 0,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "rating" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Store_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoreFollow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StoreFollow_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Boost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "paymentReference" TEXT,
    "flutterwaveTxRef" TEXT,
    "amount" REAL NOT NULL DEFAULT 0,
    "planId" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "listingId" TEXT,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "flutterwaveTxRef" TEXT NOT NULL,
    "flutterwaveId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creatorId" TEXT NOT NULL,
    "assignedRunnerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reward" REAL NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT,
    "pickupLocation" TEXT,
    "pickupLabel" TEXT,
    "dropoffLabel" TEXT,
    "pickupLat" REAL,
    "pickupLng" REAL,
    "dropoffLat" REAL,
    "dropoffLng" REAL,
    "serviceArea" TEXT DEFAULT 'unilag',
    "negotiationStatus" TEXT NOT NULL DEFAULT 'open',
    "urgency" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "deadline" DATETIME,
    "images" TEXT NOT NULL DEFAULT '[]',
    "estimatedDistanceMeters" INTEGER,
    "estimatedDurationMinutes" INTEGER,
    "matchedAt" DATETIME,
    "pickedUpAt" DATETIME,
    "deliveringAt" DATETIME,
    "arrivedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_assignedRunnerId_fkey" FOREIGN KEY ("assignedRunnerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "runnerId" TEXT NOT NULL,
    "message" TEXT,
    "proposedPrice" REAL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskApplication_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaskApplication_runnerId_fkey" FOREIGN KEY ("runnerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "runnerId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "message" TEXT,
    "createdByRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskOffer_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaskOffer_runnerId_fkey" FOREIGN KEY ("runnerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaskOffer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunnerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "transportMode" TEXT NOT NULL,
    "availabilityText" TEXT NOT NULL,
    "preferredZone" TEXT,
    "deliveryExperience" TEXT,
    "motivation" TEXT,
    "studentId" TEXT NOT NULL,
    "profilePhoto" TEXT NOT NULL,
    "studentIdImage" TEXT NOT NULL,
    "emergencyContactName" TEXT NOT NULL,
    "emergencyContactPhone" TEXT NOT NULL,
    "emergencyContactRelationship" TEXT,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RunnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "assignedRunnerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "pickupLat" REAL NOT NULL,
    "pickupLng" REAL NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "dropoffLat" REAL NOT NULL,
    "dropoffLng" REAL NOT NULL,
    "dropoffAddress" TEXT NOT NULL,
    "serviceArea" TEXT NOT NULL DEFAULT 'unilag',
    "estimatedDistanceMeters" INTEGER,
    "estimatedDurationMinutes" INTEGER,
    "customerPrice" REAL NOT NULL,
    "finalPrice" REAL,
    "surgeMultiplier" REAL NOT NULL DEFAULT 1.0,
    "platformCommission" REAL NOT NULL DEFAULT 0,
    "cancellationFee" REAL NOT NULL DEFAULT 0,
    "pickupCode" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "urgency" TEXT NOT NULL DEFAULT 'standard',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "itemImages" TEXT NOT NULL DEFAULT '[]',
    "cancelReason" TEXT,
    "cancelledBy" TEXT,
    "customerRating" INTEGER,
    "runnerRating" INTEGER,
    "customerReview" TEXT,
    "runnerReview" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "customerPaidAt" DATETIME,
    "escrowReleasedAt" DATETIME,
    "refundReason" TEXT,
    "refundProcessedAt" DATETIME,
    "searchingAt" DATETIME,
    "assignedAt" DATETIME,
    "enRouteAt" DATETIME,
    "pickedUpAt" DATETIME,
    "inTransitAt" DATETIME,
    "deliveredAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeliveryOrder_assignedRunnerId_fkey" FOREIGN KEY ("assignedRunnerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "runnerId" TEXT NOT NULL,
    "runnerPrice" REAL NOT NULL,
    "estimatedArrivalMinutes" INTEGER,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliveryOffer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DeliveryOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeliveryOffer_runnerId_fkey" FOREIGN KEY ("runnerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderStatusLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    CONSTRAINT "OrderStatusLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DeliveryOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunnerWallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "balance" REAL NOT NULL DEFAULT 0,
    "pendingBalance" REAL NOT NULL DEFAULT 0,
    "totalEarned" REAL NOT NULL DEFAULT 0,
    "totalWithdrawn" REAL NOT NULL DEFAULT 0,
    "totalHeld" REAL NOT NULL DEFAULT 0,
    "lastPayoutAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RunnerWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "balance" REAL NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "RunnerWallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runnerId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "fee" REAL NOT NULL DEFAULT 0,
    "netAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "method" TEXT NOT NULL DEFAULT 'bank_transfer',
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "flutterwaveTxRef" TEXT,
    "processedAt" DATETIME,
    "failedReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayoutRequest_runnerId_fkey" FOREIGN KEY ("runnerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "Listing_category_idx" ON "Listing"("category");
CREATE INDEX "Listing_status_idx" ON "Listing"("status");
CREATE INDEX "Listing_sellerId_idx" ON "Listing"("sellerId");
CREATE INDEX "Listing_storeId_idx" ON "Listing"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Chat_listingId_buyerId_sellerId_key" ON "Chat"("listingId", "buyerId", "sellerId");

-- CreateIndex
CREATE INDEX "Message_chatId_idx" ON "Message"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedListing_userId_listingId_key" ON "SavedListing"("userId", "listingId");

-- CreateIndex
CREATE INDEX "Review_sellerId_idx" ON "Review"("sellerId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");
CREATE UNIQUE INDEX "Store_ownerId_key" ON "Store"("ownerId");
CREATE INDEX "Store_category_idx" ON "Store"("category");
CREATE INDEX "Store_slug_idx" ON "Store"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "StoreFollow_userId_storeId_key" ON "StoreFollow"("userId", "storeId");
CREATE INDEX "StoreFollow_storeId_idx" ON "StoreFollow"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "Boost_listingId_idx" ON "Boost"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_flutterwaveTxRef_key" ON "Payment"("flutterwaveTxRef");
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_creatorId_idx" ON "Task"("creatorId");
CREATE INDEX "Task_category_idx" ON "Task"("category");

-- CreateIndex
CREATE UNIQUE INDEX "TaskApplication_taskId_runnerId_key" ON "TaskApplication"("taskId", "runnerId");
CREATE INDEX "TaskApplication_taskId_idx" ON "TaskApplication"("taskId");
CREATE INDEX "TaskApplication_runnerId_idx" ON "TaskApplication"("runnerId");

-- CreateIndex
CREATE INDEX "TaskOffer_taskId_runnerId_createdAt_idx" ON "TaskOffer"("taskId", "runnerId", "createdAt");
CREATE INDEX "TaskOffer_customerId_idx" ON "TaskOffer"("customerId");
CREATE INDEX "TaskOffer_status_idx" ON "TaskOffer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RunnerProfile_userId_key" ON "RunnerProfile"("userId");
CREATE INDEX "RunnerProfile_status_idx" ON "RunnerProfile"("status");

-- CreateIndex
CREATE INDEX "DeliveryOrder_status_idx" ON "DeliveryOrder"("status");
CREATE INDEX "DeliveryOrder_customerId_idx" ON "DeliveryOrder"("customerId");
CREATE INDEX "DeliveryOrder_assignedRunnerId_idx" ON "DeliveryOrder"("assignedRunnerId");
CREATE INDEX "DeliveryOrder_category_idx" ON "DeliveryOrder"("category");
CREATE INDEX "DeliveryOrder_serviceArea_idx" ON "DeliveryOrder"("serviceArea");
CREATE INDEX "DeliveryOrder_createdAt_idx" ON "DeliveryOrder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryOffer_orderId_runnerId_key" ON "DeliveryOffer"("orderId", "runnerId");
CREATE INDEX "DeliveryOffer_orderId_idx" ON "DeliveryOffer"("orderId");
CREATE INDEX "DeliveryOffer_runnerId_idx" ON "DeliveryOffer"("runnerId");
CREATE INDEX "DeliveryOffer_status_idx" ON "DeliveryOffer"("status");
CREATE INDEX "DeliveryOffer_expiresAt_idx" ON "DeliveryOffer"("expiresAt");

-- CreateIndex
CREATE INDEX "OrderStatusLog_orderId_idx" ON "OrderStatusLog"("orderId");
CREATE INDEX "OrderStatusLog_timestamp_idx" ON "OrderStatusLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "RunnerWallet_userId_key" ON "RunnerWallet"("userId");
CREATE INDEX "RunnerWallet_userId_idx" ON "RunnerWallet"("userId");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");
CREATE INDEX "WalletTransaction_type_idx" ON "WalletTransaction"("type");
CREATE INDEX "WalletTransaction_createdAt_idx" ON "WalletTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "PayoutRequest_runnerId_idx" ON "PayoutRequest"("runnerId");
CREATE INDEX "PayoutRequest_status_idx" ON "PayoutRequest"("status");
CREATE INDEX "PayoutRequest_createdAt_idx" ON "PayoutRequest"("createdAt");
