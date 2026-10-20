---
name: errands
description: Use when the family wants a lab test booked or medicines ordered, or agrees to your offer to do it.
---

# Errands: book lab tests, order medicines

You do these in the family's own browser with `browse`. It's logged in where the family has logged in before, and pages stay open between calls. Choosing tests and products: [labs.md](labs.md), [meds.md](meds.md). How each site works: `sites/<site>.md` (built in) and `/family/sites/<site>.md` (what this household's runs learned); `browse` attaches both automatically for sites named in the task.

1. **Gather.** Take what memory already has (who, age, sex, address, pincode, allergies, current medicines). Ask, in one message, only what's missing and required:
   - Lab test: which test (or what the doctor asked for), home collection or centre, a time window, the address if it isn't on file.
   - Medicines: which product and strength, how many, the delivery address if it isn't on file.
2. **Check it's safe.** Medicines: allergies and current medicines on the member file, the right form and strength for age and weight (home-care `medicines.md`). Prescription-only medicines (antibiotics, BP, diabetes, anything new) need a doctor's prescription: when the family shares one (typed out or a photo), add exactly what it says (drug, strength, form, enough for the course) and record it in the member's file; never substitute, change a dose, or add anything it doesn't list. Without a prescription, say a doctor is needed and offer the route. Lab tests: tell them the preparation (fasting, timing) from labs.md.
3. **Confirm the plan** in one line (who, what, where, when) and wait for a yes.
4. **Browse.** Write each `browse` task so it stands alone: the site URL, what to do, every detail it needs (patient name, age, sex, address, pincode, phone), and where to stop. When it reports it needs something from the family (a login, a code, a choice, a missing detail), ask for it here in one short message, then `browse` again with the answer; the page is still open. Relay rather than hand off: the family shouldn't have to open the browser for anything you can pass along.
   - **Don't stop at a wall** (a login, a verification code, a form, a choice). Work out what it needs, take what memory already has, and ask the family only for the rest, in one line; save lasting details (a phone number, an email) to memory so you never ask twice. If something is time-bound, like a code the site sends, have the browser trigger it first, then ask for it, and continue the moment they reply; if it expires or is rejected, trigger it again. Then carry on toward the goal (step 5) without waiting to be told.
5. **Confirm before committing.** Before the final book, order or pay step, show the summary (items or test, slot, total, payment mode) and wait for a yes. Then `browse` with "the family has confirmed: …". Prefer pay at collection or cash on delivery; if only online payment works, stop and send them the live view link from `browse`'s result to pay there themselves. Otherwise the link is a fallback, for when relaying doesn't work.
6. **Record.** Add a line to `family/orders.md` (date · member · site · what · price · status, with the booking or order id), and the follow-up where it belongs: results due → the episode or `## To do`; a refill date → the member's `## To do`. After every run, good or bad, write what you learned about the site into `/family/sites/<site>.md` (one line per fact: where things are, what worked, what to avoid), so the next run is faster.

## You manage the browser

The browser is your assistant on the web; you own the outcome. After each `browse`, read its report like a manager:
- **Don't accept the first failure.** "Blank", "blocked", "couldn't find" usually means it gave up early. `browse` again with a sharper instruction: what to try (wait longer, reload, the site's search URL, a shorter address), what you already know, and the exact goal. Try up to three times before switching to another site or telling the family.
- **Keep it moving.** When it needs something only the family has (a code, a choice, a login), ask right away in one line, then continue in the same session. Codes expire in minutes: if the session ended or the code was rejected, start again and request a fresh one.
- **Check its claims.** Prices, pack sizes and totals must match what was agreed; if something's off, send it back.
- **Keep the family posted** in a line while it works, and never say something was ordered unless the report shows an order id.
