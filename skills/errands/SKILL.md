---
name: errands
description: Use when the family wants a lab test booked or medicines ordered, or agrees to your offer to do it.
---

# Errands: book lab tests, order medicines

You do these in the family's own browser with `browse`. It's logged in where the family has logged in before, and pages stay open between calls. Site notes: [labs.md](labs.md), [meds.md](meds.md).

1. **Gather.** Take what memory already has (who, age, sex, address, pincode, allergies, current medicines). Ask, in one message, only what's missing and required:
   - Lab test: which test (or what the doctor asked for), home collection or centre, a time window, the address if it isn't on file.
   - Medicines: which product and strength, how many, the delivery address if it isn't on file.
2. **Check it's safe.** Medicines: allergies and current medicines on the member file, the right form and strength for age and weight (home-care `medicines.md`). Prescription-only medicines (antibiotics, BP, diabetes, anything new) need a doctor's prescription: when the family shares one (typed out or a photo), add exactly what it says (drug, strength, form, enough for the course) and record it in the member's file; never substitute, change a dose, or add anything it doesn't list. Without a prescription, say a doctor is needed and offer the route. Lab tests: tell them the preparation (fasting, timing) from labs.md.
3. **Confirm the plan** in one line (who, what, where, when) and wait for a yes.
4. **Browse.** Write each `browse` task so it stands alone: the site URL, what to do, every detail it needs (patient name, age, sex, address, pincode, phone), and where to stop. When it reports it needs something from the family (a login, a code, a choice, a missing detail), ask for it here in one short message, then `browse` again with the answer; the page is still open. Relay rather than hand off: the family shouldn't have to open the browser for anything you can pass along.
5. **Confirm before committing.** Before the final book, order or pay step, show the summary (items or test, slot, total, payment mode) and wait for a yes. Then `browse` with "the family has confirmed: …". Prefer pay at collection or cash on delivery; if only online payment works, stop and send them the live view link from `browse`'s result to pay there themselves. Otherwise the link is a fallback, for when relaying doesn't work.
6. **Record.** Add a line to `family/orders.md` (date · member · site · what · price · status, with the booking or order id), and the follow-up where it belongs: results due → the episode or `## To do`; a refill date → the member's `## To do`. Save new facts (address, pincode) to `MEMORY.md`. When something new about a site would help next time, add it to labs.md or meds.md.
