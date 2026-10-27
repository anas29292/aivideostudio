# Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants
1. **Global Default Deny**: Any path not explicitly matched is rejected (`allow read, write: if false;`).
2. **Verified Authentication**: Every mutating operation requires `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Split-Collection Isolation**: Email and subscription billing details live in `/users/{userId}/private/{docId}` and can ONLY be read or written by the exact owner (`request.auth.uid == userId`) or a verified Admin (`isAdmin()`).
4. **Master Gate Relational Sync**: `/projects/{projectId}/scenes/{sceneId}` requires that the parent `/projects/{projectId}` document exists and its `ownerId` matches `request.auth.uid` (or `isAdmin()`).
5. **Strict Key & Size Enforcement**: Every string is bounded by `.size()` matching `firebase-blueprint.json`, and every `create`/`update` uses `hasAll`/`hasOnly` and action-based `affectedKeys().hasOnly()`.
6. **Temporal & Ownership Immutability**: `createdAt` must equal `request.time` on `create` and remain immutable on `update`; `updatedAt` must equal `request.time` on `update`; `ownerId` and `uid` cannot be mutated after creation.
7. **Terminal State Locking**: Once a `VideoProject` reaches `status == 'archived'`, non-admin users cannot mutate it further.
8. **Secure List Queries**: `allow list` on `/projects` enforces `resource.data.ownerId == request.auth.uid || isAdmin()` without `get()`/`exists()` inside list evaluation.

## 2. The "Dirty Dozen" Payloads
1. **Shadow Field Injection**: Creating `/projects/proj_1` with an extra key `"isFeatured": true` -> Rejected by `hasOnly`.
2. **Identity Spoofing**: User `uid_A` creates `/projects/proj_1` with `"ownerId": "uid_B"` -> Rejected by `data.ownerId == request.auth.uid`.
3. **Unverified Admin Email Spoof**: User with `email == "anassutisna6@gmail.com"` but `email_verified == false` attempts admin read -> Rejected by `request.auth.token.email_verified == true`.
4. **PII Blanket Read**: Authenticated user `uid_B` attempts `get` on `/users/uid_A/private/subscription` -> Rejected by `isOwner(userId) || isAdmin()`.
5. **Orphaned Subcollection Write**: Creating `/projects/non_existent/scenes/s_1` -> Rejected by Master Gate `exists(/databases/$(database)/documents/projects/$(projectId))`.
6. **ID Poisoning Attack**: Creating document with 500-char ID or special characters `proj$123` -> Rejected by `isValidId()`.
7. **Denial of Wallet String Overflow**: Updating `topic` with a 10,000-character string -> Rejected by `data.topic.size() <= 500`.
8. **Timestamp Forgery**: Creating a project with client-supplied past `createdAt` -> Rejected by `incoming().createdAt == request.time`.
9. **Ownership Hijack on Update**: Updating `ownerId` on an existing project -> Rejected by `incoming().ownerId == existing().ownerId`.
10. **Terminal State Bypass**: Owner attempting to update a project whose `existing().status == 'archived'` -> Rejected by `existing().status != 'archived'`.
11. **Self-Assigned Tier Escalation**: Non-admin user attempting to update `planTier` to `'agency_studio'` without valid action -> Restricted to valid subscription update flow or admin.
12. **Unauthorized List Scraping**: Client running unfiltered `getDocs(collection(db, 'projects'))` as non-admin -> Rejected by `allow list: if isSignedIn() && (resource.data.ownerId == request.auth.uid || isAdmin())`.
