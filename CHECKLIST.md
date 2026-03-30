# Echo - Practical Implementation Checklist

Last Updated: 2026-03-29
Status: Functional MVP with device validation and production hardening remaining

## Release-Now Track

Goal: get Echo onto the App Store quickly with a stable, useful first version, then improve in updates.

### Must Finish Before First App Store Submission
- [x] Recording -> save -> reload flow is stable
- [x] Summary / transcript / action items are visible in the app
- [x] Search and tag-based organization work
- [x] Local iOS dev build succeeds again on the current machine
- [ ] Verify one successful native STT run on a real iPhone
- [ ] Verify one calendar-linked memo on a real iPhone with live permissions
- [ ] Finalize App Store metadata, icon, screenshots, and privacy copy
- [ ] Decide whether v1 ships with billing on or billing hidden

### Safe to Move to Post-Launch Updates
- [~] Calendar precision tuning beyond one verified real-world case
- [~] Dark-mode polish beyond current surface coverage
- [~] Tag system deeper editing and taxonomy cleanup
- [~] RevenueCat production paywall flow
- [ ] Background wake-word
- [ ] Slack / Google Calendar / To-do integrations

## 0. Current Snapshot

### Already Working
- [x] Expo + React Native + TypeScript setup
- [x] Audio recording UI
- [x] Local memo persistence
- [x] Memo playback and delete flow
- [x] Rule-based action item extraction
- [x] Summary generation
- [x] Main screen action item display
- [x] Quick copy/share actions for the latest extracted result
- [x] Action-item-only memo filter
- [x] Memo detail view with summary/transcript/action tabs
- [x] Grouped summary sections in detail view
- [x] Main-screen grouped insight cards
- [x] Action item editing and completed status flow
- [x] Search debounce and deferred filtering
- [x] Storage migration from legacy array storage to index + payload storage
- [x] Unit tests for extractor, storage, and service
- [x] TypeScript typecheck passes

### Partially Working
- [~] Native STT integration is wired through `expo-speech-recognition`
- [~] Native STT falls back to mock transcription when unavailable
- [~] STT diagnostics and source reporting are visible in the UI
- [~] iOS native project is ready, but local CocoaPods tooling still needs environment alignment on this Mac
- [~] “헤이 에코” foreground wake-word mode exists
- [~] Deep-link quick capture (`echo://record`) exists
- [~] Live location and active calendar context are wired, but calendar QA is still in progress

### Still Mock / Placeholder
- [ ] Full calendar QA across devices and real personal schedules
- [ ] Real background wake-word activation
- [ ] End-to-end recording validation on device

## 1. Phase 1 Closeout

Goal: make the current MVP reliable enough to build on confidently.

### 1.1 Reliability
- [x] Improve recording failure handling
- [x] Improve transcription fallback behavior
- [x] Add save retry path
- [x] Handle malformed stored JSON safely
- [x] Add more user-facing recovery guidance for native STT failures

### 1.2 UX Baseline
- [x] Show extracted action items after processing
- [x] Show extraction/loading state
- [x] Show basic empty state
- [x] Add clearer success state after extraction
- [x] Add quick actions for extracted results
- [x] Add STT diagnostics panel
- [x] Add grouped summary sections to detail view
- [x] Add grouped insight cards to the main screen
- [x] Add richer error state messaging per failure code

### 1.3 Data Validation
- [x] Validate memo shape before persistence
- [x] Guard against invalid updates
- [x] Prepare migration path for future storage format changes

### 1.4 Baseline Testing
- [x] `actionItemExtractor` unit tests
- [x] `storage` unit tests
- [x] `echoService` unit tests
- [x] `contextMapping` unit tests
- [x] Manual recording -> extraction -> display verification checklist

### 1.5 Basic Performance Sanity
- [x] Reduce full-array rewrites in storage
- [x] Add search debouncing
- [x] Improve memo list rendering behavior
- [x] Review audio resource cleanup
- [ ] Measure larger local memo datasets

## 2. Phase 2: Native STT Validation

Goal: turn the current integration from "wired" into "verified on device".

### 2.1 Integration
- [x] STT interface exists
- [x] Mock engine exists
- [x] Native file transcription path is wired
- [x] Native STT fallback path exists
- [x] STT source/diagnostics are surfaced in UI
- [ ] Verify native STT on iOS device
- [ ] Verify native STT on Android device

### 2.2 iOS Build Readiness
- [x] `ios.bundleIdentifier` configured
- [x] Xcode selected as active developer directory
- [x] `xcodebuild -runFirstLaunch` completed
- [x] CocoaPods installed on the current machine
- [x] `pod install` and native iOS build succeed on the current machine
- [x] Launch a valid Simulator device or use an online physical iPhone
- [x] `npm run dev:ios` succeeds again on the current machine

### 2.3 Validation
- [ ] Korean sample accuracy checks
- [ ] Background noise checks
- [ ] Latency measurement
- [ ] Memory usage measurement
- [ ] iOS 1-minute file transcription limitation documented in QA notes

## 3. Phase 3: Extraction UX

Goal: make extracted results useful and editable, not just visible.

### 3.1 Action Item Review
- [x] Action item list display exists
- [x] Confidence badge exists
- [x] Edit action item fields
- [x] Mark status such as pending/completed
- [ ] Confirm/reject extracted items

### 3.2 Main Screen Improvements
- [x] Quick copy to clipboard
- [x] Share/export action
- [x] Filter memos with action items only
- [x] Extraction summary block
- [x] Memo detail audio player
- [x] Insight-card drill-in and action-only quick navigation
- [x] Filter by task type or confidence

### 3.3 Information Architecture
- [x] Action item detail view
- [x] Recording summary view
- [~] Better grouping of decisions/issues/tasks

## 4. Phase 4: Context Integration

Goal: turn the current context structure into real metadata capture.

### 4.1 Location
- [x] Install and wire `expo-location`
- [x] Request optional location permission
- [x] Capture live coordinates
- [x] Map place name safely

### 4.2 Calendar
- [x] Pick calendar integration strategy
- [x] Detect active event
- [x] Attach event metadata
- [~] Keep calendar context focused on the linked schedule rather than participants
- [ ] Validate calendar context on device with real permissions and live events

### 4.3 Entity Enrichment
- [x] Improve assignee extraction accuracy
- [~] Normalize dates/times
- [~] Expand organization/project detection

## 5. Phase 5: Performance Improvements

Goal: keep the app responsive as memo volume and processing complexity increase.

### 5.1 Storage
- [x] Split list index from memo payload storage
- [x] Reduce full-array rewrites
- [ ] Evaluate SQLite or MMKV migration

### 5.2 Search and Rendering
- [x] Add search debouncing
- [x] Precompute normalized search fields
- [x] Optimize list rendering for larger datasets

### 5.3 Audio and Processing
- [x] Clean up playback audio resources
- [x] Clean up temporary recording files
- [ ] Parallelize safe processing steps
- [ ] Measure real STT bottlenecks after device validation

## 6. Phase 6: Testing and Quality

### 6.1 Unit Tests
- [x] extractor tests
- [x] storage tests
- [x] service tests
- [x] context mapping tests

### 6.2 Integration Tests
- [x] recording -> transcription -> extraction flow
- [x] persistence + reload flow
- [x] export/share formatting flow

### 6.3 Manual QA
- [ ] iOS device smoke test
- [ ] Android device smoke test
- [x] Web limitations documented

## 7. Phase 7: External Integrations

- [ ] Slack share integration
- [ ] Calendar sync
- [ ] To-do app export flow

## 7.5 Monetization Foundation

- [x] Define a first free-to-pro upgrade timing heuristic
- [x] Track lightweight free-plan usage locally
- [x] Surface current plan and upgrade timing in settings
- [~] Choose the first billing provider and integration path
- [~] Surface RevenueCat key-readiness in the app settings
- [~] Attach RevenueCat SDK and in-app connection check
- [~] Finalize paid feature boundary

## 7.6 UX Polish in Progress

- [~] Dark-mode support across main/archive/detail surfaces
- [~] Stronger manual tag editing with suggested quick-add chips and archive tag filters
- [x] Search across title/transcript/summary/tags
- [~] Add in-app device QA helper for speech/calendar readiness

## 8. Phase 8+: Longer-Term Roadmap

- [~] Zero-friction input
- [ ] Speaker attribution
- [ ] Semantic search
- [ ] Collaboration features
- [ ] Analytics
- [ ] Production deployment pipeline
- [ ] Security/privacy hardening
- [ ] Full end-user documentation

## Recommended Next Execution Order

1. Complete one successful native STT run on a real iPhone.
2. Complete one successful calendar-linked memo validation on a real iPhone.
3. Finalize store metadata, icon, screenshots, and privacy wording.
4. Decide whether billing ships in v1 or immediately after launch.
5. Keep non-blocking polish work for post-launch updates.
