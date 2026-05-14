# Security Specification for ProCollect

## Data Invariants
1. `Customer`: Every customer must have a `name` and `dueAmount`. `dueAmount` must be a non-negative number.
2. `Interaction`: Every interaction must be linked to a valid `customerId` and the current `auth.uid`.
3. `Notification`: Must be tied to a `recipientId`.

## The "Dirty Dozen" Payloads
1. Attempting to update another agent's profile in `/users`.
2. Creating a customer without a name.
3. Setting `dueAmount` to a negative value.
4. Setting a future payment amount as a string.
5. Deleting a customer record (should only be allowed by admin, or maybe not at all for history).
6. Spoofing `agentId` in an interaction.
7. Injecting massive strings (>1KB) into name fields.
8. Reading another user's notifications.
9. Modifying `createdAt` field on a user profile.
10. Creating an interaction for a non-existent customer.
11. Updating a terminal status `collected` back to `pending`.
12. Accessing data without authentication.

## Test Runner (Logic)
The following rules will be implemented to prevent these vulnerabilities.
- `isValidId(id)` helper.
- `isSignedIn()` helper.
- `isValidUser`, `isValidCustomer`, `isValidInteraction` helpers.
- `existing()` and `incoming()` helpers.
