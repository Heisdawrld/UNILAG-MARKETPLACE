# Runner Dispatch Redesign

Date: 2026-05-20
Project: UNILAG Marketplace
Area: Runner

## Goal

Turn Runner from a premium campus task board into a real campus dispatch product that feels closer to inDrive and Uber while staying tightly scoped to UNILAG.

The redesigned Runner experience should let:

- customers create delivery and errand requests with precise pickup and dropoff data
- approved runners receive request broadcasts as push notifications, even when they are not actively inside the app
- runners accept instantly or counter with another price
- customers compare offers and match with one runner
- matched jobs move through live order states with map-aware tracking inside campus boundaries

## Product Principles

- Runner is a focused UNILAG ecosystem service, not a general logistics app
- campus movement must be premium, fast, and clear on mobile
- negotiation should feel structured, not like chat chaos
- live tracking starts after a runner has been matched to a request
- locations outside the UNILAG service area are blocked or clearly rejected

## Current State Summary

The existing code already provides:

- request creation under the task model
- a runner application and approval flow
- a live marketplace view in the client
- runner offers using `TaskApplication`
- push subscription storage and notification sending

The current implementation falls short because:

- runner offers are single mutable records, so there is no true negotiation history
- task records only support text locations, not map coordinates
- push subscriptions trust a client-provided `userId`
- runner availability is not modeled as durable backend state
- active delivery lifecycle states are too shallow for pickup and dropoff tracking
- runner applications are stored via notification payloads instead of first-class data

## Recommended Delivery Shape

Build the full Runner system in one direction, but sequence the work so the riskiest architecture moves first.

The target user flow is:

1. Customer opens Runner and creates a request.
2. Customer enters title, details, budget, urgency, pickup, dropoff, and optional map-based pin placement.
3. System validates that the route is inside the UNILAG service area.
4. System creates the request and broadcasts it to approved runners who are currently available.
5. Runner receives a push notification and opens the app into the request.
6. Runner either accepts at the listed budget or sends a counter-offer with amount and note.
7. Customer sees all incoming offers in a ranked offer sheet and chooses one runner.
8. Request becomes matched and other open offers expire.
9. Matched request moves through live order states:
   `matched -> runner_heading_to_pickup -> picked_up -> delivering -> arrived -> completed`
10. After matching, customer and runner can see the live order screen with map context and status progression.

## Architecture

### 1. Request Model

Keep `Task` as the base runner request record, but extend it so it can represent dispatch-grade order data.

New `Task` fields:

- `pickupLabel`
- `dropoffLabel`
- `pickupLat`
- `pickupLng`
- `dropoffLat`
- `dropoffLng`
- `serviceArea`
- `negotiationStatus`
- `matchedAt`
- `pickedUpAt`
- `deliveringAt`
- `arrivedAt`
- `completedAt`
- `cancelledAt`
- `estimatedDistanceMeters`
- `estimatedDurationMinutes`

The legacy `location` and `pickupLocation` fields can remain temporarily for compatibility, but the UI and API should migrate to the explicit pickup/dropoff fields.

### 2. Offer and Negotiation Model

The current `TaskApplication` model should become a proper offer model rather than a single upsert-only application.

Recommended direction:

- keep `TaskApplication` as the high-level runner participation record if needed for compatibility
- add a new `TaskOffer` table for actual negotiation history

`TaskOffer` fields:

- `id`
- `taskId`
- `runnerId`
- `customerId`
- `amount`
- `message`
- `createdByRole`
- `status`
- `createdAt`

Offer statuses:

- `open`
- `accepted`
- `rejected`
- `expired`
- `superseded`

This allows:

- runner sends first offer
- customer counters
- runner counters again
- full audit trail per order

For launch behavior, the customer offer sheet should still feel simple:

- latest active amount
- runner note
- runner profile snapshot
- accept and decline actions

### 3. Runner Presence

Approved runners need durable service state.

Recommended additions on `User`:

- `runnerAvailabilityStatus`
- `runnerLastActiveAt`
- `runnerCurrentLat`
- `runnerCurrentLng`
- `runnerLocationUpdatedAt`

Availability states:

- `offline`
- `available`
- `busy`

The client availability toggle must write to the backend so broadcast logic can trust it.

### 4. Live Tracking

Live tracking should begin only after a request is matched.

For this implementation cycle:

- persist the assigned runner's latest coordinates
- expose order-level tracking data to only the matched customer and runner
- support periodic location updates from the runner app
- show the customer the runner moving toward pickup and dropoff

This avoids pretending the app has background mobile-native GPS behavior while still delivering a premium live order experience inside the web app.

### 5. Service Area Boundary

Runner should only operate within UNILAG.

Implementation shape:

- define a UNILAG campus boundary polygon or bounding box in code
- validate pickup and dropoff coordinates against it
- reject out-of-bounds requests at API level
- keep the map centered and constrained around campus

If exact polygon data is not available at first pass, use a well-defined bounding box around the campus as a safe initial implementation, then refine later.

### 6. Runner Applications

Runner applications should be moved from notification-backed storage into a first-class Prisma model.

Recommended new table:

- `RunnerProfile`

Fields:

- `userId`
- `status`
- `transportMode`
- `availabilityText`
- `preferredZone`
- `deliveryExperience`
- `motivation`
- `studentId`
- `profilePhoto`
- `studentIdImage`
- `emergencyContactName`
- `emergencyContactPhone`
- `emergencyContactRelationship`
- `reviewedAt`
- `reviewedBy`
- `reviewNote`

This improves:

- admin reliability
- future runner moderation
- querying approved runners for dispatch broadcasts

## API Design

### Requests

- `POST /api/tasks`
  Creates a campus-bounded runner request with map-aware pickup and dropoff fields.

- `GET /api/tasks`
  Returns filtered requests and supports customer, runner, and active-order views.

- `GET /api/tasks/:id`
  Returns task, offer timeline, assigned runner info, and live state relevant to the viewer.

- `PATCH /api/tasks/:id`
  Updates lifecycle status and order metadata with strict role checks.

### Offers

- `POST /api/tasks/:id/offers`
  Runner sends an accept-at-price or counter-offer.

- `PATCH /api/tasks/:id/offers/:offerId`
  Customer accepts, rejects, or counters an offer.

- `GET /api/tasks/:id/offers`
  Returns negotiation history with viewer-safe visibility rules.

### Runner Presence

- `PATCH /api/runner-presence`
  Updates availability status.

- `PATCH /api/runner-location`
  Updates the matched runner's live coordinates.

### Runner Profiles

- `POST /api/runner-applications`
  Can stay temporarily, but should migrate toward runner profile creation and review flows backed by Prisma data.

## Notification Strategy

### Broadcast on Request Creation

When a request is created:

- find approved runners with `available` status
- for the first implementation, broadcast to all approved runners with `available` status
- create in-app notification records
- send push notifications to all matching runners

Push payload should include:

- request title
- budget
- pickup/dropoff summary
- deep link into the request detail page

### Notification Safety

Push subscription routes must use the authenticated Clerk user rather than a client-supplied `userId`.

This is a launch blocker because the current route allows cross-account subscription hijacking.

## UX Design

### Customer

- fast request builder with premium cards and route summary
- map pin option for pickup and dropoff when text is not enough
- smart campus budget guidance
- live offers sheet that feels like inDrive
- active order screen with progress states and runner map

### Runner

- availability toggle
- live request inbox
- accept/counter action sheet
- active order card with pickup and dropoff context
- map-focused delivery screen after matching

### Visual Direction

- keep the current premium mobile-first visual language
- make maps muted and elegant, not noisy
- use focused bottom sheets and large tap targets
- emphasize trust, price clarity, and route confidence

## Error Handling

- reject out-of-campus coordinates with clear copy
- reject offers from non-approved or unavailable runners
- expire open offers once a customer matches with one runner
- prevent task completion state jumps
- prevent unauthorized push subscription writes
- degrade gracefully when push is unavailable by falling back to in-app notifications

## Testing Strategy

### Backend

- task creation validation
- campus boundary checks
- push subscription auth
- offer lifecycle transitions
- match locking behavior
- order status progression rules

### Frontend

- request builder validation
- runner offer actions
- customer selection flow
- active order state rendering
- fallback behavior when maps or geolocation are unavailable

### Manual Launch Checks

- create request as customer
- receive push as approved runner
- accept and counter from runner side
- select runner from customer side
- move order through active states
- verify out-of-campus request rejection

## Implementation Order

1. Fix security and state-model blockers:
   push auth, durable runner presence, order status rules.
2. Upgrade schema for coordinates, order lifecycle, runner profiles, and offer history.
3. Rebuild runner APIs around negotiation and matching.
4. Rebuild Runner UI for request creation, offer comparison, and active orders.
5. Add campus map experience and live runner location updates.
6. Polish notifications, deep links, and launch QA.

## Scope Decisions

Included:

- real runner negotiation
- push broadcast
- UNILAG-only service area enforcement
- active order states
- live matched-order tracking
- premium mobile-first Runner UI

Deferred unless time allows:

- turn-by-turn navigation
- automatic ETA recalculation
- customer view of nearby runners before posting
- native-like background location streaming outside active usage

## Success Criteria

Runner feels like a real campus logistics product if:

- requests can be created with clear pickup and dropoff data
- approved runners reliably receive and respond to requests
- negotiation is structured and easy to compare
- one runner can be matched cleanly without race-condition confusion
- matched orders have a premium, map-aware active state
- no out-of-campus jobs can enter the system
