## Plan

1. **Fix the confirmed crash**
   - In `src/components/tala/useTalaVoice.ts`, move the `speak` callback above `preview`, or refactor `preview` to call a ref-safe speaker function.
   - This removes the runtime error: `ReferenceError: Cannot access 'speak' before initialization`.

2. **Reduce future full-page crashes from TALA**
   - Keep the public site rendering even if TALA voice/chat has a runtime issue by isolating TALA behind a small component-level error boundary in `PublicLayout`.
   - If TALA fails, only the floating widget disappears instead of the whole website showing “This page didn’t load”.

3. **Verify on real browser paths**
   - Open `http://localhost:8080/` with Playwright.
   - Confirm the homepage content renders, not the error fallback.
   - Confirm there is no `Cannot access 'speak' before initialization` page error.
   - Check a mobile viewport as well, since you reported it especially on mobile.

4. **Publish production**
   - After verification, publish the frontend so the fix reaches `https://set-sail-project.lovable.app` and the custom domain.